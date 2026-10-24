/**
 * Stripe webhook signature check, without the Stripe SDK.
 *
 * Stripe sends `Stripe-Signature: t=<unix seconds>,v1=<hex>[,v1=<hex>…][,v0=…]`.
 * The signed payload is `${t}.${rawBody}` and each v1 is HMAC-SHA256 of it with
 * the endpoint's signing secret (whsec_…), hex-encoded. More than one v1 appears
 * while a secret is being rolled; any one matching is enough. v0 is a test-mode
 * legacy scheme and is ignored.
 *
 * The body must be the RAW bytes as received — re-serialising parsed JSON changes
 * whitespace and breaks the signature, so the route reads `req.text()` first.
 *
 * The timestamp guards against replay: outside the tolerance (default 300 s, as
 * Stripe's own libraries use) the event is refused even with a valid signature.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_TOLERANCE_SECONDS = 300;

export type SignatureResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: "missing_header" | "missing_secret" | "malformed_header" | "timestamp_out_of_tolerance" | "no_matching_signature" };

/** Parse the header into its timestamp and v1 signatures. */
export function parseSignatureHeader(header: string): { timestamp: number | null; v1: string[] } {
  let timestamp: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d{1,12}$/.test(v)) timestamp = Number(v);
    else if (k === "v1" && /^[0-9a-f]{64}$/i.test(v)) v1.push(v.toLowerCase());
  }
  return { timestamp, v1 };
}

/** HMAC-SHA256 hex of `${timestamp}.${payload}` — what Stripe puts in v1. */
export function computeSignature(payload: string, timestamp: number, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
}

/** Build a header the way Stripe does. For tests and local replays only. */
export function signPayload(payload: string, secret: string, timestamp: number): string {
  return `t=${timestamp},v1=${computeSignature(payload, timestamp, secret)}`;
}

export function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string | null | undefined,
  opts: { toleranceSeconds?: number; nowSeconds?: number } = {},
): SignatureResult {
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!header) return { ok: false, reason: "missing_header" };
  const { timestamp, v1 } = parseSignatureHeader(header);
  if (timestamp === null || v1.length === 0) return { ok: false, reason: "malformed_header" };

  const tolerance = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (tolerance > 0 && Math.abs(now - timestamp) > tolerance) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = Buffer.from(computeSignature(payload, timestamp, secret), "hex");
  const match = v1.some((sig) => {
    const got = Buffer.from(sig, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  return match ? { ok: true, timestamp } : { ok: false, reason: "no_matching_signature" };
}
