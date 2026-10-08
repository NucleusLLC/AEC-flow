import { describe, expect, it } from "vitest";
import {
  ARCHITECTURE_ERRORS,
  ARCHITECTURE_TYPES,
  ARCHITECTURE_TYPE_LABEL,
  ARCHITECTURE_TYPE_OPTION,
  architectureTag,
  checkArchitecture,
  cleanArchitecture,
  isArchitectureType,
} from "./architecture-type";

describe("ARCHITECTURE_TYPES", () => {
  it("lists the nine types in the owner's order", () => {
    expect(ARCHITECTURE_TYPES).toEqual([
      "SINGLE_FAMILY_HOME",
      "MANSION",
      "COMMERCIAL_BUILDING",
      "RETAIL_BUILDING",
      "APARTMENT_CONDO_BUILDING",
      "APARTMENT",
      "SCHOOL",
      "RESORT",
      "OTHER",
    ]);
  });
  it("has a capital option and a tag label for every type", () => {
    for (const a of ARCHITECTURE_TYPES) {
      expect(ARCHITECTURE_TYPE_OPTION[a]).toBe(ARCHITECTURE_TYPE_OPTION[a].toUpperCase());
      expect(ARCHITECTURE_TYPE_LABEL[a].length).toBeGreaterThan(0);
    }
    expect(ARCHITECTURE_TYPE_OPTION.APARTMENT_CONDO_BUILDING).toBe("APARTMENT / CONDO BUILDING");
    expect(ARCHITECTURE_TYPE_OPTION.RETAIL_BUILDING).toBe("RETAIL BUILDING");
  });
  it("recognises only the nine", () => {
    expect(isArchitectureType("MANSION")).toBe(true);
    expect(isArchitectureType("mansion")).toBe(false);
    expect(isArchitectureType("HOUSING")).toBe(false);
    expect(isArchitectureType("")).toBe(false);
    expect(isArchitectureType(null)).toBe(false);
  });
});

describe("architectureTag", () => {
  it("is null when no type is set (the plain Architecture tag shows)", () => {
    expect(architectureTag(null, null)).toBeNull();
    expect(architectureTag(undefined, "Beach Pavilion")).toBeNull();
  });
  it("names the type", () => {
    expect(architectureTag("SINGLE_FAMILY_HOME", null)).toBe("Architecture · Single Family Home");
    expect(architectureTag("APARTMENT_CONDO_BUILDING", null)).toBe("Architecture · Apartment / Condo Building");
    expect(architectureTag("MANSION", "ignored")).toBe("Architecture · Mansion");
  });
  it("shows the typed type for OTHER, as typed", () => {
    expect(architectureTag("OTHER", " Beach Pavilion ")).toBe("Architecture · Beach Pavilion");
    expect(architectureTag("OTHER", "beach  PAVILION")).toBe("Architecture · beach  PAVILION");
    expect(architectureTag("OTHER", "")).toBe("Architecture · Other");
  });
  it("translates the fixed parts, never the typed text", () => {
    const t = (s: string) => ({ Architecture: "Arquitectura", School: "Escuela" })[s] ?? `?${s}`;
    expect(architectureTag("SCHOOL", null, t)).toBe("Arquitectura · Escuela");
    expect(architectureTag("OTHER", "Beach Pavilion", t)).toBe("Arquitectura · Beach Pavilion");
  });
});

describe("checkArchitecture", () => {
  it("clears both when the box is not ticked", () => {
    expect(checkArchitecture({ ticked: false, type: "OTHER", other: "Beach Pavilion" })).toEqual({
      ok: true,
      architectureType: null,
      architectureTypeOther: null,
    });
  });
  it("refuses a ticked box with no type", () => {
    expect(checkArchitecture({ ticked: true, type: "", other: null })).toEqual({ ok: false, error: ARCHITECTURE_ERRORS.type });
    expect(checkArchitecture({ ticked: true, type: "CASTLE", other: null })).toEqual({ ok: false, error: ARCHITECTURE_ERRORS.type });
  });
  it("drops the typed text for a listed type", () => {
    expect(checkArchitecture({ ticked: true, type: "RESORT", other: "left over" })).toEqual({
      ok: true,
      architectureType: "RESORT",
      architectureTypeOther: null,
    });
  });
  it("needs the typed type for OTHER and keeps it as typed", () => {
    expect(checkArchitecture({ ticked: true, type: "OTHER", other: "   " })).toEqual({ ok: false, error: ARCHITECTURE_ERRORS.other });
    expect(checkArchitecture({ ticked: true, type: "OTHER", other: " Beach  Pavilion " })).toEqual({
      ok: true,
      architectureType: "OTHER",
      architectureTypeOther: "Beach  Pavilion",
    });
  });
  it("holds the typed type to 80 characters", () => {
    expect(checkArchitecture({ ticked: true, type: "OTHER", other: "x".repeat(80) }).ok).toBe(true);
    expect(checkArchitecture({ ticked: true, type: "OTHER", other: "x".repeat(81) })).toEqual({
      ok: false,
      error: ARCHITECTURE_ERRORS.tooLong,
    });
  });
});

describe("cleanArchitecture", () => {
  it("clears both when ARCHITECTURE is not a discipline", () => {
    expect(cleanArchitecture(["STRUCTURAL"], "MANSION", null, "update")).toEqual({
      architectureType: null,
      architectureTypeOther: null,
    });
    expect(cleanArchitecture(undefined, undefined, undefined, "create")).toEqual({
      architectureType: null,
      architectureTypeOther: null,
    });
    expect(cleanArchitecture([], undefined, undefined, "update")).toEqual({
      architectureType: null,
      architectureTypeOther: null,
    });
  });
  it("leaves the saved type alone when an update does not send one", () => {
    expect(cleanArchitecture(["ARCHITECTURE"], undefined, undefined, "update")).toBeNull();
  });
  it("requires the type when ARCHITECTURE is ticked", () => {
    expect(() => cleanArchitecture(["ARCHITECTURE"], undefined, undefined, "create")).toThrow(ARCHITECTURE_ERRORS.type);
    expect(() => cleanArchitecture(["ARCHITECTURE"], null, null, "update")).toThrow(ARCHITECTURE_ERRORS.type);
    expect(() => cleanArchitecture(["ARCHITECTURE"], "", null, "create")).toThrow(ARCHITECTURE_ERRORS.type);
  });
  it("keeps a valid type and throws the sentence the user reads for OTHER", () => {
    expect(cleanArchitecture(["ARCHITECTURE", "MEP"], "OTHER", "Beach Pavilion", "create")).toEqual({
      architectureType: "OTHER",
      architectureTypeOther: "Beach Pavilion",
    });
    expect(() => cleanArchitecture(["ARCHITECTURE"], "OTHER", "", "update")).toThrow(ARCHITECTURE_ERRORS.other);
  });
});
