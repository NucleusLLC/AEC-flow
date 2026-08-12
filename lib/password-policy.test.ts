import { describe, it, expect } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_ADMIN_ROLES,
  canManagePasswords,
  validateNewPassword,
  validatePasswordConfirmation,
} from "./password-policy";

/** Terse helper — these assertions only ever care about the ok flag or the message. */
const err = (r: { ok: true } | { ok: false; error: string }) => (r.ok ? null : r.error);

describe("validateNewPassword — length", () => {
  it("accepts a password of exactly the minimum length", () => {
    expect(validateNewPassword("a".repeat(PASSWORD_MIN_LENGTH)).ok).toBe(true);
  });

  it("rejects one character below the minimum", () => {
    const r = validateNewPassword("a".repeat(PASSWORD_MIN_LENGTH - 1));
    expect(r.ok).toBe(false);
    expect(err(r)).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it("holds the minimum at 10 — the documented policy, not an accident", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
  });

  it("imposes NO maximum, so a long passphrase is allowed", () => {
    // Well past bcrypt's 72-byte input limit: truncation is the hash's business,
    // the policy must not reject the user's passphrase over it.
    expect(validateNewPassword("correct horse battery staple ".repeat(20)).ok).toBe(true);
    expect(validateNewPassword("x".repeat(4096)).ok).toBe(true);
  });
});

describe("validateNewPassword — empty and whitespace", () => {
  it("rejects an empty string", () => {
    expect(validateNewPassword("").ok).toBe(false);
  });

  it("rejects whitespace-only input even when it is long enough to pass the length rule", () => {
    for (const blank of [" ".repeat(20), "\t".repeat(12), "\n".repeat(15), " \t \n ".repeat(4)]) {
      const r = validateNewPassword(blank);
      expect(r.ok, JSON.stringify(blank)).toBe(false);
      expect(err(r)).toMatch(/only spaces/i);
    }
  });

  it("allows spaces INSIDE a passphrase, and counts them toward the length", () => {
    expect(validateNewPassword("two words!").ok).toBe(true); // 10 chars incl. the space
    expect(validateNewPassword("  padded passphrase  ").ok).toBe(true);
  });
});

describe("validateNewPassword — untrusted input", () => {
  it("rejects non-strings rather than trusting the declared type", () => {
    for (const bad of [null, undefined, 42, {}, [], true, Symbol("s")]) {
      expect(validateNewPassword(bad).ok, String(bad?.toString?.() ?? bad)).toBe(false);
    }
  });

  it("never throws on hostile input", () => {
    for (const bad of [NaN, Infinity, () => "x", new Date(), new Map()]) {
      expect(() => validateNewPassword(bad)).not.toThrow();
    }
  });
});

describe("validateNewPassword — no composition rules", () => {
  it("accepts long lowercase-only, digit-only and unicode passwords", () => {
    expect(validateNewPassword("abcdefghijkl").ok).toBe(true);
    expect(validateNewPassword("1234567890123").ok).toBe(true);
    expect(validateNewPassword("κωδικόςπρόσβασης").ok).toBe(true);
  });

  it("measures length in JS string units, which is what the input field reports", () => {
    // Documenting the behaviour rather than asserting a preference: an emoji is two
    // UTF-16 code units, so 6 emoji reads as 12 and passes. The 5-emoji case is 10.
    expect("🙂".length).toBe(2);
    expect(validateNewPassword("🙂".repeat(6)).ok).toBe(true);
  });
});

describe("validatePasswordConfirmation", () => {
  it("passes when both fields match and the password is valid", () => {
    expect(validatePasswordConfirmation("a-good-passphrase", "a-good-passphrase").ok).toBe(true);
  });

  it("reports a mismatch", () => {
    const r = validatePasswordConfirmation("a-good-passphrase", "a-good-passphras");
    expect(r.ok).toBe(false);
    expect(err(r)).toMatch(/do not match/i);
  });

  it("reports an unusable password BEFORE a mismatch, so the real problem surfaces first", () => {
    const r = validatePasswordConfirmation("short", "something else entirely");
    expect(err(r)).toContain(String(PASSWORD_MIN_LENGTH));
  });
});

describe("canManagePasswords — the role gate", () => {
  it("admits ADMIN and DIRECTOR", () => {
    expect(canManagePasswords("ADMIN", false)).toBe(true);
    expect(canManagePasswords("DIRECTOR", false)).toBe(true);
  });

  it("admits DIRECTOR specifically — the practice owner's own role", () => {
    // Regression guard: gating on ADMIN alone locks the owner out of his own feature.
    expect(PASSWORD_ADMIN_ROLES).toContain("DIRECTOR");
  });

  it("refuses every other role", () => {
    for (const role of ["MANAGER", "STAFF", "VIEWER"]) {
      expect(canManagePasswords(role, false), role).toBe(false);
    }
  });

  it("refuses an absent, empty or unrecognised role", () => {
    for (const role of [null, undefined, "", "admin", "Director", "SUPERUSER"]) {
      expect(canManagePasswords(role, false), String(role)).toBe(false);
    }
  });

  it("admits the founder whatever their role", () => {
    for (const role of [null, "VIEWER", "STAFF", "MANAGER", "ADMIN", "DIRECTOR"]) {
      expect(canManagePasswords(role, true), String(role)).toBe(true);
    }
  });
});
