import { describe, expect, it } from "vitest";
import {
  SHEET_TYPES,
  SHEET_TYPE_LABEL,
  classifySheetType,
  isConfidentClassification,
  normaliseForMatch,
} from "./sheet-type";

describe("normalising before matching", () => {
  it("folds case, accents and punctuation", () => {
    expect(normaliseForMatch("Sección A-A")).toBe("SECCION A A");
    expect(normaliseForMatch("  Ground   Floor Plan ")).toBe("GROUND FLOOR PLAN");
    expect(normaliseForMatch("")).toBe("");
  });
});

describe("English titles", () => {
  const cases: [string, string][] = [
    ["Ground Floor Plan", "FLOOR_PLAN"],
    ["Second Floor Plan", "FLOOR_PLAN"],
    ["Roof Plan", "ROOF_PLAN"],
    ["Reflected Ceiling Plan", "REFLECTED_CEILING_PLAN"],
    ["Site Plan", "SITE_PLAN"],
    ["North & South Elevations", "ELEVATION"],
    ["Cross Section A-A", "SECTION"],
    ["Typical Wall Details", "DETAIL"],
    ["Door Schedule", "SCHEDULE"],
    ["Electrical Riser Diagram", "DIAGRAM"],
    ["Foundation Plan", "FOUNDATION_PLAN"],
    ["Demolition Plan", "DEMOLITION"],
    ["Cover Sheet", "COVER"],
    ["General Notes & Abbreviations", "GENERAL_NOTES"],
  ];

  for (const [title, expected] of cases) {
    it(`reads "${title}" as ${expected}`, () => {
      const f = classifySheetType({ title });
      expect(f?.value).toBe(expected);
      expect(f && f.confidence).toBeGreaterThan(0.55);
    });
  }
});

describe("Dutch titles — the practice is in Aruba", () => {
  const cases: [string, string][] = [
    ["Plattegrond begane grond", "FLOOR_PLAN"],
    ["Doorsnede A-A", "SECTION"],
    ["Voorgevel en achtergevel", "ELEVATION"],
    ["Situatietekening", "SITE_PLAN"],
    ["Dakplan", "ROOF_PLAN"],
    ["Kozijnstaat", "SCHEDULE"],
    ["Funderingsplan", "FOUNDATION_PLAN"],
    ["Detailtekening kozijn", "DETAIL"],
  ];

  for (const [title, expected] of cases) {
    it(`reads "${title}" as ${expected}`, () => {
      expect(classifySheetType({ title })?.value).toBe(expected);
    });
  }
});

describe("Spanish titles", () => {
  const cases: [string, string][] = [
    ["Planta Baja", "FLOOR_PLAN"],
    ["Sección Transversal", "SECTION"],
    ["Fachada Principal", "ELEVATION"],
    ["Plano de Situación", "SITE_PLAN"],
    ["Planta de Techos", "ROOF_PLAN"],
    ["Detalles Constructivos", "DETAIL"],
  ];

  for (const [title, expected] of cases) {
    it(`reads "${title}" as ${expected}`, () => {
      expect(classifySheetType({ title })?.value).toBe(expected);
    });
  }
});

describe("the specific beats the general", () => {
  it("does not read 'Roof Plan' as a floor plan", () => {
    expect(classifySheetType({ title: "Roof Plan" })?.value).toBe("ROOF_PLAN");
  });

  it("does not read 'Reflected Ceiling Plan' as a floor plan", () => {
    expect(classifySheetType({ title: "Reflected Ceiling Plan" })?.value).toBe(
      "REFLECTED_CEILING_PLAN",
    );
  });

  it("does not read 'Site Plan' as a floor plan", () => {
    expect(classifySheetType({ title: "Overall Site Plan" })?.value).toBe("SITE_PLAN");
  });

  it("keeps the runner-up as an alternate when two families appear", () => {
    const f = classifySheetType({ title: "Sections and Elevations" });
    expect(f?.value).toBeTruthy();
    expect(f?.alternates.length).toBeGreaterThan(0);
  });
});

describe("evidence and confidence", () => {
  it("carries the phrase it matched, so a human can check the machine", () => {
    const f = classifySheetType({ title: "Ground Floor Plan" });
    expect(f?.evidence[0].fragment).toBe("FLOOR PLAN");
    expect(f?.evidence[0].pattern).toBe("sheet-type.floor_plan");
  });

  it("is more confident when the title block agrees with the title", () => {
    const alone = classifySheetType({ title: "Ground Floor Plan" })!;
    const corroborated = classifySheetType({
      title: "Ground Floor Plan",
      titleBlockText: "SHEET TITLE: GROUND FLOOR PLAN   SCALE 1:100",
    })!;
    expect(corroborated.confidence).toBeGreaterThan(alone.confidence);
  });

  it("falls back to the filename when nothing else was read", () => {
    const f = classifySheetType({ filename: "A-201-north-elevation-rev-B.pdf" });
    expect(f?.value).toBe("ELEVATION");
    expect(f?.evidence[0].source).toBe("filename");
  });
});

describe("the sheet-number series is a hint, never a verdict", () => {
  it("proposes a type from the series when there is no wording at all", () => {
    const f = classifySheetType({ sheetNumber: "A-301" });
    expect(f?.value).toBe("SECTION");
    // Low band on purpose: this is a numbering convention, not a reading.
    expect(f?.band).toBe("low");
    expect(f?.evidence[0].note).toMatch(/convention/i);
  });

  it("loses to the words on the sheet when the two disagree", () => {
    const f = classifySheetType({ title: "Ground Floor Plan", sheetNumber: "A-301" });
    expect(f?.value).toBe("FLOOR_PLAN");
  });

  it("ignores a sheet number that carries no series digit", () => {
    expect(classifySheetType({ sheetNumber: "SK-7" })).toBeNull();
  });
});

describe("saying 'I do not know'", () => {
  it("returns null rather than guessing OTHER", () => {
    expect(classifySheetType({ title: "Sheet 04", sheetNumber: "" })).toBeNull();
    expect(classifySheetType({})).toBeNull();
    expect(classifySheetType({ title: "", titleBlockText: "   " })).toBeNull();
  });

  it("is the signal that decides whether a model is worth asking", () => {
    expect(isConfidentClassification(null)).toBe(false);
    expect(isConfidentClassification(classifySheetType({ sheetNumber: "A-101" }))).toBe(false);
    expect(
      isConfidentClassification(
        classifySheetType({
          title: "Ground Floor Plan",
          titleBlockText: "GROUND FLOOR PLAN",
        }),
      ),
    ).toBe(true);
  });
});

describe("every value has something to render", () => {
  it("labels every type, and never shows the raw code", () => {
    for (const t of SHEET_TYPES) {
      expect(SHEET_TYPE_LABEL[t], t).toBeTruthy();
      expect(SHEET_TYPE_LABEL[t]).not.toBe(t);
    }
  });
});
