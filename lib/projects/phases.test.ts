import { describe, expect, it } from "vitest";
import {
  bookedHoursByPhase,
  deriveProjectProgress,
  missingPresets,
  movePhase,
  PHASE_PRESETS,
  PHASE_STATUSES,
  phaseChanges,
  phaseHours,
  standardPhaseDrafts,
  validatePhases,
} from "./phases";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("presets and statuses", () => {
  it("lists the seven standard phases in job order", () => {
    expect(PHASE_PRESETS).toEqual([
      "Concept Design",
      "Schematic Design",
      "Design Development",
      "Construction Documents",
      "Tender / Bidding",
      "Construction Administration",
      "Handover",
    ]);
    const drafts = standardPhaseDrafts();
    expect(drafts).toHaveLength(7);
    expect(drafts.every((d) => d.status === "NOT_STARTED" && d.progressPct === 0 && !d.id)).toBe(true);
  });

  it("matches the PhaseStatus enum in prisma/schema.prisma exactly", () => {
    const schema = readFileSync(resolve(__dirname, "../../prisma/schema.prisma"), "utf8");
    const block = /enum PhaseStatus \{([^}]*)\}/.exec(schema)?.[1] ?? "";
    const values = block.split(/\s+/).filter(Boolean);
    expect([...PHASE_STATUSES].sort()).toEqual(values.sort());
  });

  it("offers only the presets not already on the project, ignoring case", () => {
    expect(missingPresets(["concept design", " Handover "])).toEqual([
      "Schematic Design",
      "Design Development",
      "Construction Documents",
      "Tender / Bidding",
      "Construction Administration",
    ]);
  });
});

