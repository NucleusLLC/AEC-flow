import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGAL_PATHS,
  PRIVACY_VERSION,
  TERMS_VERSION,
  formatVersionDate,
  termsAcceptance,
} from "./policy";

describe("legal versions", () => {
  it("are ISO dates that print as a plain English date", () => {
    expect(formatVersionDate(TERMS_VERSION)).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    expect(formatVersionDate(PRIVACY_VERSION)).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    expect(formatVersionDate("2026-10-01")).toBe("1 October 2026");
    expect(formatVersionDate("2027-01-31")).toBe("31 January 2027");
  });

  it("prints in the reader's locale without slipping a day", () => {
    expect(formatVersionDate("2026-10-01", "es-ES")).toBe("1 de octubre de 2026");
    expect(formatVersionDate("2026-10-01", "nl-NL")).toBe("1 oktober 2026");
  });

  it("refuses a version that is not a date", () => {
    expect(() => formatVersionDate("v2")).toThrow();
    expect(() => formatVersionDate("2026-13-01")).toThrow();
  });

  it("records when and which versions were accepted", () => {
    const at = new Date("2026-10-01T12:00:00Z");
    expect(termsAcceptance(at)).toEqual({
      termsAcceptedAt: "2026-10-01T12:00:00.000Z",
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    });
  });
});

describe("proxy", () => {
  const src = readFileSync(resolve(__dirname, "../../proxy.ts"), "utf8");

  it("leaves both pages out of the sign-in gate", () => {
    // The matcher is a literal (Next reads it statically), so check its text.
    const matcher = /matcher:\s*\["([^"]+)"\]/.exec(src)?.[1] ?? "";
    for (const p of Object.values(LEGAL_PATHS)) {
      expect(matcher).toContain(`|${p.slice(1)}|`);
    }
  });

  it("serves both pages on the beta host instead of bouncing to the portal", () => {
    expect(src).toMatch(/isLegalPath\(pathname\)/);
  });
});
