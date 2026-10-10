import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeSignature, parseSignatureHeader, signPayload, verifyStripeSignature } from "./signature";

const SECRET = "whsec_test_secret_123";
const BODY = '{"id":"evt_1","type":"customer.subscription.updated","created":1760000000}';
const NOW = 1_760_000_000;

describe("Stripe webhook signature", () => {
  it("matches Stripe's scheme: HMAC-SHA256 hex of `${t}.${body}`", () => {
    const want = createHmac("sha256", SECRET).update(`${NOW}.${BODY}`).digest("hex");
    expect(computeSignature(BODY, NOW, SECRET)).toBe(want);
  });

  it("accepts a correctly signed payload inside the tolerance", () => {
    const header = signPayload(BODY, SECRET, NOW);
    expect(verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW + 10 })).toEqual({ ok: true, timestamp: NOW });
  });

  it("refuses a changed body, a wrong secret and a missing header or secret", () => {
    const header = signPayload(BODY, SECRET, NOW);
    expect(verifyStripeSignature(BODY + " ", header, SECRET, { nowSeconds: NOW })).toMatchObject({ ok: false, reason: "no_matching_signature" });
    expect(verifyStripeSignature(BODY, header, "whsec_other", { nowSeconds: NOW })).toMatchObject({ ok: false, reason: "no_matching_signature" });
    expect(verifyStripeSignature(BODY, null, SECRET)).toMatchObject({ ok: false, reason: "missing_header" });
    expect(verifyStripeSignature(BODY, header, "")).toMatchObject({ ok: false, reason: "missing_secret" });
  });

  it("refuses a replay outside the 300 s tolerance, either side", () => {
    const header = signPayload(BODY, SECRET, NOW);
    expect(verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW + 301 })).toMatchObject({ reason: "timestamp_out_of_tolerance" });
    expect(verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW - 301 })).toMatchObject({ reason: "timestamp_out_of_tolerance" });
    expect(verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW + 300 }).ok).toBe(true);
  });

  it("accepts any one of several v1 signatures (secret rolling) and ignores v0", () => {
    const good = computeSignature(BODY, NOW, SECRET);
    const header = `t=${NOW},v1=${"0".repeat(64)},v1=${good},v0=${"f".repeat(64)}`;
    expect(verifyStripeSignature(BODY, header, SECRET, { nowSeconds: NOW }).ok).toBe(true);
  });

  it("refuses malformed headers", () => {
    expect(verifyStripeSignature(BODY, "garbage", SECRET)).toMatchObject({ reason: "malformed_header" });
    expect(verifyStripeSignature(BODY, `t=${NOW}`, SECRET)).toMatchObject({ reason: "malformed_header" });
    expect(verifyStripeSignature(BODY, `v1=${"a".repeat(64)}`, SECRET)).toMatchObject({ reason: "malformed_header" });
    expect(verifyStripeSignature(BODY, `t=${NOW},v1=short`, SECRET)).toMatchObject({ reason: "malformed_header" });
  });

  it("parses the header parts", () => {
    expect(parseSignatureHeader(`t=12, v1=${"A".repeat(64)}`)).toEqual({ timestamp: 12, v1: ["a".repeat(64)] });
  });
});
