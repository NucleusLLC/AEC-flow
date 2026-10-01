import { describe, expect, it } from "vitest";
import { checkNormTaskDraft, EMPTY_NORM_TASK_DRAFT, methodForUnit, type NormTaskDraft } from "./norm-task-draft";

const draft = (over: Partial<NormTaskDraft>): NormTaskDraft => ({ ...EMPTY_NORM_TASK_DRAFT, ...over });

describe("checkNormTaskDraft", () => {
  it("refuses an empty draft with DESCRIPTION and TRADE errors", () => {
    const r = checkNormTaskDraft(EMPTY_NORM_TASK_DRAFT);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.task).toBe("DESCRIPTION is required.");
      expect(r.errors.trade).toBe("TRADE is required.");
      expect(r.errors.unit).toBeUndefined();
    }
  });

  it("accepts a minimal task, reading a blank labour norm as 0 and blank costs as none", () => {
    const r = checkNormTaskDraft(draft({ task: "  Gypsum   ceiling ", trade: " Finishes ", unit: "m²" }));
    expect(r).toEqual({
      ok: true,
      task: {
        task: "Gypsum ceiling",
        trade: "Finishes",
        unit: "m²",
        laborNorm: 0,
        materialUnitCost: undefined,
        equipmentUnitCost: undefined,
        subcontractUnitCost: undefined,
        code: undefined,
      },
    });
  });

  it("parses figures, allowing thousands separators", () => {
    const r = checkNormTaskDraft(
      draft({ task: "Steel stair", trade: "Metalwork", unit: "set", laborNorm: "12.5", materialUnitCost: "1,250", equipmentUnitCost: "0", subcontractUnitCost: "300", code: " MW-01 " }),
    );
    expect(r.ok && r.task).toMatchObject({ laborNorm: 12.5, materialUnitCost: 1250, equipmentUnitCost: 0, subcontractUnitCost: 300, code: "MW-01" });
  });

  it("refuses negative or non-numeric figures, field by field", () => {
    const r = checkNormTaskDraft(draft({ task: "X", trade: "Y", laborNorm: "-1", materialUnitCost: "abc", subcontractUnitCost: "2" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["laborNorm", "materialUnitCost"]);
  });

  it("refuses a unit the estimate sheet does not know", () => {
    const r = checkNormTaskDraft(draft({ task: "X", trade: "Y", unit: "furlong" }));
    expect(!r.ok && r.errors.unit).toBe("Choose a UNIT from the list.");
  });
});

describe("methodForUnit", () => {
  it("matches the take-off row's own mapping", () => {
    expect(methodForUnit("m³")).toBe("volume");
    expect(methodForUnit("m")).toBe("linear");
    expect(methodForUnit("lm")).toBe("linear");
    expect(methodForUnit("no")).toBe("count");
    expect(methodForUnit("set")).toBe("count");
    expect(methodForUnit("m²")).toBe("area");
    expect(methodForUnit("kg")).toBe("area");
  });
});