describe("validatePhases", () => {
  it("trims names, numbers the order and clamps percent", () => {
    const r = validatePhases([
      { name: "  Concept   Design ", progressPct: "45.6" },
      { id: "p2", name: "Schematic Design", progressPct: 140, status: "IN_PROGRESS", startDate: "2026-09-15", endDate: "2026-10-30" },
      { name: "Custom", progressPct: -5, discipline: "MEP" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((p) => [p.name, p.sortOrder, p.progressPct])).toEqual([
      ["Concept Design", 0, 46],
      ["Schematic Design", 1, 100],
      ["Custom", 2, 0],
    ]);
    expect(r.value[1]).toMatchObject({ id: "p2", startDate: "2026-09-15", endDate: "2026-10-30" });
    expect(r.value[2].discipline).toBe("MEP");
    expect(r.value[0].status).toBe("NOT_STARTED");
  });

  it("makes a completed phase 100%", () => {
    const r = validatePhases([{ name: "Handover", status: "COMPLETED", progressPct: 20 }]);
    expect(r.ok && r.value[0].progressPct).toBe(100);
  });

  it("refuses a blank or duplicate name, with the row it is about", () => {
    expect(validatePhases([{ name: "A" }, { name: "  " }])).toEqual({
      ok: false,
      issue: { code: "NAME_REQUIRED", index: 1, name: "" },
    });
    expect(validatePhases([{ name: "Schematic Design" }, { name: "schematic design" }])).toEqual({
      ok: false,
      issue: { code: "DUPLICATE_NAME", index: 1, name: "schematic design" },
    });
    expect(validatePhases([{ name: "x".repeat(121) }]).ok).toBe(false);
  });

  it("refuses an end before the start and a date the calendar does not have", () => {
    const back = validatePhases([{ name: "A", startDate: "2026-10-02", endDate: "2026-10-01" }]);
    expect(!back.ok && back.issue.code).toBe("END_BEFORE_START");
    const feb = validatePhases([{ name: "A", startDate: "2026-02-31" }]);
    expect(!feb.ok && feb.issue.code).toBe("BAD_DATE");
    const same = validatePhases([{ name: "A", startDate: "2026-10-01", endDate: "2026-10-01" }]);
    expect(same.ok).toBe(true);
  });

  it("refuses an unknown status or discipline, and more than 40 phases", () => {
    const s = validatePhases([{ name: "A", status: "DONE" as never }]);
    expect(!s.ok && s.issue.code).toBe("BAD_STATUS");
    const d = validatePhases([{ name: "A", discipline: "PLUMBING" as never }]);
    expect(!d.ok && d.issue.code).toBe("BAD_DISCIPLINE");
    const many = validatePhases(Array.from({ length: 41 }, (_, i) => ({ name: `P${i}` })));
    expect(!many.ok && many.issue.code).toBe("TOO_MANY");
  });
});

describe("deriveProjectProgress — equal-weighted average", () => {
  it("averages every phase equally and rounds to a whole percent", () => {
    expect(
      deriveProjectProgress([
        { status: "COMPLETED", progressPct: 100 },
        { status: "IN_PROGRESS", progressPct: 50 },
        { status: "NOT_STARTED", progressPct: 0 },
      ]),
    ).toBe(50);
    expect(
      deriveProjectProgress([
        { status: "IN_PROGRESS", progressPct: 10 },
        { status: "IN_PROGRESS", progressPct: 15 },
        { status: "NOT_STARTED", progressPct: 0 },
      ]),
    ).toBe(8); // 25 / 3 = 8.33
  });

  it("ignores dates: a long phase weighs the same as a short one", () => {
    expect(deriveProjectProgress([
      { status: "COMPLETED", progressPct: 100 },
      { status: "NOT_STARTED", progressPct: 0 },
    ])).toBe(50);
  });

  it("leaves cancelled phases out and treats COMPLETED as 100", () => {
    expect(
      deriveProjectProgress([
        { status: "COMPLETED", progressPct: 30 },
        { status: "CANCELLED", progressPct: 0 },
      ]),
    ).toBe(100);
  });

  it("returns null when there is nothing to average", () => {
    expect(deriveProjectProgress([])).toBeNull();
    expect(deriveProjectProgress([{ status: "CANCELLED", progressPct: 40 }])).toBeNull();
  });
});

describe("movePhase and phaseChanges", () => {
  it("moves a row one place and never wraps", () => {
    expect(movePhase(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(movePhase(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    const same = ["a", "b"];
    expect(movePhase(same, 0, -1)).toBe(same);
    expect(movePhase(same, 1, 1)).toBe(same);
  });

  it("finds removed phases and refuses ids that are not this project's", () => {
    expect(phaseChanges(["p1", "p2", "p3"], [{ id: "p3" }, { id: null }, { id: "p1" }])).toEqual({
      removed: ["p2"],
      foreign: [],
    });
    expect(phaseChanges(["p1"], [{ id: "p1" }, { id: "other-project-phase" }])).toEqual({
      removed: [],
      foreign: ["other-project-phase"],
    });
  });
});

describe("phaseHours", () => {
  const entries = [
    { userId: "u1", userName: "Ana", phaseId: "sd", hours: 3, status: "DRAFT" as const, chargeRate: 100, costRate: 40 },
    { userId: "u1", userName: "Ana", phaseId: "sd", hours: 2.5, status: "APPROVED" as const, chargeRate: 100, costRate: 40 },
    { userId: "u2", userName: "Ben", phaseId: "sd", hours: 1.25, status: "SUBMITTED" as const, chargeRate: 142.5, costRate: 55.55, billable: false },
    { userId: "u2", userName: "Ben", phaseId: "cd", hours: 4, status: "REJECTED" as const, chargeRate: 100, costRate: 40 },
    { userId: "u2", userName: "Ben", phaseId: null, hours: 1, status: "APPROVED" as const, chargeRate: 100, costRate: 40 },
    { userId: "u1", userName: "Ana", phaseId: "gone", hours: 0.5, status: "APPROVED" as const, chargeRate: 100, costRate: 40 },
  ];

  it("splits approved from pending per phase and per person, at the snapshotted rates", () => {
    const r = phaseHours(entries, ["cd", "sd"], "AWG");
    expect(r.rows.map((x) => x.phaseId)).toEqual(["sd", null]);
    const sd = r.rows[0];
    expect(sd).toMatchObject({ approved: 2.5, pending: 4.25, hours: 6.75 });
    // cost: 5.5 h × 40 + 1.25 h × 55.55 = 220 + 69.44 (69.4375 rounded) = 289.44
    expect(sd.cost).toBe(289.44);
    // value: 5.5 h × 100; Ben's 1.25 h are non-billable
    expect(sd.value).toBe(550);
    expect(sd.people.map((p) => [p.userName, p.hours, p.approved, p.pending])).toEqual([
      ["Ana", 5.5, 2.5, 3],
      ["Ben", 1.25, 0, 1.25],
    ]);
  });

  it("counts rejected hours nowhere and folds an unknown phase into no-phase", () => {
    const r = phaseHours(entries, ["cd", "sd"], "AWG");
    const none = r.rows.find((x) => x.phaseId === null)!;
    expect(none.hours).toBe(1.5);
    expect(r.total).toMatchObject({ hours: 8.25, approved: 4, pending: 4.25 });
    expect(r.total.cost).toBe(349.44);
    expect(r.total.value).toBe(700);
  });

  it("totals hours booked per phase for the delete guard", () => {
    expect(Object.fromEntries(bookedHoursByPhase(entries))).toEqual({ sd: 6.75, cd: 4, gone: 0.5 });
  });
});
