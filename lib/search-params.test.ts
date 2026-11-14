import { describe, expect, it } from "vitest";
import { paramList } from "./search-params";

describe("paramList", () => {
  it("reads a repeated key, as a GET form with several ticked boxes sends it", () => {
    expect(paramList(["m1", "m2"])).toEqual(["m1", "m2"]);
  });

  it("reads a single value", () => {
    expect(paramList("m1")).toEqual(["m1"]);
  });

  it("splits comma-separated values, in either shape", () => {
    expect(paramList("m1,m2")).toEqual(["m1", "m2"]);
    expect(paramList(["m1,m2", "m3"])).toEqual(["m1", "m2", "m3"]);
  });

  it("returns nothing for a missing or empty param", () => {
    expect(paramList(undefined)).toEqual([]);
    expect(paramList(null)).toEqual([]);
    expect(paramList("")).toEqual([]);
    expect(paramList([" ", ","])).toEqual([]);
  });
});
