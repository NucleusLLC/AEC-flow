/**
 * Firm-wide invoice settings — the parts of an invoice that are the practice's,
 * not the invoice's: the payment terms it normally gives, where the money goes
 * (bank details) and its terms & conditions.
 *
 * Stored in the per-company AppConfig JSON blob beside the letterhead (see
 * lib/server/practice-config.ts), so there is no table and no SQL. This module
 * is the pure half: the shape, the defaults and the one parser every read and
 * every save goes through. A blob written by hand, by an older build or by a
 * request that skipped the form is clamped here rather than trusted.
 *
 * Client-safe: no fs, no Prisma.
 */

export type InvoiceSettings = {
  /** Days from the invoice date to the due date on a NEW invoice. */
  defaultTermsDays: number;
  /** Printed in a framed block under the totals on page 1. Multi-line. */
  bankDetails: string;
  /** The firm's terms & conditions, printed on every invoice when set. */
  termsText: string;
  /** True: the T&C start a second A4 sheet. False: they follow the notes. */
  termsOnSecondPage: boolean;
  /** Point size the T&C are set in. */
  termsFontSize: number;
};

export const MIN_TERMS_DAYS = 0;
export const MAX_TERMS_DAYS = 365;
export const MIN_TERMS_FONT_PT = 6;
export const MAX_TERMS_FONT_PT = 12;
/** Ceilings so a pasted manual cannot bloat the config row every request reads. */
export const MAX_BANK_DETAILS_CHARS = 1_000;
export const MAX_TERMS_CHARS = 20_000;

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  defaultTermsDays: 30,
  bankDetails: "",
  termsText: "",
  termsOnSecondPage: true,
  termsFontSize: 8,
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // Windows line endings from a pasted document become plain newlines, and
  // trailing blank lines are dropped so the printed block does not grow a tail.
  return v.replace(/\r\n?/g, "\n").replace(/\s+$/, "").slice(0, max);
}

/**
 * The effective settings for whatever is stored — never throws. Anything
 * missing or out of range falls back to the default (numbers are clamped, not
 * rejected, so a stored 400-day term reads as 365 rather than as 30).
 */
export function parseInvoiceSettings(raw: unknown): InvoiceSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_INVOICE_SETTINGS;
  return {
    defaultTermsDays: clampInt(o.defaultTermsDays, MIN_TERMS_DAYS, MAX_TERMS_DAYS, d.defaultTermsDays),
    bankDetails: text(o.bankDetails, MAX_BANK_DETAILS_CHARS),
    termsText: text(o.termsText, MAX_TERMS_CHARS),
    termsOnSecondPage: typeof o.termsOnSecondPage === "boolean" ? o.termsOnSecondPage : d.termsOnSecondPage,
    termsFontSize: clampInt(o.termsFontSize, MIN_TERMS_FONT_PT, MAX_TERMS_FONT_PT, d.termsFontSize),
  };
}

/** Where the printed T&C go: nowhere, after the notes, or on a sheet of their own. */
export function termsPlacement(s: Pick<InvoiceSettings, "termsText" | "termsOnSecondPage">): "none" | "inline" | "second-page" {
  if (!s.termsText.trim()) return "none";
  return s.termsOnSecondPage ? "second-page" : "inline";
}
