/**
 * Stripe webhook signature verification, without the Stripe SDK.
 *
 * Stripe signs every webhook delivery with the endpoint's signing secret
 * (STRIPE_WEBHOOK_SECRET, `whsec_...`). The `Stripe-Signature` header reads
 *
 *     t=1700000000,v1=<hex>,v1=<hex>,v0=<hex>
 *
 * where each `v1` is HMAC-SHA256(secret, `${t}.${rawBody}`) in lower-case hex.
 * There can be several `v1` values while a secret is being rolled; any one
 * matching is enough. `v0` is a test-mode scheme we ignore.
 *
 * Two rules that matter:
 *  - The HMAC is over the RAW body, byte for byte. A body that has been parsed
 *    and re-serialised will not verify, which is why the route reads
 *    `request.text()` and verifies before it parses.
 *  - The timestamp must be recent (5 minutes by default, Stripe's own default),
 *    so a captured delivery cannot be replayed next week. The comparison is
 *    constant-time.
 *
 * PURE apart from node:crypto: no I/O, no env. Tested in stripe-signature.test.ts.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Stripe's own default tolerance. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

export type ParsedSignature = { timestamp: number | null; v1: string[] };

export function parseSignatureHeader(header: string | null | undefined): ParsedSignature {
  const out: ParsedSignature = { timestamp: null, v1: [] };
  if (!header) return out;
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key === "t" && /^\d{1,12}$/.test(value)) out.timestamp = Number(value);
    else if (key === "v1" && /^[0-9a-f]{64}$/i.test(value)) out.v1.push(value.toLowerCase());
  }
  return out;
}

/** HMAC-SHA256 of `${timestamp}.${payload}`, lower-case hex — what Stripe sends as v1. */
export function computeSignature(payload: string, timestamp: number, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
}

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/**
 * Throws StripeSignatureError unless `header` carries a valid, fresh v1
 * signature of `payload` under `secret`. Returns nothing on success.
 */
export function verifyStripeSignature(input: {
  payload: string;
  header: string | null | undefined;
  secret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): void {
  const { payload, header, secret } = input;
  if (!secret) throw new StripeSignatureError("No webhook signing secret is configured.");
  const parsed = parseSignatureHeader(header);
  if (parsed.timestamp === null) throw new StripeSignatureError("The signature header has no timestamp.");
  if (parsed.v1.length === 0) throw new StripeSignatureError("The signature header has no v1 signature.");

  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  // Too old is a replay; too far in the future is a forged or broken clock.
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    throw new StripeSignatureError("The signature timestamp is outside the tolerance.");
  }

  const expected = computeSignature(payload, parsed.timestamp, secret);
  if (!parsed.v1.some((sig) => sameHex(sig, expected))) {
    throw new StripeSignatureError("No signature matches the payload.");
  }
}
