/**
 * What the drop zone is allowed to accept. Pure — takes a plain descriptor, not
 * a `File`, so it is unit-testable in Node and reusable server-side.
 *
 * THE LIMITS AND WHY THEY ARE WHAT THEY ARE
 *
 *   50 MiB per file       NOT the number this policy would choose on its own.
 *                         A PDF sheet is 1-10 MB and a multi-sheet issue set
 *                         20-60 MB, so 100 MiB was the intended ceiling — but
 *                         Supabase enforces a PROJECT-WIDE upload limit that is
 *                         50 MiB on the current plan, and a limit we cannot
 *                         enforce is worse than a lower one we can: the upload
 *                         would fail at the storage edge after the whole file
 *                         had been transferred. Rejecting it here costs the
 *                         user nothing. A bound DWG with xrefs CAN exceed this;
 *                         raising the Supabase plan and then this constant plus
 *                         DRAWINGS_MAX_UPLOAD_BYTES is the way out.
 *   25 files per drop     A discipline issue is typically 10-40 sheets. 25 is
 *                         a batch a person can actually review one-by-one in a
 *                         confirmation step, which is the point of this design.
 *   1 byte minimum        A zero-byte file is a failed copy, not an upload.
 *   255 char filename     The practical ceiling on most filesystems and on
 *                         Supabase Storage object keys.
 *
 * EXECUTABLES. The allowlist is the actual control: only .pdf/.dwg/.dxf/.rvt
 * get through, so `A-101.pdf.exe` is rejected for having an `exe` extension.
 * The separate executable check exists for the reverse trick, `A-101.exe.pdf`,
 * where the last segment is fine and an earlier one is not — some downstream
 * consumers and some OS shells look at the wrong segment. Both checks are
 * cheap; neither alone is sufficient.
 *
 * NOT DONE HERE. Content sniffing (does the file really start with `%PDF-`)
 * needs the bytes and therefore belongs on the server, at the point of upload.
 * This module deliberately validates only what the browser can know before
 * transferring anything.
 */

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MIN_FILE_BYTES = 1;
export const MAX_FILES_PER_BATCH = 25;
export const MAX_FILENAME_LENGTH = 255;

/** What we can do with the file once it is stored. */
export type DrawingFileKind =
  /** PDF — a text layer may exist, so extraction from content is possible. */
  | "PDF"
  /** CAD vector — cannot be parsed in this stack. Filename only. */
  | "DWG"
  /** Revit model — cannot be parsed in this stack. Filename only. */
  | "RVT";

export const ACCEPTED_EXTENSIONS: Readonly<Record<string, DrawingFileKind>> = {
  pdf: "PDF",
  dwg: "DWG",
  dxf: "DWG",
  rvt: "RVT",
};

/** The `accept` attribute for the file input. Extensions, because browsers and
 *  operating systems do not agree on a MIME type for DWG/DXF/RVT. */
export const ACCEPT_ATTRIBUTE = ".pdf,.dwg,.dxf,.rvt,application/pdf";

/**
 * MIME types the browser may report for an accepted extension. CAD files
 * usually arrive as `application/octet-stream` or with an empty type, so the
 * extension is authoritative and the MIME type is only used to REJECT an
 * obvious mismatch (a `.pdf` the browser thinks is `text/html`).
 */
const NEUTRAL_MIME = new Set(["", "application/octet-stream", "application/x-binary", "binary/octet-stream"]);
const PDF_MIME = new Set(["application/pdf", "application/x-pdf", "application/acrobat"]);
const CAD_MIME = new Set([
  "application/acad",
  "application/x-acad",
  "application/autocad_dwg",
  "image/vnd.dwg",
  "image/x-dwg",
  "application/dxf",
  "application/x-dxf",
  "image/vnd.dxf",
  "application/vnd.autodesk.revit",
]);

