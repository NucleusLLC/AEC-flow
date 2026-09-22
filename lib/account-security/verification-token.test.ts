import { describe, expect, it } from "vitest";
import {
  VERIFICATION_TOKEN_TTL_HOURS,
  generateVerificationToken,
  hashVerificationToken,
  isWellFormedVerificationToken,
  needsVerification,
  verificationLink,
  verificationTokenExpiry,
} from "./verification-token";

describe("verification tokens", () => {
  it("issues 43 base64url characters, and never the same one twice", () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("stores a hash, never the token", () => {
    const token = generateVerificationToken();
    const hash = hashVerificationToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashVerificationToken(token)).toBe(hash);
  });

  it("refuses anything not shaped like a token we issued, before any query", () => {
    expect(isWellFormedVerificationToken(generateVerificationToken())).toBe(true);
    expect(isWellFormedVerificationToken("short")).toBe(false);
    expect(isWellFormedVerificationToken("../../etc/passwd")).toBe(false);
    expect(isWellFormedVerificationToken("a".repeat(44))).toBe(false);
    expect(isWellFormedVerificationToken(undefined)).toBe(false);
    expect(isWellFormedVerificationToken(12345)).toBe(false);
  });

  it("lasts a week — long enough to be opened on Monday", () => {
    const now = new Date("2026-09-22T10:00:00.000Z");
    const days = (verificationTokenExpiry(now).getTime() - now.getTime()) / 86_400_000;
    expect(days).toBe(7);
    expect(VERIFICATION_TOKEN_TTL_HOURS).toBe(168);
  });
});

describe("the link", () => {
  it("is built from configuration, never from a request Host header", () => {
    expect(verificationLink({ NEXTAUTH_URL: "https://aec-flow.com" }, "t".repeat(43)))
      .toBe(`https://aec-flow.com/verify-email/${"t".repeat(43)}`);
  });

  it("tolerates a trailing slash and falls back to the public URL, then to production", () => {
    expect(verificationLink({ NEXTAUTH_URL: "https://aec-flow.com/" }, "x")).toBe("https://aec-flow.com/verify-email/x");
    expect(verificationLink({ NEXT_PUBLIC_APP_URL: "https://preview.example" }, "x")).toBe("https://preview.example/verify-email/x");
    expect(verificationLink({}, "x")).toBe("https://aec-flow.com/verify-email/x");
  });
});

describe("who is asked to confirm", () => {
  it("asks an account that never confirmed", () => {
    expect(needsVerification({ emailVerifiedAt: null, status: "ACTIVE" })).toBe(true);
  });

  it("stops asking once confirmed", () => {
    expect(needsVerification({ emailVerifiedAt: new Date(), status: "ACTIVE" })).toBe(false);
  });

  it("never nags a deactivated account", () => {
    expect(needsVerification({ emailVerifiedAt: null, status: "INACTIVE" })).toBe(false);
  });
});
