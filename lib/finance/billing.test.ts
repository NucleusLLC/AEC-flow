import { describe, expect, it } from "vitest";
import { chosenTotal, idsFor, workToLines, type BillableExpense, type BillableTime } from "./billing";

const t = (over: Partial<BillableTime> = {}): BillableTime => ({
  id: "t1",
  userId: "u1",
  userName: "Dana Director",
  projectId: "p1",
  projectName: "Kamay 33",
  date: "2026-09-21",
  hours: 8,
  billable: true,
  status: "APPROVED",
  chargeRate: 175,
  currency: "AWG",
  description: "Permit drawings",
  invoicedAt: null,
  ...over,
});

const e = (over: Partial<BillableExpense> = {}): BillableExpense => ({
  id: "e1",
  projectId: "p1",
  projectName: "Kamay 33",
  date: "2026-09-21",
  category: "PRINTING",
  description: "A0 plots",
  vendor: "Copy Center",
  amount: 240,
  markupPercent: 10,
  billable: true,
  status: "APPROVED",
  currency: "AWG",
  invoicedAt: null,
  ...over,
});

describe("one line per person, one per expense", () => {
  it("groups a person's hours into a single line at their own rate", () => {
    const s = workToLines({
      time: [t({ id: "a", hours: 8 }), t({ id: "b", hours: 4, date: "2026-09-22" })],
      expenses: [],
      currency: "AWG",
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].quantity).toBe(12);
    expect(s.lines[0].amount).toBe(2100); // 12 x 175
    expect(s.lines[0].unitRate).toBe(175);
    expect(s.lines[0].timeEntryIds).toEqual(["a", "b"]);
    expect(s.lines[0].description).toMatch(/Dana Director — 12 hours, 2026-09-21 to 2026-09-22/);
  });

  it("keeps two people apart", () => {
    const s = workToLines({
      time: [t({ id: "a" }), t({ id: "b", userId: "u2", userName: "Sam Staff", chargeRate: 120 })],
      expenses: [],
      currency: "AWG",
    });
    expect(s.lines).toHaveLength(2);
    expect(s.total).toBe(8 * 175 + 8 * 120);
  });

  it("splits a mid-job rate change into one line per rate", () => {
    const s = workToLines({
      time: [t({ id: "a", hours: 10, chargeRate: 200 }), t({ id: "b", hours: 10, chargeRate: 100 })],
      expenses: [],
      currency: "AWG",
    });
    expect(s.lines).toHaveLength(2);
    expect(s.lines.map((l) => l.unitRate).sort()).toEqual([100, 200]);
    expect(s.total).toBe(3000);
  });

  it("never shows a rate that does not multiply out", () => {
    // 8 h at 175 then 6 h at 130 averages to 155.71 — 14 x 155.71 is 2179.94,
    // and the work is worth 2180. Two lines, and both reconcile exactly.
    const s = workToLines({
      time: [t({ id: "a", hours: 8, chargeRate: 175 }), t({ id: "b", hours: 6, chargeRate: 130 })],
      expenses: [e()],
      currency: "AWG",
    });
    for (const line of s.lines) {
      if (line.quantity === null || line.unitRate === null) continue;
      expect(line.quantity * line.unitRate).toBeCloseTo(line.amount, 2);
    }
    expect(s.total).toBe(1400 + 780 + 264);
  });

  it("gives an expense no quantity and no rate", () => {
    const s = workToLines({ time: [], expenses: [e()], currency: "AWG" });
    expect(s.lines[0].quantity).toBeNull();
    expect(s.lines[0].unitRate).toBeNull();
    expect(s.lines[0].amount).toBe(264);
  });

  it("bills an expense at cost plus its markup, one line each", () => {
    const s = workToLines({ time: [], expenses: [e(), e({ id: "e2", description: "Permit fee", markupPercent: 0, amount: 500 })], currency: "AWG" });
    expect(s.lines.map((l) => l.amount)).toEqual([264, 500]);
    expect(s.lines[0].description).toBe("A0 plots (Copy Center)");
    expect(s.total).toBe(764);
  });

  it("collapses time into one line when asked, without changing what gets stamped", () => {
    const s = workToLines({
      time: [t({ id: "a" }), t({ id: "b", userId: "u2", userName: "Sam Staff", chargeRate: 120 })],
      expenses: [],
      currency: "AWG",
      summarise: true,
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].timeEntryIds.sort()).toEqual(["a", "b"]);
    expect(s.lines[0].amount).toBe(8 * 175 + 8 * 120);
    expect(s.lines[0].description).toMatch(/^Professional services/);
    // No rate on a line that covers two of them.
    expect(s.lines[0].unitRate).toBeNull();
    expect(s.lines[0].hours).toBe(16);
  });
});

describe("what may not be billed, and why", () => {
  it("excludes work that is not approved, not billable, or already invoiced — and says which", () => {
    const s = workToLines({
      time: [
        t({ id: "ok" }),
        t({ id: "draft", status: "DRAFT" }),
        t({ id: "internal", billable: false }),
        t({ id: "done", invoicedAt: "2026-09-01T00:00:00Z" }),
      ],
      expenses: [e({ id: "x", status: "SUBMITTED" })],
      currency: "AWG",
    });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].timeEntryIds).toEqual(["ok"]);
    expect(s.excluded.map((x) => `${x.id}:${x.why}`)).toEqual([
      "draft:not approved (draft)",
      "internal:not billable",
      "done:already on an invoice",
      "x:not approved (submitted)",
    ]);
  });

  it("ignores work in another currency rather than mixing it in", () => {
    const s = workToLines({
      time: [t({ id: "a" }), t({ id: "usd", currency: "USD" })],
      expenses: [],
      currency: "AWG",
    });
    expect(s.lines[0].timeEntryIds).toEqual(["a"]);
    expect(s.excluded).toEqual([]);
  });

  it("returns nothing at all when there is nothing to bill", () => {
    const s = workToLines({ time: [], expenses: [], currency: "AWG" });
    expect(s.lines).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.totalHours).toBe(0);
  });
});

describe("choosing which lines to raise", () => {
  const summary = workToLines({
    time: [t({ id: "a" })],
    expenses: [e({ id: "e1" }), e({ id: "e2", description: "Fee", markupPercent: 0, amount: 500 })],
    currency: "AWG",
  });

  it("collects the rows behind the chosen lines", () => {
    const ids = idsFor(summary.lines, ["time:u1@175", "expense:e2"]);
    expect(ids.timeEntryIds).toEqual(["a"]);
    expect(ids.expenseIds).toEqual(["e2"]);
  });

  it("totals only what was chosen", () => {
    expect(chosenTotal(summary.lines, ["expense:e1"], "AWG")).toBe(264);
    expect(chosenTotal(summary.lines, [], "AWG")).toBe(0);
  });
});
