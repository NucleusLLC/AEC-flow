import { describe, expect, it } from "vitest";
import {
  buildRegister,
  compareSheets,
  registerSummary,
  type RegisterSheet,
  type RegisterSource,
} from "./review-register";

const AS_OF = "2026-09-25T00:00:00.000Z";

const sheet = (sheetNumber: string, over: Partial<RegisterSheet> = {}): RegisterSheet => ({
  drawingId: `d-${sheetNumber}`,
  sheetNumber,
  title: "Ground floor plan",
  revision: "B",
  discipline: "ARCHITECTURE",
  ...over,
});

const item = (over: Partial<RegisterSource> = {}): RegisterSource => ({
  id: "c1",
  drawingId: "d-A-101",
  page: 1,
  kind: "COMMENT",
  body: "Check this dimension.",
  status: "OPEN",
  authorName: "Dana Director",
  assignedToName: null,
  resolvedByName: null,
  createdAt: "2026-09-20T09:00:00.000Z",
  resolvedAt: null,
  ...over,
});

describe("references", () => {
  it("numbers items per sheet in the order they were raised", () => {
    const r = buildRegister({
      sheets: [sheet("A-101")],
      items: [
        item({ id: "b", createdAt: "2026-09-21T09:00:00.000Z" }),
        item({ id: "a", createdAt: "2026-09-20T09:00:00.000Z" }),
      ],
      asOf: AS_OF,
    });
    expect(r.groups[0].items.map((i) => `${i.ref}:${i.id}`)).toEqual(["A-101/1:a", "A-101/2:b"]);
  });

  it("keeps a reference stable when the register is filtered", () => {
    const items = [
      item({ id: "a", createdAt: "2026-09-20T09:00:00.000Z", status: "RESOLVED", resolvedAt: "2026-09-22T09:00:00.000Z" }),
      item({ id: "b", createdAt: "2026-09-21T09:00:00.000Z" }),
    ];
    const all = buildRegister({ sheets: [sheet("A-101")], items, asOf: AS_OF });
    const openOnly = buildRegister({ sheets: [sheet("A-101")], items, asOf: AS_OF, filter: { status: "OPEN" } });

    expect(all.groups[0].items.map((i) => i.ref)).toEqual(["A-101/1", "A-101/2"]);
    // Item 2 is still item 2 with item 1 hidden — not renumbered to 1.
    expect(openOnly.groups[0].items.map((i) => i.ref)).toEqual(["A-101/2"]);
  });

  it("files sheets the way a drawing set is filed", () => {
    expect(compareSheets("A-9", "A-10")).toBeLessThan(0);
    const r = buildRegister({
      sheets: [sheet("A-10"), sheet("A-9"), sheet("A-101")],
      items: [item({ drawingId: "d-A-9" }), item({ drawingId: "d-A-10" }), item({ drawingId: "d-A-101" })],
      asOf: AS_OF,
    });
    expect(r.groups.map((g) => g.sheet.sheetNumber)).toEqual(["A-9", "A-10", "A-101"]);
  });
});

describe("age", () => {
  it("measures an open item against the moment of printing", () => {
    const r = buildRegister({
      sheets: [sheet("A-101")],
      items: [item({ createdAt: "2026-09-15T00:00:00.000Z" })],
      asOf: AS_OF,
    });
    expect(r.groups[0].items[0].ageDays).toBe(10);
  });

  it("measures a resolved item against when it was closed, not today", () => {
    const r = buildRegister({
      sheets: [sheet("A-101")],
      items: [
        item({
          createdAt: "2026-09-15T00:00:00.000Z",
          status: "RESOLVED",
          resolvedAt: "2026-09-17T00:00:00.000Z",
        }),
      ],
      asOf: AS_OF,
    });
    expect(r.groups[0].items[0].ageDays).toBe(2);
  });

  it("reports the same ages for the same asOf, however long after the fact", () => {
    const build = () =>
      buildRegister({
        sheets: [sheet("A-101")],
        items: [item({ createdAt: "2026-09-15T00:00:00.000Z" })],
        asOf: AS_OF,
      });
    expect(build().groups[0].items[0].ageDays).toBe(build().groups[0].items[0].ageDays);
  });
});

