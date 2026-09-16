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
  const prefix = permitLetterPrefix(permitId);
  return (
    typeof key === "string" &&
    Boolean(permitId) &&
    key.startsWith(prefix) &&
    // exactly `<uploadId>/<filename>` after the prefix — no traversal, no nesting
    /^[A-Za-z0-9-]+\/[^/]+$/.test(key.slice(prefix.length)) &&
    !key.includes("..")
  );
}
