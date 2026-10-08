import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_ERRORS,
  DEVELOPMENT_TYPES,
  DEVELOPMENT_TYPE_LABEL,
  DEVELOPMENT_TYPE_OPTION,
  checkDevelopment,
  cleanDevelopment,
  developmentTag,
  isDevelopmentType,
} from "./development";

describe("DEVELOPMENT_TYPES", () => {
  it("lists the six types in the owner's order", () => {
    expect(DEVELOPMENT_TYPES).toEqual(["HOUSING", "CONDO_APARTMENT", "TOWN_HOMES", "RESORT", "PARCELING", "OTHER"]);
  });
  it("has a capital option and a tag label for every type", () => {
    for (const d of DEVELOPMENT_TYPES) {
      expect(DEVELOPMENT_TYPE_OPTION[d]).toBe(DEVELOPMENT_TYPE_OPTION[d].toUpperCase());
      expect(DEVELOPMENT_TYPE_LABEL[d].length).toBeGreaterThan(0);
    }
    expect(DEVELOPMENT_TYPE_OPTION.CONDO_APARTMENT).toBe("CONDO / APARTMENT");
  });
  it("recognises only the six", () => {
    expect(isDevelopmentType("RESORT")).toBe(true);
    expect(isDevelopmentType("resort")).toBe(false);
    expect(isDevelopmentType("")).toBe(false);
    expect(isDevelopmentType(null)).toBe(false);
  });
});

describe("developmentTag", () => {
  it("is null when the project is not a development", () => {
    expect(developmentTag(null, null)).toBeNull();
    expect(developmentTag(undefined, "Marina Lofts")).toBeNull();
  });
  it("names the type", () => {
    expect(developmentTag("HOUSING", null)).toBe("Development · Housing");
    expect(developmentTag("CONDO_APARTMENT", null)).toBe("Development · Condo / Apartment");
    expect(developmentTag("TOWN_HOMES", "ignored")).toBe("Development · Town Homes");
  });
  it("shows the typed type for OTHER", () => {
    expect(developmentTag("OTHER", "  Marina   Lofts ")).toBe("Development · Marina Lofts");
    expect(developmentTag("OTHER", "")).toBe("Development · Other");
  });
  it("translates the fixed parts, never the typed text", () => {
    const t = (s: string) => ({ Development: "Desarrollo", Resort: "Resort", Other: "Otro" })[s] ?? `?${s}`;
    expect(developmentTag("RESORT", null, t)).toBe("Desarrollo · Resort");
    expect(developmentTag("OTHER", "Marina Lofts", t)).toBe("Desarrollo · Marina Lofts");
  });
});

describe("checkDevelopment", () => {
  it("clears both when the box is not ticked", () => {
    expect(checkDevelopment({ ticked: false, type: "OTHER", other: "Marina Lofts" })).toEqual({
      ok: true,
      developmentType: null,
      developmentTypeOther: null,
    });
  });
  it("refuses a ticked box with no type", () => {
    expect(checkDevelopment({ ticked: true, type: "", other: null })).toEqual({ ok: false, error: DEVELOPMENT_ERRORS.type });
    expect(checkDevelopment({ ticked: true, type: "MALL", other: null })).toEqual({ ok: false, error: DEVELOPMENT_ERRORS.type });
  });
  it("drops the typed text for a listed type", () => {
    expect(checkDevelopment({ ticked: true, type: "PARCELING", other: "left over" })).toEqual({
      ok: true,
      developmentType: "PARCELING",
      developmentTypeOther: null,
    });
  });
  it("needs the typed type for OTHER", () => {
    expect(checkDevelopment({ ticked: true, type: "OTHER", other: "   " })).toEqual({ ok: false, error: DEVELOPMENT_ERRORS.other });
    expect(checkDevelopment({ ticked: true, type: "OTHER", other: " Marina  Lofts " })).toEqual({
      ok: true,
      developmentType: "OTHER",
      developmentTypeOther: "Marina Lofts",
    });
  });
  it("holds the typed type to 80 characters", () => {
    expect(checkDevelopment({ ticked: true, type: "OTHER", other: "x".repeat(80) }).ok).toBe(true);
    expect(checkDevelopment({ ticked: true, type: "OTHER", other: "x".repeat(81) })).toEqual({
      ok: false,
      error: DEVELOPMENT_ERRORS.tooLong,
    });
  });
});

describe("cleanDevelopment", () => {
  it("treats no type as not a development", () => {
    expect(cleanDevelopment(null, "Marina Lofts")).toEqual({ developmentType: null, developmentTypeOther: null });
    expect(cleanDevelopment("", null)).toEqual({ developmentType: null, developmentTypeOther: null });
  });
  it("keeps a valid type", () => {
    expect(cleanDevelopment("OTHER", "Marina Lofts")).toEqual({ developmentType: "OTHER", developmentTypeOther: "Marina Lofts" });
  });
  it("throws the sentence the user reads", () => {
    expect(() => cleanDevelopment("OTHER", "")).toThrow(DEVELOPMENT_ERRORS.other);
    expect(() => cleanDevelopment("MALL", null)).toThrow(DEVELOPMENT_ERRORS.type);
  });
});
