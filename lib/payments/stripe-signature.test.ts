import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  computeSignature,
  parseSignatureHeader,
  StripeSignatureError,
  verifyStripeSignature,
} from "./stripe-signature";

const SECRET = "whsec_test_secret";
const PAYLOAD = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
const NOW = 1_760_000_000;

function header(payload = PAYLOAD, t = NOW, secret = SECRET) {
  return `t=${t},v1=${computeSignature(payload, t, secret)}`;
}

describe("Stripe webhook signature", () => {
  it("computes Stripe's scheme: HMAC-SHA256 of `${t}.${body}`, hex", () => {
    const expected = createHmac("sha256", SECRET).update(`${NOW}.${PAYLOAD}`).digest("hex");
    expect(computeSignature(PAYLOAD, NOW, SECRET)).toBe(expected);
  });

  it("accepts a valid, fresh signature", () => {
    expect(() => verifyStripeSignature({ payload: PAYLOAD, header: header(), secret: SECRET, nowSeconds: NOW })).not.toThrow();
  });

  it("accepts any one matching v1 among several (secret roll), ignoring v0", () => {
    const h = `t=${NOW},v0=${"a".repeat(64)},v1=${"b".repeat(64)},v1=${computeSignature(PAYLOAD, NOW, SECRET)}`;
    expect(() => verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowSeconds: NOW })).not.toThrow();
  });

  it("rejects a body changed by one byte", () => {
    expect(() =>
      verifyStripeSignature({ payload: PAYLOAD + " ", header: header(), secret: SECRET, nowSeconds: NOW }),
    ).toThrow(StripeSignatureError);
  });

  it("rejects the wrong secret", () => {
    expect(() =>
      verifyStripeSignature({ payload: PAYLOAD, header: header(PAYLOAD, NOW, "whsec_other"), secret: SECRET, nowSeconds: NOW }),
    ).toThrow(StripeSignatureError);
  });

  it("rejects a replay older than the tolerance, and a timestamp far in the future", () => {
    expect(() =>
      verifyStripeSignature({ payload: PAYLOAD, header: header(PAYLOAD, NOW - 301), secret: SECRET, nowSeconds: NOW }),
    ).toThrow(/tolerance/);
    expect(() =>
      verifyStripeSignature({ payload: PAYLOAD, header: header(PAYLOAD, NOW + 301), secret: SECRET, nowSeconds: NOW }),
    ).toThrow(/tolerance/);
    // Exactly at the edge is still fine.
    expect(() =>
      verifyStripeSignature({ payload: PAYLOAD, header: header(PAYLOAD, NOW - 300), secret: SECRET, nowSeconds: NOW }),
    ).not.toThrow();
  });

  it("rejects a missing or malformed header, and a missing secret", () => {
    for (const h of [null, "", "garbage", `t=${NOW}`, `v1=${"a".repeat(64)}`, `t=abc,v1=${"a".repeat(64)}`]) {
      expect(() => verifyStripeSignature({ payload: PAYLOAD, header: h, secret: SECRET, nowSeconds: NOW })).toThrow(
        StripeSignatureError,
      );
    }
    expect(() => verifyStripeSignature({ payload: PAYLOAD, header: header(), secret: "", nowSeconds: NOW })).toThrow(
      /secret/,
    );
  });

  it("parses the header leniently but only keeps well-formed v1 values", () => {
    const p = parseSignatureHeader(` t=12 , v1=${"A".repeat(64)}, v1=short, x=1`);
    expect(p.timestamp).toBe(12);
    expect(p.v1).toEqual(["a".repeat(64)]);
  });
});
