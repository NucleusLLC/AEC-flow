/**
 * What may be attached to an outbound email, and under what name.
 *
 * Pure, and separate from the send path, because every rule here is a refusal
 * the user has to be told about BEFORE they press Send. A file silently dropped
 * between the dialog and the provider is the same failure as the green "Queued"
 * tick this email module was rebuilt to remove: the sender believes the client
 * has the document, and the client has an empty covering note.
 *
 * WHY PDF ONLY. These attachments are documents the practice has printed and
 * checked — a proposal, minutes, a permit letter. Accepting anything a file
 * picker will offer means accepting `.exe` and `.zip` from a machine that may be
 * compromised, on an account whose sending domain is the practice's own
 * reputation. The narrow list is deliberate; widen it by adding a measured type,
 * not by removing the check.
 */

/** Media types that may leave the building, by extension. */
const ALLOWED = new Map<string, string>([
  ["pdf", "application/pdf"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
]);

/**
 * Ceiling per file, in bytes — and it is the PLATFORM's ceiling, not a taste.
 *
 * The file travels to the server inside a server-action request body, base64
 * encoded, which inflates it by about a third. Two limits sit in front of it:
 * `serverActions.bodySizeLimit` in next.config.ts (4 MB) and Vercel's own
 * ~4.5 MB cap on a serverless request body, which no configuration can raise.
 * So 2.5 MiB of file is about 3.4 MB of base64 and leaves room for the subject,
 * the message and the recipients — anything larger is refused by the framework
 * or the platform BEFORE a word of it is read, and that failure reads as the app
 * being broken rather than the file being too big. Refusing it here, by name and
 * with both sizes in words, is the whole point.
 *
 * Measured against what this app actually produces: a 4-page minutes PDF from
 * its own print route is 180-320 KB, so minutes, proposals and permit letters
 * clear this by an order of magnitude. A document built around scans will not,
 * and it should say so plainly.
 *
 * Resend's own message limit is 40 MB and is nowhere near binding here. Stage 2
 * — a PDF rendered on the server — will not cross a request boundary at all, and
 * these two numbers become a different, larger conversation then.
 */
export const MAX_ATTACHMENT_BYTES = Math.floor(2.5 * 1024 * 1024);

/**
 * Total across every attachment on one message.
 *
 * The same as one file, not a multiple of it: they all travel in the SAME
 * request, so the request limit is shared. Three small files are fine; three
 * large ones are one refusal, which is why the check is cumulative.
 */
export const MAX_ATTACHMENTS_BYTES = MAX_ATTACHMENT_BYTES;

/** How many files one message may carry. */
export const MAX_ATTACHMENTS = 3;

export type Attachment = {
  filename: string;
  /** Base64, no data-URL prefix. */
  content: string;
  contentType: string;
};

export type AttachmentInput = {
  filename: string;
  content: string;
  /** What the browser claimed. Advisory only — the extension decides. */
  contentType?: string;
  /** Size in bytes of the DECODED file, when the caller knows it. */
  bytes?: number;
};

export type AttachmentResult =
  | { ok: true; attachments: Attachment[] }
  | { ok: false; error: string };

/** The extension, lowercased, or "" when the name has none. */
export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/**
 * A filename safe to put in a mail header and safe to land on a recipient's
 * disk.
 *
 * Path separators go first: a name like `../../etc/passwd` or
 * `C:\Users\x\report.pdf` is not a filename, it is a path, and a mail client
 * that honours it writes outside the folder the user chose. Control characters
 * go too — a newline in a filename is a header injection.
 *
 * The extension is preserved exactly, because it is what decides the type.
 */
export function safeFilename(filename: string, fallback = "document.pdf"): string {
  const base = (filename.split(/[\\/]/).pop() ?? "").trim();
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["<>|:*?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  return cleaned.length > 120 ? cleaned.slice(0, 120) : cleaned;
}

/** Decoded size of a base64 payload, without decoding it. */
export function base64Bytes(content: string): number {
  const clean = content.replace(/\s+/g, "");
  if (clean.length === 0) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

/** Strips a `data:...;base64,` prefix a browser may have included. */
export function stripDataUrl(content: string): string {
  // `[\s\S]` rather than the `s` flag: this repo's tsconfig targets below
  // es2018, where `dotAll` is a compile error.
  const match = content.match(/^data:[^;,]*;base64,([\s\S]*)$/);
  return (match ? match[1] : content).replace(/\s+/g, "");
}

/**
 * Validates the whole set, or refuses the whole set.
 *
 * All-or-nothing on purpose, and with the offending file NAMED: sending two of
 * three attachments is the outcome nobody wants and nobody notices, because the
 * message arrives and looks fine.
 */
export function prepareAttachments(inputs: readonly AttachmentInput[] = []): AttachmentResult {
  if (inputs.length === 0) return { ok: true, attachments: [] };
  if (inputs.length > MAX_ATTACHMENTS) {
    return {
      ok: false,
      error: `Attach at most ${MAX_ATTACHMENTS} files. ${inputs.length} were chosen.`,
    };
  }

  const attachments: Attachment[] = [];
  let total = 0;

  for (const input of inputs) {
    const filename = safeFilename(input.filename);
    const extension = extensionOf(filename);
    const contentType = ALLOWED.get(extension);
    if (!contentType) {
      return {
        ok: false,
        error: extension
          ? `"${filename}" is a .${extension} file. Only ${[...ALLOWED.keys()].join(", ")} can be attached.`
          : `"${filename}" has no file extension, so its type cannot be established.`,
      };
    }

    const content = stripDataUrl(input.content ?? "");
    if (!content) return { ok: false, error: `"${filename}" is empty, so nothing was sent.` };

    const bytes = input.bytes ?? base64Bytes(content);
    if (bytes > MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        error: `"${filename}" is ${formatBytes(bytes)}. The limit for one file is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
      };
    }
    total += bytes;
    if (total > MAX_ATTACHMENTS_BYTES) {
      return {
        ok: false,
        error: `Those files come to ${formatBytes(total)} together. The limit for one message is ${formatBytes(MAX_ATTACHMENTS_BYTES)}.`,
      };
    }

    attachments.push({ filename, content, contentType });
  }

  return { ok: true, attachments };
}

/** Sizes as a person would write them, for a message a person has to act on. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * The line recorded in the email log, so the record says what actually went with
 * the message.
 *
 * The log's shape is fixed (see the EmailLog model), so this rides in the body
 * rather than in a new column: a schema change for this would need a migration
 * applied to production before the code that writes it could ship, and the
 * record is worth more than the tidiness.
 */
export function attachmentLogLine(attachments: readonly Attachment[]): string {
  if (attachments.length === 0) return "";
  const parts = attachments.map((a) => `${a.filename} (${formatBytes(base64Bytes(a.content))})`);
  return `[attached: ${parts.join(", ")}]`;
}
