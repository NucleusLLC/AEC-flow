import { describe, expect, it } from "vitest";
import { blockingLinks, checkDelete, confirmationMatches } from "./lifecycle";

describe("confirmationMatches", () => {
  it("forgives case and outer spaces", () => {
    expect(confirmationMatches("  2026a-019 ", "2026A-019")).toBe(true);
  });
  it("refuses anything else", () => {
    expect(confirmationMatches("2026A-01", "2026A-019")).toBe(false);
    expect(confirmationMatches("2026A019", "2026A-019")).toBe(false);
    expect(confirmationMatches("", "2026A-019")).toBe(false);
  });
  it("never matches an empty project number", () => {
    expect(confirmationMatches("", "  ")).toBe(false);
  });
});

describe("blockingLinks", () => {
  it("drops zero counts and sorts biggest first", () => {
    expect(blockingLinks({ invoices: 2, drawings: 0, timeEntries: 12, meetings: 1 })).toEqual([
      { key: "timeEntries", count: 12 },
      { key: "invoices", count: 2 },
      { key: "meetings", count: 1 },
    ]);
  });
  it("is empty for an untouched project", () => {
    expect(blockingLinks({})).toEqual([]);
  });
});

describe("checkDelete", () => {
  const base = { archivedAt: "2026-10-06T12:00:00.000Z", projectNumber: "P-1", typed: "P-1", links: [] };

  it("allows an archived, confirmed, unlinked project", () => {
    expect(checkDelete(base)).toEqual({ ok: true });
  });
  it("refuses a live project before anything else", () => {
    expect(checkDelete({ ...base, archivedAt: null, typed: "x", links: [{ key: "invoices", count: 1 }] })).toEqual({
      ok: false,
      reason: "NOT_ARCHIVED",
    });
  });
  it("refuses a wrong confirmation before counting links", () => {
    expect(checkDelete({ ...base, typed: "P-2", links: [{ key: "invoices", count: 1 }] })).toEqual({
      ok: false,
      reason: "WRONG_CONFIRMATION",
    });
  });
  it("refuses while records still point at it, and says which", () => {
    const links = [{ key: "invoices" as const, count: 3 }];
    expect(checkDelete({ ...base, links })).toEqual({ ok: false, reason: "LINKED", links });
  });
});