const EXECUTABLE_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "scr", "pif", "msi", "msp", "cpl", "dll", "sys",
  "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "hta", "jar", "sh",
  "bash", "zsh", "app", "apk", "deb", "rpm", "lnk", "reg", "scf", "inf",
]);

export type UploadRejectionCode =
  | "EMPTY_NAME"
  | "NAME_TOO_LONG"
  | "PATH_IN_NAME"
  | "CONTROL_CHARS"
  | "NO_EXTENSION"
  | "EXTENSION_NOT_ALLOWED"
  | "EXECUTABLE"
  | "MIME_MISMATCH"
  | "TOO_LARGE"
  | "EMPTY_FILE"
  | "BATCH_TOO_LARGE";

export type UploadCandidate = { name: string; size: number; type: string };

export type UploadVerdict =
  | { ok: true; kind: DrawingFileKind; extension: string }
  | { ok: false; code: UploadRejectionCode; message: string };

function lastExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function allExtensionSegments(name: string): string[] {
  return name.split(".").slice(1).map((s) => s.trim().toLowerCase());
}

/** Validate one file. Never throws. */
export function validateUpload(candidate: UploadCandidate): UploadVerdict {
  const name = String(candidate?.name ?? "").trim();
  const size = Number(candidate?.size);
  const type = String(candidate?.type ?? "").toLowerCase().split(";")[0].trim();

  if (!name) return no("EMPTY_NAME", "The file has no name.");
  if (name.length > MAX_FILENAME_LENGTH)
    return no("NAME_TOO_LONG", `Filename is longer than ${MAX_FILENAME_LENGTH} characters.`);
  if (/[\\/]/.test(name)) return no("PATH_IN_NAME", "Filename contains a path separator.");
  // Checked by code point rather than by regex literal: a control-character
  // class in a regex is itself a lint smell, and this reads better anyway.
  if (hasControlCharacter(name)) return no("CONTROL_CHARS", "Filename contains control characters.");

  const segments = allExtensionSegments(name);
  const exe = segments.find((s) => EXECUTABLE_EXTENSIONS.has(s));
  if (exe) return no("EXECUTABLE", `“.${exe}” is an executable file type and is never accepted.`);

  const ext = lastExtension(name);
  if (!ext) return no("NO_EXTENSION", "The file has no extension, so its type cannot be determined.");

  const kind = ACCEPTED_EXTENSIONS[ext];
  if (!kind)
    return no(
      "EXTENSION_NOT_ALLOWED",
      `“.${ext}” is not a drawing file. Accepted: ${Object.keys(ACCEPTED_EXTENSIONS)
        .map((e) => `.${e}`)
        .join(", ")}.`,
    );

  if (!NEUTRAL_MIME.has(type)) {
    const allowed = kind === "PDF" ? PDF_MIME : CAD_MIME;
    if (!allowed.has(type)) {
      return no("MIME_MISMATCH", `The browser reports this “.${ext}” file as “${type}”.`);
    }
  }

  if (!Number.isFinite(size) || size < MIN_FILE_BYTES) return no("EMPTY_FILE", "The file is empty.");
  if (size > MAX_FILE_BYTES)
    return no("TOO_LARGE", `The file is ${formatBytes(size)}; the limit is ${formatBytes(MAX_FILE_BYTES)}.`);

  return { ok: true, kind, extension: ext };
}

/** Validate a whole drop. Enforces the batch cap, then each file. */
export function validateBatch(candidates: readonly UploadCandidate[]): {
  batchError: string | null;
  verdicts: UploadVerdict[];
} {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length > MAX_FILES_PER_BATCH) {
    return {
      batchError: `${list.length} files dropped; the limit is ${MAX_FILES_PER_BATCH} at a time.`,
      verdicts: [],
    };
  }
  return { batchError: null, verdicts: list.map(validateUpload) };
}

function hasControlCharacter(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

function no(code: UploadRejectionCode, message: string): UploadVerdict {
  return { ok: false, code, message };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
