/**
 * "Pay online" — the pure rules: the link's token, when an invoice may be paid
 * online, and how much the card is charged.
 *
 * PURE apart from node:crypto's random bytes (injectable): no I/O, no env read
 * except through the argument. Tested in pay-link.test.ts.
 *
 * THE TOKEN. 32 random bytes, base64url — 43 characters, 256 bits. The link is a
 * bearer credential for one narrow thing: seeing an invoice's number, the
 * practice's name and the amount owed, and paying it. It is stored as is on the
 * invoice (not hashed) because the practice has to show and print the SAME link
 * on every reprint of the invoice; a hash would force a new link each time, and
 * the old printed one would stop working. Guessing one is out of reach (2^256),
 * and the page it opens shows nothing a client was not already sent on paper.
 *
 * THE AMOUNT. Always the CURRENT outstanding balance (lib/finance/calc.ts,
 * `invoiceBalance`: total less payments and issued credit notes), converted to
 * minor units by lib/proposals/engine/money.ts — never by `* 100` here.
 */
import { randomBytes } from "node:crypto";
import { fromMajor, money, toMajor } from "@/lib/proposals/engine/money";

export const PAY_TOKEN_BYTES = 32;
/** base64url of 32 bytes, no padding. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function newPayToken(random: (n: number) => Buffer = randomBytes): string {
  return random(PAY_TOKEN_BYTES).toString("base64url");
}

/** Cheap shape check before any database lookup. */
export function isPayTokenShape(token: unknown): token is string {
  return typeof token === "string" && TOKEN_SHAPE.test(token);
}

/** The app's public address, the same resolution the invitation and reset links use. */
export function publicBaseUrl(env: { NEXTAUTH_URL?: string; NEXT_PUBLIC_APP_URL?: string }): string {
  return (env.NEXTAUTH_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || "https://aec-flow.com").replace(
    /\/+$/,
    "",
  );
}

export function payUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/pay/${token}`;
}

/**
 * Only an invoice that has been sent and still has money owing can be paid
 * online. A draft has not been asked for, a void has been withdrawn, and PAID
 * and CREDITED invoices owe nothing.
 */
export function isOnlinePayable(invoice: { status: string; outstanding: number }): boolean {
  return (invoice.status === "ISSUED" || invoice.status === "PART_PAID") && invoice.outstanding > 0;
}

/**
 * Currencies Stripe does not count in hundredths. money.ts carries every amount
 * as hundredths (MINOR_UNITS = 100), so charging one of these would be off by a
 * factor of 100 or 10. They are refused rather than converted. AWG, USD, EUR,
 * ANG and the other currencies the app is used with are all two-decimal.
 * ISK is listed because Stripe charges it as a zero-decimal currency in effect.
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF",
  "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);
export const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

export function isCardCurrencySupported(currency: string): boolean {
  const c = (currency ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) && !ZERO_DECIMAL_CURRENCIES.has(c) && !THREE_DECIMAL_CURRENCIES.has(c);
}

export class CheckoutAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutAmountError";
  }
}

/**
 * What the card is charged: the outstanding balance in minor units, and the
 * currency in the lower case Stripe uses. Throws for an unsupported currency or
 * a balance that is not positive.
 */
export function checkoutAmount(outstanding: number, currency: string): { minor: number; currency: string } {
  const cur = (currency ?? "").trim().toUpperCase();
  if (!isCardCurrencySupported(cur)) {
    throw new CheckoutAmountError(`Online card payment is not available in ${cur || "this currency"}.`);
  }
  const m = fromMajor(outstanding, cur);
  if (m.minor <= 0) throw new CheckoutAmountError("Nothing is owed on this invoice.");
  return { minor: m.minor, currency: cur.toLowerCase() };
}

/** A Stripe minor-unit amount back to the major-unit number the payment row stores. */
export function minorToMajor(minor: number, currency: string): number {
  return toMajor(money(minor, currency.toUpperCase()));
}
