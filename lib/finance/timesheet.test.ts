import { describe, expect, it } from "vitest";
import {
  expenseChargeable,
  expenseSummary,
  isBillableValue,
  projectProfitability,
  roundHours,
  shiftWeek,
  timesheetGrid,
  timesheetTotals,
  timeValue,
  toQuarterHour,
  unbilledByProject,
  utilisationPct,
  weekDays,
  weekStart,
  isValidHours,
  type CalcExpense,
  type CalcTimeEntry,
} from "./timesheet";

const AWG = "AWG";

const entry = (over: Partial<CalcTimeEntry> = {}): CalcTimeEntry => ({
  date: "2026-09-21",
  hours: 8,
  billable: true,
  status: "APPROVED",
  chargeRate: 150,
  costRate: 60,
  projectId: "p1",
  projectName: "Kamay 33",
  ...over,
});

const expense = (over: Partial<CalcExpense> = {}): CalcExpense => ({
  date: "2026-09-21",
  amount: 100,
  markupPercent: 0,
  billable: true,
  status: "APPROVED",
  projectId: "p1",
  projectName: "Kamay 33",
  ...over,
});

describe("hours are a quantity, not money", () => {
  it("rounds to two decimals and never goes negative", () => {
    expect(roundHours(7.249_999)).toBe(7.25);
    expect(roundHours(-3)).toBe(0);
    expect(roundHours("2.5")).toBe(2.5);
    expect(roundHours(undefined)).toBe(0);
    expect(roundHours(Number.NaN)).toBe(0);
  });

  it("snaps to the quarter hour for the entry form", () => {
    expect(toQuarterHour(0.3)).toBe(0.25);
    expect(toQuarterHour(1.13)).toBe(1.25);
    expect(toQuarterHour(7.9)).toBe(8);
  });

  it("refuses a day nobody worked", () => {
    expect(isValidHours(0)).toBe(false);
    expect(isValidHours(24)).toBe(true);
    expect(isValidHours(24.25)).toBe(false);
    expect(isValidHours("8")).toBe(true);
  });
});

describe("what an hour is worth", () => {
  it("is exact — a float would not be", () => {
    // 7.25 x 142.50 is 1033.125, which floats render as 1033.1250000000002.
    expect(timeValue(7.25, 142.5, AWG)).toBe(1033.13);
    expect(timeValue(1, 0.1, AWG) + timeValue(1, 0.2, AWG)).toBeCloseTo(0.3, 10);
  });

  it("is zero when there is no rate on file, rather than a guess", () => {
    expect(timeValue(8, null, AWG)).toBe(0);
    expect(timeValue(8, undefined, AWG)).toBe(0);
    expect(timeValue(0, 200, AWG)).toBe(0);
  });
});

describe("an expense passed on", () => {
  it("adds the markup to the cost", () => {
    expect(expenseChargeable(100, 0, AWG)).toBe(100);
    expect(expenseChargeable(100, 12.5, AWG)).toBe(112.5);
    expect(expenseChargeable("249.99", 10, AWG)).toBe(274.99);
  });

  it("treats a missing or nonsensical markup as at cost", () => {
    expect(expenseChargeable(80, null, AWG)).toBe(80);
    expect(expenseChargeable(80, Number.NaN, AWG)).toBe(80);
    expect(expenseChargeable(80, -5, AWG)).toBe(80);
  });
});

describe("what may still be billed", () => {
  it("needs all three of billable, approved and not yet invoiced", () => {
    expect(isBillableValue({ billable: true, status: "APPROVED" })).toBe(true);
    expect(isBillableValue({ billable: false, status: "APPROVED" })).toBe(false);
    expect(isBillableValue({ billable: true, status: "SUBMITTED" })).toBe(false);
    expect(isBillableValue({ billable: true, status: "DRAFT" })).toBe(false);
    expect(
      isBillableValue({ billable: true, status: "APPROVED", invoicedAt: "2026-09-01T00:00:00Z" }),
    ).toBe(false);
  });
});

describe("the week", () => {
  it("starts on the Monday of the week the date falls in", () => {
    expect(weekStart("2026-09-21")).toBe("2026-09-21"); // a Monday
    expect(weekStart("2026-09-24")).toBe("2026-09-21");
    expect(weekStart("2026-09-20")).toBe("2026-09-14"); // a Sunday belongs to the week before
  });

  it("lists seven days and steps by whole weeks", () => {
    const days = weekDays("2026-09-21");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-09-21");
    expect(days[6]).toBe("2026-09-27");
    expect(shiftWeek("2026-09-21", 1)).toBe("2026-09-28");
    expect(shiftWeek("2026-09-21", -2)).toBe("2026-09-07");
  });

  it("survives a month boundary and a leap day", () => {
    expect(weekStart("2028-03-01")).toBe("2028-02-28");
    expect(weekDays("2028-02-28")[2]).toBe("2028-03-01");
  });
});

