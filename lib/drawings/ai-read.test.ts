import { describe, expect, it } from "vitest";
import {
  AI_MAX_CONFIDENCE,
  AI_READ_SCHEMA,
  aiReadToDraft,
  aiSheetType,
  buildAiReadPrompt,
  mergeAiRead,
  normaliseIsoDate,
  normaliseSheetNumber,
  parseAiRead,
  sameReading,
} from "./ai-read";
import { extractFromTitleBlockText } from "./titleblock";
import { EMPTY_DRAFT, field } from "./types";

const MODEL = "test-model";

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    sheetNumber: { value: "a-204", confidence: 0.95, evidence: "SHEET A-204" },
    title: { value: "Second Floor Plan", confidence: 0.9, evidence: "SECOND FLOOR PLAN" },
    sheetType: { value: "FLOOR_PLAN", confidence: 0.9 },
    discipline: { value: "ARCHITECTURAL", confidence: 0.8 },
    revision: { value: "Rev C", confidence: 0.85, evidence: "REV C" },
    revisionDate: { value: "2026-03-14", confidence: 0.7, evidence: "14-03-2026" },
    projectName: { value: "Marina Heights Tower", confidence: 0.9, evidence: "MARINA HEIGHTS TOWER" },
    projectNumber: { value: "za-2026-121", confidence: 0.9, evidence: "PROJECT NO ZA-2026-121" },
    architect: { value: "ZenArch Studio", confidence: 0.9, evidence: "ARCHITECT ZenArch Studio" },
    engineer: { value: "Rossi & Partners", confidence: 0.6, evidence: "STRUCTURAL ENGINEER Rossi & Partners" },
    scale: { value: "1:100", confidence: 0.9, evidence: "SCALE 1:100" },
    notes: "",
    ...over,
  });

describe("parseAiRead", () => {
  it("reads a well-formed answer, including JSON wrapped in prose", () => {
    const read = parseAiRead(`Here you go:\n${answer()}\nDone.`);
    expect(read).not.toBeNull();
    expect(read!.sheetNumber.value).toBe("a-204");
    expect(read!.sheetType.value).toBe("FLOOR_PLAN");
    expect(read!.engineer.confidence).toBe(0.6);
  });

  it("returns null for anything that is not a JSON object", () => {
    expect(parseAiRead("")).toBeNull();
    expect(parseAiRead("I cannot read this sheet.")).toBeNull();
    expect(parseAiRead("[1,2]")).toBeNull();
  });

  it("treats a missing or garbage field as unread rather than throwing", () => {
    const read = parseAiRead(answer({ architect: "nope", sheetType: { value: "BANANA", confidence: 1 }, revision: null }));
    expect(read!.architect).toEqual({ value: null, confidence: 0, evidence: null });
    expect(read!.sheetType).toEqual({ value: null, confidence: 0 });
    expect(read!.revision.value).toBeNull();
  });

  it("clamps confidence into 0..1 and zeroes it when there is no value", () => {
    const read = parseAiRead(answer({ title: { value: "X Y", confidence: 7, evidence: null }, scale: { value: null, confidence: 0.9, evidence: null } }));
    expect(read!.title.confidence).toBe(1);
    expect(read!.scale.confidence).toBe(0);
  });
});

describe("aiReadToDraft", () => {
  it("normalises the sheet number, project number and revision token", () => {
    const draft = aiReadToDraft(parseAiRead(answer())!, MODEL);
    expect(draft.sheetNumber?.value).toBe("A-204");
    expect(draft.projectNumber?.value).toBe("ZA-2026-121");
    expect(draft.revision?.value).toBe("C");
    expect(draft.issueDate?.value).toBe("2026-03-14");
    expect(draft.architect?.value).toBe("ZenArch Studio");
    expect(draft.engineer?.value).toBe("Rossi & Partners");
  });

  it("caps the model's confidence below a labelled rules hit", () => {
    const draft = aiReadToDraft(parseAiRead(answer())!, MODEL);
    expect(draft.sheetNumber?.confidence).toBe(AI_MAX_CONFIDENCE);
    expect(draft.sheetNumber?.band).toBe("high");
    expect(draft.engineer?.band).toBe("medium");
  });

  it("drops a value the model was not sure of instead of proposing it", () => {
    const draft = aiReadToDraft(parseAiRead(answer({ engineer: { value: "Maybe Ltd", confidence: 0.2, evidence: null } }))!, MODEL);
    expect(draft.engineer).toBeNull();
  });

  it("refuses an impossible date and an unrecognisable revision", () => {
    const draft = aiReadToDraft(
      parseAiRead(answer({ revisionDate: { value: "2026-02-30", confidence: 0.9, evidence: "30/02/26" }, revision: { value: "latest", confidence: 0.9, evidence: null } }))!,
      MODEL,
    );
    expect(draft.issueDate).toBeNull();
    expect(draft.revision).toBeNull();
  });

  it("carries the evidence string so the form can show where a value came from", () => {
    const draft = aiReadToDraft(parseAiRead(answer())!, MODEL);
    expect(draft.architect?.evidence[0]).toMatchObject({ source: "ai-read", pattern: "ai.architect", fragment: "ARCHITECT ZenArch Studio" });
    expect(draft.architect?.evidence[0].note).toContain(MODEL);
  });

  it("falls back to the sheet prefix for the discipline when the model had none", () => {
    const draft = aiReadToDraft(parseAiRead(answer({ discipline: { value: null, confidence: 0 }, sheetNumber: { value: "S-201", confidence: 0.9, evidence: null } }))!, MODEL);
    expect(draft.discipline?.value).toBe("STRUCTURAL");
  });

  it("surfaces the model's note as a warning", () => {
    const draft = aiReadToDraft(parseAiRead(answer({ notes: "Two revision dates are printed." }))!, MODEL);
    expect(draft.warnings).toContain("AI: Two revision dates are printed.");
  });

  it("gives the sheet type as a capped field", () => {
    const f = aiSheetType(parseAiRead(answer())!, MODEL);
    expect(f?.value).toBe("FLOOR_PLAN");
    expect(f?.confidence).toBe(AI_MAX_CONFIDENCE);
    expect(aiSheetType(parseAiRead(answer({ sheetType: { value: null, confidence: 0 } }))!, MODEL)).toBeNull();
  });
});

