/**
 * `applyProposal` — the rule that decides what happens to a half-filled form
 * when the server's title-block reading arrives after the filename's.
 *
 * The behaviour under test is not cosmetic. Getting it wrong in one direction
 * throws away the better proposal; getting it wrong in the other overwrites
 * something a person just typed. And because `edited` is what the extraction
 * audit stores as the per-field error rate (feasibility doc §7), a stale
 * `edited` entry is a false accuracy number, not just a stray badge.
 */

import { describe, expect, it } from "vitest";
import { applyProposal, proposedValue, type ProposalValues } from "./proposal";
import { EMPTY_DRAFT, field, type DrawingMetadataDraft } from "./types";

const EMPTY_VALUES: ProposalValues = {
  sheetNumber: "",
  discipline: "",
  title: "",
  projectNumber: "",
  projectName: "",
  revision: "",
  issueDate: "",
};

function draft(over: Partial<DrawingMetadataDraft>): DrawingMetadataDraft {
  return { ...EMPTY_DRAFT, warnings: [], ...over };
}

const ev = (fragment: string) => [{ source: "titleblock-label" as const, pattern: "test", fragment }];

describe("proposedValue", () => {
  it("reads a field's value as the form would hold it", () => {
    const d = draft({ sheetNumber: field("A-204", 0.95, ev("A-204")) });
    expect(proposedValue(d, "sheetNumber")).toBe("A-204");
  });

  it("returns an empty string for a field that was not found", () => {
    expect(proposedValue(EMPTY_DRAFT, "revision")).toBe("");
  });
});

describe("applyProposal", () => {
  it("takes the new proposal for every untouched field", () => {
    const next = draft({
      sheetNumber: field("A-204", 0.95, ev("A-204")),
      title: field("Second Floor Plan", 0.9, ev("Second Floor Plan")),
      revision: field("C", 0.9, ev("C")),
    });

    const result = applyProposal({
      values: { ...EMPTY_VALUES, sheetNumber: "SCAN001", title: "scan001" },
      edited: [],
      next,
    });

    expect(result.values.sheetNumber).toBe("A-204");
    expect(result.values.title).toBe("Second Floor Plan");
    expect(result.values.revision).toBe("C");
    expect(result.edited).toEqual([]);
  });

  it("never overwrites a field the user has changed", () => {
    const next = draft({ sheetNumber: field("A-204", 0.95, ev("A-204")) });

    const result = applyProposal({
      values: { ...EMPTY_VALUES, sheetNumber: "A-205" },
      edited: ["sheetNumber"],
      next,
    });

    expect(result.values.sheetNumber).toBe("A-205");
    expect(result.edited).toEqual(["sheetNumber"]);
  });

  it("drops the edited flag when the new proposal agrees with what was typed", () => {
    // The user typed the right answer before the server got there. Nobody
    // corrected the machine, so the audit must not record a correction.
    const next = draft({ sheetNumber: field("A-204", 0.95, ev("A-204")) });

    const result = applyProposal({
      values: { ...EMPTY_VALUES, sheetNumber: "A-204" },
      edited: ["sheetNumber"],
      next,
    });

    expect(result.values.sheetNumber).toBe("A-204");
    expect(result.edited).toEqual([]);
  });

  it("clears an untouched field the new proposal retracts", () => {
    const result = applyProposal({
      values: { ...EMPTY_VALUES, revision: "B" },
      edited: [],
      next: draft({}),
    });

    expect(result.values.revision).toBe("");
  });

  it("keeps a user-entered value even when the new proposal has nothing", () => {
    const result = applyProposal({
      values: { ...EMPTY_VALUES, revision: "B" },
      edited: ["revision"],
      next: draft({}),
    });

    expect(result.values.revision).toBe("B");
    expect(result.edited).toEqual(["revision"]);
  });

  it("does not mutate the values it was given", () => {
    const values: ProposalValues = { ...EMPTY_VALUES, sheetNumber: "A-101" };
    applyProposal({
      values,
      edited: [],
      next: draft({ sheetNumber: field("A-204", 0.95, ev("A-204")) }),
    });
    expect(values.sheetNumber).toBe("A-101");
  });

  it("reports edits in the canonical field order, not the order they were made", () => {
    const next = draft({
      sheetNumber: field("A-204", 0.95, ev("A-204")),
      title: field("Second Floor Plan", 0.9, ev("plan")),
    });

    const result = applyProposal({
      values: { ...EMPTY_VALUES, title: "Level 2 Plan", sheetNumber: "A-999" },
      edited: ["title", "sheetNumber"],
      next,
    });

    expect(result.edited).toEqual(["sheetNumber", "title"]);
  });
});
