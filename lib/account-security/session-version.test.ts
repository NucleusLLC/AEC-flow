import { describe, expect, it } from "vitest";
import { tokenStillValid } from "./session-version";

describe("tokenStillValid", () => {
  const active = (v: number) => ({ status: "ACTIVE", sessionVersion: v });

  it("accepts a token issued under the current version", () => {
    expect(tokenStillValid(3, active(3))).toBe(true);
  });

  it("refuses a token from before a password change", () => {
    expect(tokenStillValid(2, active(3))).toBe(false);
  });

  it("treats a token from before this feature as version 0, so nobody is signed out by shipping it", () => {
    expect(tokenStillValid(undefined, active(0))).toBe(true);
    expect(tokenStillValid(undefined, active(1))).toBe(false);
  });

  it("refuses a deleted user", () => {
    expect(tokenStillValid(0, null)).toBe(false);
  });

  it("refuses a deactivated user even with a matching version", () => {
    expect(tokenStillValid(0, { status: "INACTIVE", sessionVersion: 0 })).toBe(false);
  });
});
