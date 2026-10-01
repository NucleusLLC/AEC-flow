import { describe, expect, it } from "vitest";
import {
  checkCellNumber,
  firstNewClientError,
  NEW_CLIENT_MESSAGES as M,
  validateNewClient,
} from "./new-client";

describe("validateNewClient", () => {
  it("accepts name, email and cell, and returns them cleaned", () => {
    expect(
      validateNewClient({ name: "  Emaar  ", email: " projects@emaar.ae ", mobile: " +297  560 0000 " }),
    ).toEqual({ ok: true, name: "Emaar", email: "projects@emaar.ae", mobile: "+297 560 0000" });
  });

  it("marks all three fields when everything is blank", () => {
    expect(validateNewClient({})).toEqual({
      ok: false,
      errors: { name: M.nameRequired, email: M.emailRequired, mobile: M.mobileRequired },
    });
    expect(validateNewClient({ name: "  ", email: "  ", mobile: " " })).toEqual({
      ok: false,
      errors: { name: M.nameRequired, email: M.emailRequired, mobile: M.mobileRequired },
    });
  });

  it("refuses a malformed email", () => {
    for (const email of ["nobody", "a@b", "a@@b.com", "a b@c.com"]) {
      const r = validateNewClient({ name: "X", email, mobile: "5600000" });
      expect(r).toEqual({ ok: false, errors: { email: M.emailInvalid } });
    }
  });

  it("accepts two addresses (the shared recipient parser), de-duplicated and unwrapped", () => {
    const r = validateNewClient({
      name: "Couple",
      email: "Her <her@x.com>; him@x.com, HER@x.com",
      mobile: "560 0000",
    });
    expect(r).toEqual({ ok: true, name: "Couple", email: "her@x.com, him@x.com", mobile: "560 0000" });
  });

  it("refuses more addresses than the recipient limit", () => {
    const email = ["a", "b", "c", "d", "e", "f"].map((x) => `${x}@x.com`).join(",");
    expect(validateNewClient({ name: "X", email, mobile: "5600000" })).toEqual({
      ok: false,
      errors: { email: M.emailInvalid },
    });
  });

  it("names the first failing field in form order", () => {
    expect(firstNewClientError({ mobile: M.mobileShort, email: M.emailInvalid })).toBe(M.emailInvalid);
    expect(firstNewClientError({})).toBeUndefined();
  });
});

describe("checkCellNumber", () => {
  it("accepts digits with spaces, dashes, brackets and one leading +", () => {
    for (const n of ["5600000", "+297 560 0000", "(297) 560-0000", "+1 (305) 555-0101", "00297 5600000"]) {
      expect(checkCellNumber(n)).toEqual({ ok: true, mobile: n });
    }
  });

  it("refuses letters, a + anywhere but the front, and other punctuation", () => {
    for (const n of ["560 ABCD", "297+5600000", "++2975600000", "560.0000", "560/0000", "ext 12345678"]) {
      expect(checkCellNumber(n)).toEqual({ ok: false, error: M.mobileChars });
    }
  });

  it("needs at least 7 digits, not 7 characters", () => {
    expect(checkCellNumber("560000")).toEqual({ ok: false, error: M.mobileShort });
    expect(checkCellNumber("+(5) 6-0 0-0 0")).toEqual({ ok: false, error: M.mobileShort });
    expect(checkCellNumber("5-6-0-0-0-0-0")).toEqual({ ok: true, mobile: "5-6-0-0-0-0-0" });
  });

  it("requires a value", () => {
    expect(checkCellNumber(null)).toEqual({ ok: false, error: M.mobileRequired });
    expect(checkCellNumber("   ")).toEqual({ ok: false, error: M.mobileRequired });
  });
});