describe("mergeAiRead", () => {
  const rules = extractFromTitleBlockText(["SHEET NO. A-204", "SHEET TITLE Second Floor Plan", "REV C", "DATE 14-03-2026"].join("\n"));

  it("raises confidence and keeps both evidences when the two readers agree", () => {
    const ai = aiReadToDraft(parseAiRead(answer())!, MODEL);
    const merged = mergeAiRead(rules, ai);
    expect(merged.sheetNumber?.value).toBe("A-204");
    expect(merged.sheetNumber!.confidence).toBeGreaterThan(rules.sheetNumber!.confidence);
    expect(merged.sheetNumber!.evidence.map((e) => e.source)).toEqual(["titleblock-label", "ai-read"]);
    expect(merged.warnings.some((w) => w.includes("disagree"))).toBe(false);
  });

  it("lets a labelled rules hit win a disagreement, keeps the AI value as an alternate, and warns", () => {
    const ai = aiReadToDraft(parseAiRead(answer({ sheetNumber: { value: "A-205", confidence: 0.95, evidence: null } }))!, MODEL);
    const merged = mergeAiRead(rules, ai);
    expect(merged.sheetNumber?.value).toBe("A-204");
    expect(merged.sheetNumber?.alternates[0]?.value).toBe("A-205");
    expect(merged.warnings.some((w) => w.includes("sheetNumber") && w.includes("A-205"))).toBe(true);
  });

  it("lets a confident AI reading win over a blind-scan rules guess", () => {
    const weakRules = { ...EMPTY_DRAFT, warnings: [], revision: field("B", 0.5, [{ source: "titleblock-scan" as const, pattern: "x", fragment: "B" }]) };
    const ai = aiReadToDraft(parseAiRead(answer())!, MODEL);
    const merged = mergeAiRead(weakRules, ai);
    expect(merged.revision?.value).toBe("C");
    expect(merged.revision?.alternates[0]?.value).toBe("B");
  });

  it("fills what the rules could not read — the scan case", () => {
    const ai = aiReadToDraft(parseAiRead(answer())!, MODEL);
    const merged = mergeAiRead({ ...EMPTY_DRAFT, warnings: ["no text layer"] }, ai);
    expect(merged.sheetNumber?.value).toBe("A-204");
    expect(merged.architect?.value).toBe("ZenArch Studio");
    expect(merged.discipline?.value).toBe("ARCHITECTURAL");
    expect(merged.warnings).toContain("no text layer");
  });

  it("is the rules draft when there is no AI draft", () => {
    expect(mergeAiRead(rules, null)).toBe(rules);
  });
});

describe("helpers", () => {
  it("sameReading ignores case and punctuation", () => {
    expect(sameReading("GROUND FLOOR PLAN", "Ground floor plan")).toBe(true);
    expect(sameReading("A-204", "a 204")).toBe(true);
    expect(sameReading("A-204", "A-205")).toBe(false);
  });

  it("normaliseIsoDate accepts real dates only", () => {
    expect(normaliseIsoDate("2026-3-4")).toBe("2026-03-04");
    expect(normaliseIsoDate("14/03/2026")).toBeNull();
    expect(normaliseIsoDate("2026-13-01")).toBeNull();
  });

  it("normaliseSheetNumber keeps an unfamiliar code as printed, upper-cased", () => {
    expect(normaliseSheetNumber("x-99")).toBe("X-99");
    expect(normaliseSheetNumber("a-101")).toBe("A-101");
    expect(normaliseSheetNumber("")).toBeNull();
  });

  it("the prompt names the filename, the rules' proposal and the text layer", () => {
    const p = buildAiReadPrompt({ filename: "A-204.pdf", titleBlockText: "SHEET A-204", rulesSheetNumber: "A-204", rulesTitle: "Second Floor Plan" });
    expect(p).toContain("A-204.pdf");
    expect(p).toContain("proposed sheet number A-204");
    expect(p).toContain("SHEET A-204");
    expect(buildAiReadPrompt({ filename: "scan.pdf" })).toContain("no text layer");
  });

  it("the schema uses only grammar-safe keywords", () => {
    const json = JSON.stringify(AI_READ_SCHEMA);
    expect(json).not.toContain('"minimum"');
    expect(json).not.toContain('"maximum"');
    expect(json).not.toContain('"type":["');
    expect(AI_READ_SCHEMA.required).toContain("architect");
  });
});