describe("the week's totals", () => {
  it("separates billable hours from the rest and prices only the billable ones", () => {
    const totals = timesheetTotals(
      [entry({ hours: 6 }), entry({ hours: 2, billable: false })],
      AWG,
    );
    expect(totals.hours).toBe(8);
    expect(totals.billableHours).toBe(6);
    expect(totals.nonBillableHours).toBe(2);
    expect(totals.value).toBe(900); // 6 x 150
    // Cost counts every hour worked, billable or not: 8 x 60.
    expect(totals.cost).toBe(480);
  });

  it("counts hours that are not approved yet — this is the week, not the bill", () => {
    const totals = timesheetTotals([entry({ status: "DRAFT" })], AWG);
    expect(totals.value).toBe(1200);
  });

  it("reports utilisation as a whole percent and never divides by zero", () => {
    expect(utilisationPct(6, 8)).toBe(75);
    expect(utilisationPct(0, 0)).toBe(0);
    expect(utilisationPct(9, 8)).toBe(100);
  });
});

describe("the week grid", () => {
  const days = weekDays("2026-09-21");

  it("puts billable and non-billable hours on the same project in separate rows", () => {
    const grid = timesheetGrid(
      [
        entry({ date: "2026-09-21", hours: 4 }),
        entry({ date: "2026-09-21", hours: 2, billable: false }),
      ],
      days,
    );
    expect(grid.rows).toHaveLength(2);
    expect(grid.dayTotals[0]).toBe(6);
    expect(grid.total).toBe(6);
  });

  it("adds two entries on the same day and project into one cell", () => {
    const grid = timesheetGrid(
      [entry({ date: "2026-09-22", hours: 1.5 }), entry({ date: "2026-09-22", hours: 2.25 })],
      days,
    );
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0].cells[1].hours).toBe(3.75);
    expect(grid.rows[0].total).toBe(3.75);
  });

  it("ignores entries outside the week rather than folding them into the edges", () => {
    const grid = timesheetGrid([entry({ date: "2026-09-14" }), entry({ date: "2026-10-05" })], days);
    expect(grid.rows).toHaveLength(0);
    expect(grid.total).toBe(0);
  });

  it("keeps entries with no project instead of dropping them", () => {
    const grid = timesheetGrid(
      [entry({ projectId: null, projectName: null, hours: 3 })],
      days,
    );
    expect(grid.rows[0].projectName).toBe("No project");
    expect(grid.total).toBe(3);
  });
});

describe("work in progress", () => {
  it("counts only approved, billable, uninvoiced work", () => {
    const rows = unbilledByProject(
      [
        entry({ hours: 4 }), // counts: 600
        entry({ hours: 4, status: "SUBMITTED" }), // not signed off
        entry({ hours: 4, billable: false }), // overhead
        entry({ hours: 4, invoicedAt: "2026-09-01T00:00:00Z" }), // already billed
      ],
      [expense({ amount: 200, markupPercent: 10 }), expense({ amount: 50, status: "DRAFT" })],
      AWG,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].hours).toBe(4);
    expect(rows[0].timeValue).toBe(600);
    expect(rows[0].expenseValue).toBe(220);
    expect(rows[0].total).toBe(820);
  });

  it("splits by project and sorts the biggest first", () => {
    const rows = unbilledByProject(
      [
        entry({ projectId: "p1", projectName: "Kamay 33", hours: 2 }),
        entry({ projectId: "p2", projectName: "Wayaca", hours: 6 }),
      ],
      [],
      AWG,
    );
    expect(rows.map((r) => r.projectName)).toEqual(["Wayaca", "Kamay 33"]);
  });

  it("returns nothing when nothing has been approved", () => {
    expect(unbilledByProject([entry({ status: "DRAFT" })], [], AWG)).toEqual([]);
  });
});

describe("the expense register's tiles", () => {
  it("keeps what was spent apart from what is charged", () => {
    const summary = expenseSummary(
      [
        expense({ amount: 100, markupPercent: 10 }),
        expense({ amount: 40, billable: false }),
        expense({ amount: 25, status: "SUBMITTED" }),
        expense({ amount: 999, status: "REJECTED" }),
      ],
      AWG,
    );
    expect(summary.count).toBe(3); // the rejected one is counted nowhere
    expect(summary.spent).toBe(165);
    expect(summary.rechargeable).toBe(135); // 110 + 25
    expect(summary.absorbed).toBe(40);
    expect(summary.unbilled).toBe(110); // only the approved, billable one
    expect(summary.awaitingApproval).toBe(25);
  });
});

describe("what a project earned against what it cost", () => {
  it("counts non-billable hours as cost — they were still worked", () => {
    const rows = projectProfitability(
      [entry({ hours: 8 }), entry({ hours: 8, billable: false })],
      [expense({ amount: 300, markupPercent: 0 })],
      AWG,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].hours).toBe(16);
    // 8 x 150 charged out, plus the 300 recharged.
    expect(rows[0].earned).toBe(1500);
    // 16 x 60 of labour, plus the 300 the expense actually cost.
    expect(rows[0].cost).toBe(1260);
    expect(rows[0].margin).toBe(240);
    expect(rows[0].marginPct).toBe(16);
  });

  it("does not count rejected rows at all", () => {
    const rows = projectProfitability([entry({ status: "REJECTED" })], [], AWG);
    expect(rows).toEqual([]);
  });

  it("shows a job that lost money as a negative margin, not a zero", () => {
    const rows = projectProfitability(
      [entry({ hours: 10, chargeRate: 50, costRate: 90 })],
      [],
      AWG,
    );
    expect(rows[0].margin).toBe(-400);
    expect(rows[0].marginPct).toBe(-80);
  });
});