describe("who it sits with", () => {
  it("counts open items per person and keeps unassigned as its own line", () => {
    const r = buildRegister({
      sheets: [sheet("A-101")],
      items: [
        item({ id: "1", assignedToName: "Sam Structural" }),
        item({ id: "2", assignedToName: "Sam Structural" }),
        item({ id: "3", assignedToName: null }),
        item({ id: "4", assignedToName: "  ", status: "OPEN" }),
        item({ id: "5", assignedToName: "Sam Structural", status: "RESOLVED", resolvedAt: AS_OF }),
      ],
      asOf: AS_OF,
    });
    expect(r.totals.open).toBe(4);
    expect(r.totals.unassigned).toBe(2); // null and whitespace both count
    expect(r.totals.byAssignee).toEqual([
      { name: "Sam Structural", open: 2 },
      { name: "Unassigned", open: 2 },
    ]);
  });

  it("puts Unassigned last on a tie rather than first by alphabet", () => {
    const r = buildRegister({
      sheets: [sheet("A-101")],
      items: [item({ id: "1", assignedToName: "Zoe" }), item({ id: "2", assignedToName: null })],
      asOf: AS_OF,
    });
    expect(r.totals.byAssignee.map((a) => a.name)).toEqual(["Zoe", "Unassigned"]);
  });

  it("filters to one person, treating empty string as unassigned", () => {
    const items = [
      item({ id: "1", assignedToName: "Sam Structural" }),
      item({ id: "2", assignedToName: null }),
    ];
    const mine = buildRegister({ sheets: [sheet("A-101")], items, asOf: AS_OF, filter: { assignedTo: "Sam Structural" } });
    const nobody = buildRegister({ sheets: [sheet("A-101")], items, asOf: AS_OF, filter: { assignedTo: "" } });
    expect(mine.groups[0].items.map((i) => i.id)).toEqual(["1"]);
    expect(nobody.groups[0].items.map((i) => i.id)).toEqual(["2"]);
  });
});

describe("what appears at all", () => {
  it("drops sheets with nothing on them unless asked to keep them", () => {
    const sheets = [sheet("A-101"), sheet("A-102")];
    const items = [item({ drawingId: "d-A-101" })];
    expect(buildRegister({ sheets, items, asOf: AS_OF }).groups).toHaveLength(1);
    expect(
      buildRegister({ sheets, items, asOf: AS_OF, filter: { includeEmptySheets: true } }).groups,
    ).toHaveLength(2);
    // The total still knows about every sheet in the set.
    expect(buildRegister({ sheets, items, asOf: AS_OF }).totals.sheets).toBe(2);
    expect(buildRegister({ sheets, items, asOf: AS_OF }).totals.sheetsWithItems).toBe(1);
  });

  it("counts a wordless redline without listing it as an action", () => {
    const r = buildRegister({
      sheets: [sheet("A-101")],
      items: [],
      unlabelledMarkups: { "d-A-101": 4 },
      asOf: AS_OF,
    });
    expect(r.groups).toHaveLength(1); // the sheet is kept: something was drawn on it
    expect(r.groups[0].items).toEqual([]);
    expect(r.totals.unlabelledMarkups).toBe(4);
  });

  it("lists a redline that carries a note like any other item", () => {
    const r = buildRegister({
      sheets: [sheet("A-101")],
      items: [item({ kind: "MARKUP", body: "Dimension does not close." })],
      asOf: AS_OF,
    });
    expect(r.groups[0].items[0]).toMatchObject({ kind: "MARKUP", ref: "A-101/1" });
  });
});

describe("the line at the top", () => {
  it("says what a reviewer needs before opening the register", () => {
    const r = buildRegister({
      sheets: [sheet("A-101"), sheet("A-102")],
      items: [
        item({ id: "1", createdAt: "2026-08-01T00:00:00.000Z" }),
        item({ id: "2", status: "RESOLVED", resolvedAt: "2026-09-22T00:00:00.000Z" }),
      ],
      asOf: AS_OF,
    });
    expect(registerSummary(r.totals)).toBe("1 open · 1 resolved · 1 unassigned · oldest 55 days across 1 of 2 sheets.");
  });

  it("says so plainly when nothing has been raised", () => {
    const r = buildRegister({ sheets: [sheet("A-101")], items: [], asOf: AS_OF });
    expect(registerSummary(r.totals)).toBe("Nothing raised against this set.");
  });
});
