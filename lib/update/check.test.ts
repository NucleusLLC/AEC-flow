import { describe, expect, it } from "vitest";
import { CHECK_EVERY_MS, FIRST_CHECK_MS, MIN_GAP_MS, dueForCheck, parseRelease, releaseId, updateAvailable } from "./check";

const running = { version: "0.25.13", build: "8c82237" };

describe("updateAvailable", () => {
  it("is quiet while the tab runs what is deployed", () => {
    expect(updateAvailable(running, { ...running })).toBe(false);
    expect(updateAvailable(running, { version: " 0.25.13 ", build: "8c82237 " })).toBe(false);
  });

  it("speaks up when a newer version is deployed", () => {
    expect(updateAvailable(running, { version: "0.25.14", build: "aaaaaaa" })).toBe(true);
  });

  it("speaks up for a new deploy of the same version, and for a rollback", () => {
    expect(updateAvailable(running, { version: "0.25.13", build: "bbbbbbb" })).toBe(true);
    expect(updateAvailable(running, { version: "0.25.12", build: "385ad32" })).toBe(true);
  });

  it("compares on version alone when either side has no build id", () => {
    expect(updateAvailable({ version: "0.25.13", build: "" }, { version: "0.25.13", build: "8c82237" })).toBe(false);
    expect(updateAvailable(running, { version: "0.25.13", build: "" })).toBe(false);
    expect(updateAvailable({ version: "0.25.13", build: "" }, { version: "0.25.14", build: "" })).toBe(true);
  });

  it("stays quiet when it could not tell", () => {
    expect(updateAvailable(running, null)).toBe(false);
    expect(updateAvailable({ version: "", build: "" }, { version: "0.25.14", build: "x" })).toBe(false);
  });
});

describe("parseRelease", () => {
  it("reads the answer of /api/version", () => {
    expect(parseRelease({ version: "0.25.14", build: "abc1234" })).toEqual({ version: "0.25.14", build: "abc1234" });
    expect(parseRelease({ version: "0.25.14" })).toEqual({ version: "0.25.14", build: "" });
  });

  it("refuses anything that is not that answer", () => {
    for (const body of [null, undefined, "<!doctype html>", 7, [], {}, { version: 25 }, { version: "latest" }, { build: "abc" }]) {
      expect(parseRelease(body)).toBeNull();
    }
  });

  it("clamps what it accepts", () => {
    const long = parseRelease({ version: "1.2.3" + "x".repeat(200), build: "b".repeat(200) })!;
    expect(long.version).toHaveLength(64);
    expect(long.build).toHaveLength(64);
  });
});

describe("releaseId and the timing", () => {
  it("names a release by version and build", () => {
    expect(releaseId(running)).toBe("0.25.13+8c82237");
    expect(releaseId({ version: "0.25.13", build: "" })).toBe("0.25.13");
  });

  it("asks once a minute at most, however often the tab is focused", () => {
    expect(dueForCheck(0, 1_000)).toBe(true);
    expect(dueForCheck(1_000, 1_000 + MIN_GAP_MS - 1)).toBe(false);
    expect(dueForCheck(1_000, 1_000 + MIN_GAP_MS)).toBe(true);
    expect(dueForCheck(Number.NaN, 5)).toBe(true);
  });

  it("checks soon after opening and then every few minutes, never in a tight loop", () => {
    expect(FIRST_CHECK_MS).toBeGreaterThanOrEqual(30_000);
    expect(CHECK_EVERY_MS).toBeGreaterThanOrEqual(MIN_GAP_MS);
  });
});
