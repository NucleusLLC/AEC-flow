/**
 * A permit letter's PDF — what may be uploaded and where it is stored.
 *
 * PURE, and client-safe: the browser runs `validateLetterPdf` before it asks for
 * an upload URL, and the server runs the same function again before it issues
 * one, so the two answers cannot drift. The server's answer is the one that
 * counts.
 *
 * THE KEY IS CHOSEN BY THE SERVER, NEVER BY THE CLIENT — the same rule as
 * lib/drawings/storage-key.ts, for the same reason: a signed upload URL is a
 * capability to write one object, and a browser that named the object could
 * name one on another practice's file.
 */
import { sanitiseFilename } from "@/lib/drawings/storage-key";

/** Letters are scans and exports, not drawing sets — 25 MB is generous. */
export const LETTER_PDF_MAX_BYTES = 25 * 1024 * 1024;

export type LetterPdfVerdict = { ok: true } | { ok: false; message: string };

export function validateLetterPdf(file: {
  name: string;
  size: number;
  type: string;
}): LetterPdfVerdict {
  const name = String(file?.name ?? "").trim();
  if (!name) return { ok: false, message: "The file has no name." };
  // Browsers on some systems report an empty type for a PDF, so the extension
  // is the rule and a declared type only disqualifies when it says otherwise.
  const isPdfName = /\.pdf$/i.test(name);
  const type = String(file?.type ?? "").toLowerCase();
  if (!isPdfName || (type && type !== "application/pdf")) {
    return { ok: false, message: "Attach the letter as a PDF." };
  }
  const size = Number(file?.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, message: "The PDF is empty." };
  if (size > LETTER_PDF_MAX_BYTES) {
    return { ok: false, message: "The PDF is larger than 25 MB." };
  }
  return { ok: true };
}

/**
 * A loose file on the case: the stamped application form, a receipt, a photo of
 * the site notice, a drawing extract. Wider than a letter, which is always a
 * PDF, but the same ceiling — these are scans and exports, not drawing sets.
 */
const FILE_EXTENSIONS = [
  "pdf", "png", "jpg", "jpeg", "webp", "heic", "dwg", "dxf",
  "doc", "docx", "xls", "xlsx", "csv", "txt",
];

export function validatePermitFile(file: {
  name: string;
  size: number;
  type: string;
}): LetterPdfVerdict {
  const name = String(file?.name ?? "").trim();
  if (!name) return { ok: false, message: "The file has no name." };
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (!FILE_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      message: `“${ext || name}” is not a file type this register takes. Use a PDF, an image, a drawing or a spreadsheet.`,
    };
  }
  const size = Number(file?.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, message: "The file is empty." };
  if (size > LETTER_PDF_MAX_BYTES) return { ok: false, message: "The file is larger than 25 MB." };
  return { ok: true };
}

/** The prefix every loose file on one permit lives under. */
export function permitDocumentPrefix(permitId: string): string {
  return `permits/${permitId}/documents/`;
}

/** `permits/<permitId>/documents/<uploadId>/<filename>` — never overwritten. */
export function buildDocumentKey(permitId: string, filename: string, uploadId: string): string {
  return `${permitDocumentPrefix(permitId)}${uploadId}/${sanitiseFilename(filename)}`;
}

/** True when `key` is one `buildDocumentKey` would have issued for `permitId`. */
export function isDocumentKeyForPermit(key: string, permitId: string): boolean {
  return matchesPrefix(key, permitDocumentPrefix(permitId));
}

/** The prefix every letter PDF on one permit lives under. */
export function permitLetterPrefix(permitId: string): string {
  return `permits/${permitId}/letters/`;
}

/** `permits/<permitId>/letters/<uploadId>/<filename>` — upload-scoped, never overwritten. */
export function buildLetterKey(permitId: string, filename: string, uploadId: string): string {
  return `${permitLetterPrefix(permitId)}${uploadId}/${sanitiseFilename(filename)}`;
}

/** True when `key` is one `buildLetterKey` would have issued for `permitId`. */
export function isLetterKeyForPermit(key: string, permitId: string): boolean {
  return matchesPrefix(key, permitLetterPrefix(permitId));
}

/** Exactly `<prefix><uploadId>/<filename>` — no traversal, no deeper nesting. */
function matchesPrefix(key: string, prefix: string): boolean {
  return (
    typeof key === "string" &&
    !prefix.includes("//") &&
    key.startsWith(prefix) &&
    /^[A-Za-z0-9-]+\/[^/]+$/.test(key.slice(prefix.length)) &&
    !key.includes("..")
  );
}
