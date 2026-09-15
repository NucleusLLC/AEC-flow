import { describe, it, expect } from "vitest";
import {
  RESET_TOKEN_TTL_MINUTES,
  generateResetToken,
  hashResetToken,
  isWellFormedResetToken,
  resetLink,
  resetTokenExpiry,
} from "./reset-token";

describe("generateResetToken", () => {
  it("produces well-formed, distinct tokens", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(isWellFormedResetToken(a)).toBe(true);
    expect(isWellFormedResetToken(b)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("hashResetToken", () => {
  it("is deterministic hex sha256 and never echoes the token", () => {
    const t = generateResetToken();
    expect(hashResetToken(t)).toBe(hashResetToken(t));
    expect(hashResetToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(t)).not.toContain(t);
  });
});

describe("isWellFormedResetToken", () => {
  it("rejects anything that is not a 43-char base64url string", () => {
    for (const bad of [undefined, null, 42, "", "short", "a".repeat(44), `${"a".repeat(42)}=`, `${"a".repeat(42)}/`]) {
      expect(isWellFormedResetToken(bad)).toBe(false);
    }
  });
});

describe("resetTokenExpiry", () => {
  it("adds the TTL", () => {
    const now = new Date("2026-09-14T12:00:00Z");
    expect(resetTokenExpiry(now).getTime() - now.getTime()).toBe(RESET_TOKEN_TTL_MINUTES * 60_000);
  });
});

describe("resetLink", () => {
  it("builds from configuration and strips trailing slashes", () => {
    expect(resetLink({ NEXTAUTH_URL: "https://aec-flow.com/" }, "tok")).toBe("https://aec-flow.com/reset-password/tok");
  });

  it("falls back through NEXT_PUBLIC_APP_URL to the production origin", () => {
    expect(resetLink({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, "tok")).toBe("http://localhost:3000/reset-password/tok");
    expect(resetLink({ NEXTAUTH_URL: "  " }, "tok")).toBe("https://aec-flow.com/reset-password/tok");
  });
});
