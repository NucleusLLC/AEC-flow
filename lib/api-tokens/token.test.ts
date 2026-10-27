/**
 * Connected-app tokens: the shape, the hash the database is searched by, the
 * display prefix and the Bearer header parsing. Pure.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  API_TOKEN_NAME_MAX,
  apiTokenPrefix,
  bearerToken,
  cleanTokenName,
  generateApiToken,
  hashApiToken,
  isApiTokenShape,
} from "./token";

describe("generateApiToken", () => {
  it("is aecf_ + 32 random bytes in base64url (48 characters)", () => {
    const t = generateApiToken();
    expect(t).toMatch(/^aecf_[A-Za-z0-9_-]{43}$/);
    expect(t).toHaveLength(48);
    expect(isApiTokenShape(t)).toBe(true);
  });

  it("asks for exactly 32 bytes and encodes them without padding", () => {
    let asked = 0;
    const t = generateApiToken((n) => {
      asked = n;
      return Buffer.alloc(n, 0xff);
    });
    expect(asked).toBe(32);
    expect(t).toBe("aecf_" + Buffer.alloc(32, 0xff).toString("base64url"));
    expect(t).not.toContain("=");
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateApiToken()));
    expect(seen.size).toBe(200);
  });
});

describe("hashApiToken", () => {
  it("is the sha256 of the whole token, lowercase hex", () => {
    const t = generateApiToken();
    expect(hashApiToken(t)).toBe(createHash("sha256").update(t).digest("hex"));
    expect(hashApiToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for tokens that share a prefix", () => {
    const a = "aecf_" + "A".repeat(43);
    const b = "aecf_" + "A".repeat(42) + "B";
    expect(apiTokenPrefix(a)).toBe(apiTokenPrefix(b));
    expect(hashApiToken(a)).not.toBe(hashApiToken(b));
  });
});

describe("apiTokenPrefix", () => {
  it("keeps the first 12 characters: aecf_ + 7", () => {
    const t = generateApiToken();
    expect(apiTokenPrefix(t)).toBe(t.slice(0, 12));
    expect(apiTokenPrefix(t)).toHaveLength(12);
    expect(apiTokenPrefix(t).startsWith("aecf_")).toBe(true);
  });
});

describe("bearerToken", () => {
  const t = generateApiToken();

  it("reads a Bearer header, scheme in any case", () => {
    expect(bearerToken(`Bearer ${t}`)).toBe(t);
    expect(bearerToken(`bearer ${t}`)).toBe(t);
    expect(bearerToken(`  BEARER   ${t}  `)).toBe(t);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["no scheme", t],
    ["Basic", `Basic ${t}`],
    ["wrong prefix", `Bearer xxxx_${t.slice(5)}`],
    ["too short", `Bearer ${t.slice(0, -1)}`],
    ["too long", `Bearer ${t}A`],
    ["two tokens", `Bearer ${t} ${t}`],
    ["a pay token", `Bearer ${Buffer.alloc(32).toString("base64url")}`],
  ])("refuses %s", (_label, header) => {
    expect(bearerToken(header)).toBeNull();
  });
});

describe("cleanTokenName", () => {
  it("trims, folds whitespace and caps the length", () => {
    expect(cleanTokenName("  M.E.P.flow \n drafting PC ")).toBe("M.E.P.flow drafting PC");
    expect(cleanTokenName("x".repeat(500))).toHaveLength(API_TOKEN_NAME_MAX);
  });

  it("refuses empty and non-text", () => {
    expect(cleanTokenName("   ")).toBeNull();
    expect(cleanTokenName(undefined)).toBeNull();
    expect(cleanTokenName(42)).toBeNull();
  });
});
