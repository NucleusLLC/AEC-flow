/**
 * An expense's receipt — what may be uploaded, where it is stored, and who may
 * see or change it.
 *
 * PURE, and client-safe: the browser runs `validateReceipt` before it asks for
 * an upload URL, the server runs it again before it issues one, and once more
 * on what storage says actually landed. The server's answer is the one that
 * counts.
 *
 * THE KEY IS CHOSEN BY THE SERVER, NEVER BY THE CLIENT — the rule of
 * lib/drawings/storage-key.ts and lib/building-permits/letter-file.ts, for the
 * same reason: a signed upload URL is a capability to write one object, and a
 * browser that named the object could name one on another practice's expense.
 *
 * THE LIMITS. A receipt is a phone photo or a supplier's PDF: a few hundred KB
 * to a few MB. 10 MB is generous for that and well inside the 50 MiB project
 * ceiling the storage bucket enforces (lib/server/storage.ts).
 *
 * THE TYPES. JPEG, PNG, WebP and HEIC (what an iPhone camera saves) for a photo,
 * PDF for anything a supplier emailed. Not SVG — an SVG is a document that can
 * carry script, not a picture of a till slip.
 */
import { sanitiseFilename } from "@/lib/drawings/storage-key";

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export const RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export type ReceiptMimeType = (typeof RECEIPT_MIME_TYPES)[number];

/** The `accept` attribute of the file input. `.heic` too: some browsers report
 *  no type for it, and the extension is how the picker still offers it. */
export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf,.heic,.heif";

const BY_EXTENSION: Readonly<Record<string, ReceiptMimeType>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heic",
  pdf: "application/pdf",
};

/** Names a browser or a store may use for an allowed type. */
const ALIASES: Readonly<Record<string, ReceiptMimeType>> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/heif": "image/heic",
  "image/x-png": "image/png",
};

function extensionOf(name: string): string {
  const n = String(name ?? "").trim();
  const dot = n.lastIndexOf(".");
  return dot > 0 ? n.slice(dot + 1).toLowerCase() : "";
}

/** The canonical allowed type for a declared type, or null. */
export function normaliseReceiptMime(type: string | null | undefined): ReceiptMimeType | null {
  const t = String(type ?? "").trim().toLowerCase().split(";")[0]!.trim();
  if ((RECEIPT_MIME_TYPES as readonly string[]).includes(t)) return t as ReceiptMimeType;
  return ALIASES[t] ?? null;
}

export type ReceiptVerdict =
  | { ok: true; mimeType: ReceiptMimeType }
  | { ok: false; message: string };

/**
 * Is this file acceptable as a receipt? Returns the type to store it under.
 *
 * The declared type decides when there is one; an empty type (HEIC on some
 * systems) falls back to the extension. A declared type that is not on the list
 * is refused even when the extension is — `receipt.pdf` that the browser calls
 * `text/html` is not a PDF.
 */
export function validateReceipt(file: { name: string; size: number; type: string }): ReceiptVerdict {
  const name = String(file?.name ?? "").trim();
  if (!name) return { ok: false, message: "The file has no name." };

  const declared = String(file?.type ?? "").trim();
  const mimeType = declared ? normaliseReceiptMime(declared) : BY_EXTENSION[extensionOf(name)] ?? null;
  if (!mimeType) {
    return { ok: false, message: "Attach the receipt as a photo (JPEG, PNG, WebP or HEIC) or a PDF." };
  }

  const size = Number(file?.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, message: "The file is empty." };
  if (size > RECEIPT_MAX_BYTES) return { ok: false, message: "The receipt is larger than 10 MB." };
  return { ok: true, mimeType };
}

/** The prefix every receipt of one expense lives under. */
export function receiptPrefix(expenseId: string): string {
  return `receipts/${expenseId}/`;
}

/** `receipts/<expenseId>/<uploadId>/<filename>` — upload-scoped, never overwritten. */
export function buildReceiptKey(expenseId: string, filename: string, uploadId: string): string {
  return `${receiptPrefix(expenseId)}${uploadId}/${sanitiseFilename(filename)}`;
}

/** True when `key` is one `buildReceiptKey` would have issued for `expenseId`. */
export function isReceiptKeyForExpense(key: string, expenseId: string): boolean {
  const prefix = receiptPrefix(expenseId);
  return (
    typeof key === "string" &&
    typeof expenseId === "string" &&
    /^[A-Za-z0-9_-]+$/.test(expenseId) &&
    key.startsWith(prefix) &&
    /^[A-Za-z0-9-]+\/[^/]+$/.test(key.slice(prefix.length)) &&
    !key.includes("..")
  );
}

/** The filename a receipt is kept under on the row: the person's own, trimmed. */
export function receiptDisplayName(filename: string, mimeType: string): string {
  const name = String(filename ?? "").trim().replace(/[\r\n\t]/g, " ").slice(0, 200);
  if (name) return name;
  return mimeType === "application/pdf" ? "receipt.pdf" : "receipt";
}

// ── Who may do what ────────────────────────────────────────────────────────
//
// The same rules as the expense itself (docs/finance/SPEC.md, "What is
// frozen"), stated once so the data layer and the screens cannot drift. The
// data layer is what enforces them.

export type ReceiptSubject = {
  userId: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  invoicedAt: string | Date | null;
};

/** The person who recorded it, or an administrator (canManagePasswords). */
export function canViewReceipt(
  expense: Pick<ReceiptSubject, "userId">,
  viewer: { id: string; isAdmin: boolean },
): boolean {
  return viewer.isAdmin || expense.userId === viewer.id;
}

/**
 * Attach, replace or remove. Never once the expense is on an invoice; an
 * approved one only by an approver; somebody else's only by an approver.
 */
export function canChangeReceipt(
  expense: ReceiptSubject,
  viewer: { id: string; isAdmin: boolean },
): boolean {
  if (expense.invoicedAt) return false;
  if (expense.userId !== viewer.id && !viewer.isAdmin) return false;
  if (expense.status === "APPROVED" && !viewer.isAdmin) return false;
  return true;
}

/** "1.2 MB", "340 KB" — for the screen, not for arithmetic. */
export function formatReceiptSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
