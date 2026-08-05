import { describe, it, expect } from "vitest";
import {
  COMMITTED_STATUSES,
  budgetState,
  committedValue,
  isCommitted,
  parseBudgetInput,
  receivedValue,
  reconcileEstimate,
  rollupBudget,
  sumEstimateLines,
  toMajor,
  type Commitment,
  type BudgetTask,
  type EstimateLine,
} from "@/lib/schedule/budget";

const CUR = "AWG";

const po = (o: Partial<Commitment>): Commitment => ({
  id: "po1",
  reference: "PO-2026-001",
  vendorName: "Vendor",
  status: "ISSUED",
  taskKey: null,
  currency: CUR,
  total: 0,
  linesSubtotal: 0,
  receivedSubtotal: 0,
  ...o,
});

const task = (o: Partial<BudgetTask>): BudgetTask => ({ id: "t1", name: "Task", ...o });

describe("commitment status", () => {
  it("counts issued/partial/received/closed as committed", () => {
    for (const s of COMMITTED_STATUSES) expect(isCommitted({ status: s })).toBe(true);
  });

  it("excludes DRAFT — an unissued order is an intention, not an obligation", () => {
    expect(isCommitted({ status: "DRAFT" })).toBe(false);
  });

  it("excludes CANCELLED", () => {
    expect(isCommitted({ status: "CANCELLED" })).toBe(false);
  });

  it("commits the full order total, tax and shipping included", () => {
    expect(toMajor(committedValue(po({ status: "ISSUED", total: 1234.56 }), CUR))).toBe(1234.56);
  });

  it("commits nothing for a draft or a cancellation", () => {
    expect(toMajor(committedValue(po({ status: "DRAFT", total: 900 }), CUR))).toBe(0);
    expect(toMajor(committedValue(po({ status: "CANCELLED", total: 900 }), CUR))).toBe(0);
  });
});

describe("received value", () => {
  it("is zero for an issued order with no receipts", () => {
    const c = po({ status: "ISSUED", total: 1000, linesSubtotal: 1000 });
    expect(toMajor(receivedValue(c, CUR))).toBe(0);
  });

  it("is the whole total when every line is received", () => {
    const c = po({ status: "RECEIVED", total: 1100, linesSubtotal: 1000, receivedSubtotal: 1000 });
    expect(toMajor(receivedValue(c, CUR))).toBe(1100);
  });

  it("allocates tax and shipping pro-rata on a partial receipt", () => {
    // 1000 of lines, 100 of tax/shipping. Half the lines received → half of 1100.
    const c = po({ status: "PARTIAL", total: 1100, linesSubtotal: 1000, receivedSubtotal: 500 });
    expect(toMajor(receivedValue(c, CUR))).toBe(550);
  });

  it("never exceeds the order total, even if receipts over-run the lines", () => {
    const c = po({ status: "PARTIAL", total: 1100, linesSubtotal: 1000, receivedSubtotal: 2000 });
    expect(toMajor(receivedValue(c, CUR))).toBe(1100);
  });

  it("falls back to status when the order is closed with no line receipts recorded", () => {
    const c = po({ status: "CLOSED", total: 700, linesSubtotal: 700, receivedSubtotal: 0 });
    expect(toMajor(receivedValue(c, CUR))).toBe(700);
  });

  it("reports nothing received for a cancelled order that had receipts", () => {
    const c = po({ status: "CANCELLED", total: 500, linesSubtotal: 500, receivedSubtotal: 500 });
    expect(toMajor(receivedValue(c, CUR))).toBe(0);
  });

  it("splits a thirds-receipt without losing a cent", () => {
    const c = po({ status: "PARTIAL", total: 100, linesSubtotal: 3, receivedSubtotal: 1 });
    const got = receivedValue(c, CUR);
    const rest = po({ status: "PARTIAL", total: 100, linesSubtotal: 3, receivedSubtotal: 2 });
    // The two complementary shares must reconcile exactly to the order total.
    expect(got.minor + receivedValue({ ...rest, receivedSubtotal: 2 }, CUR).minor).toBe(10000);
  });
});

describe("budget state", () => {
  const m = (n: number) => ({ minor: n * 100, currency: CUR });
  it("reports no-budget when none is set", () => {
    expect(budgetState(null, m(50))).toBe("no-budget");
  });
  it("reports over / on / under", () => {
    expect(budgetState(m(100), m(120))).toBe("over");
    expect(budgetState(m(100), m(100))).toBe("on");
    expect(budgetState(m(100), m(80))).toBe("under");
  });
});

describe("rollup", () => {
  const tasks: BudgetTask[] = [
    task({ id: "t1", name: "Foundations", budgetAmount: 10000, budgetSource: "estimate" }),
    task({ id: "t2", name: "Superstructure", budgetAmount: 5000, budgetSource: "manual" }),
    task({ id: "t3", name: "Fit-out" }), // no budget set
  ];

  it("attributes committed and received to the right task", () => {
    const r = rollupBudget({
      tasks,
      commitments: [
        po({ id: "a", taskKey: "t1", status: "ISSUED", total: 4000, linesSubtotal: 4000 }),
        po({ id: "b", taskKey: "t1", status: "RECEIVED", total: 2000, linesSubtotal: 2000, receivedSubtotal: 2000 }),
        po({ id: "c", taskKey: "t2", status: "ISSUED", total: 1000, linesSubtotal: 1000 }),
      ],
      currency: CUR,
    });
    const t1 = r.rows.find((x) => x.taskId === "t1")!;
    expect(toMajor(t1.committed)).toBe(6000);
    expect(toMajor(t1.received)).toBe(2000);
    expect(toMajor(t1.variance)).toBe(4000);
    expect(t1.commitmentCount).toBe(2);
    expect(toMajor(r.totals.committed)).toBe(7000);
    expect(toMajor(r.totals.received)).toBe(2000);
  });

  it("totals only the budgets that are actually set, and counts the ones that are not", () => {
    const r = rollupBudget({ tasks, commitments: [], currency: CUR });
    expect(toMajor(r.totals.budget)).toBe(15000);
    expect(r.totals.tasksWithoutBudget).toBe(1);
    expect(r.totals.tasksTotal).toBe(3);
    expect(r.rows.find((x) => x.taskId === "t3")!.budget).toBeNull();
  });

  it("puts unattributed orders in an explicit unassigned bucket — never spread, never dropped", () => {
    const r = rollupBudget({
      tasks,
      commitments: [
        po({ id: "u1", taskKey: null, status: "ISSUED", total: 800, linesSubtotal: 800 }),
        po({ id: "u2", taskKey: "", status: "RECEIVED", total: 200, linesSubtotal: 200, receivedSubtotal: 200 }),
        po({ id: "u3", taskKey: null, status: "DRAFT", total: 999 }),
      ],
      currency: CUR,
    });
    expect(r.unassigned.count).toBe(2);
    expect(toMajor(r.unassigned.committed)).toBe(1000);
    expect(toMajor(r.unassigned.received)).toBe(200);
    // The draft is not money at risk and must not inflate the bucket.
    expect(r.unassigned.orders.map((o) => o.id)).toEqual(["u1", "u2"]);
    // And it stayed out of the per-task totals.
    expect(toMajor(r.totals.committed)).toBe(0);
  });

  it("surfaces an order pointing at a task that no longer exists", () => {
    const r = rollupBudget({
      tasks,
      commitments: [po({ id: "o1", taskKey: "deleted-task", status: "ISSUED", total: 300, linesSubtotal: 300 })],
      currency: CUR,
    });
    expect(r.orphaned.count).toBe(1);
    expect(toMajor(r.orphaned.committed)).toBe(300);
    expect(toMajor(r.totals.committed)).toBe(0);
    expect(r.unassigned.count).toBe(0);
  });

  it("excludes foreign-currency orders instead of inventing an exchange rate", () => {
    const r = rollupBudget({
      tasks,
      commitments: [
        po({ id: "f1", taskKey: "t1", status: "ISSUED", currency: "USD", total: 5000, linesSubtotal: 5000 }),
        po({ id: "f2", taskKey: "t1", status: "ISSUED", currency: "EUR", total: 100, linesSubtotal: 100 }),
      ],
      currency: CUR,
    });
    expect(r.excluded.count).toBe(2);
    expect(r.excluded.currencies.sort()).toEqual(["EUR", "USD"]);
    expect(toMajor(r.totals.committed)).toBe(0);
  });

  it("ignores an uncommitted foreign draft entirely", () => {
    const r = rollupBudget({
      tasks,
      commitments: [po({ id: "f3", currency: "USD", status: "DRAFT", total: 5000 })],
      currency: CUR,
    });
    expect(r.excluded.count).toBe(0);
  });

  it("never aggregates children into a parent, and names the double-count when both carry money", () => {
    const nested: BudgetTask[] = [
      task({ id: "p", name: "Concrete", budgetAmount: 1000 }),
      task({ id: "c1", name: "Rebar", parentId: "p", budgetAmount: 400 }),
      task({ id: "c2", name: "Formwork", parentId: "p", budgetAmount: 600 }),
    ];
    const r = rollupBudget({ tasks: nested, commitments: [], currency: CUR });
    // 1000 + 400 + 600 — each figure counted exactly once, no inheritance.
    expect(toMajor(r.totals.budget)).toBe(2000);
    expect(r.doubleCountedParents).toEqual(["Concrete"]);
  });

  it("raises no double-count warning when only the children are budgeted", () => {
    const nested: BudgetTask[] = [
      task({ id: "p", name: "Concrete" }),
      task({ id: "c1", name: "Rebar", parentId: "p", budgetAmount: 400 }),
    ];
    expect(rollupBudget({ tasks: nested, commitments: [], currency: CUR }).doubleCountedParents).toEqual([]);
  });

  it("survives an empty programme", () => {
    const r = rollupBudget({ tasks: [], commitments: [], currency: CUR });
    expect(toMajor(r.totals.budget)).toBe(0);
    expect(r.totals.tasksTotal).toBe(0);
    expect(r.rows).toEqual([]);
  });

  it("does not drift on repeated fractional amounts", () => {
    const many = Array.from({ length: 3 }, (_, i) => task({ id: `x${i}`, name: `x${i}`, budgetAmount: 33.33 }));
    expect(toMajor(rollupBudget({ tasks: many, commitments: [], currency: CUR }).totals.budget)).toBe(99.99);
  });
});

describe("estimate reconciliation", () => {
  it("counts only estimate-sourced budgets as allocated", () => {
    const r = reconcileEstimate({
      tasks: [
        task({ id: "a", budgetAmount: 1000, budgetSource: "estimate" }),
        task({ id: "b", budgetAmount: 500, budgetSource: "manual" }),
        task({ id: "c", budgetAmount: 250, budgetSource: "estimate" }),
      ],
      direct: 4000,
      grandTotal: 4600,
      currency: CUR,
    });
    expect(toMajor(r.allocated)).toBe(1250);
    expect(toMajor(r.unallocated)).toBe(2750);
    expect(toMajor(r.grandTotal)).toBe(4600);
  });

  it("goes negative when more estimate money has been placed than the estimate holds", () => {
    const r = reconcileEstimate({
      tasks: [task({ id: "a", budgetAmount: 5000, budgetSource: "estimate" })],
      direct: 4000,
      grandTotal: 4600,
      currency: CUR,
    });
    expect(toMajor(r.unallocated)).toBe(-1000);
  });
});

describe("estimate line selection", () => {
  const lines: EstimateLine[] = [
    { ref: "cat:c1", label: "Structure", kind: "category", parentRef: null, amount: 3000 },
    { ref: "item:i1", label: "Rebar", kind: "item", parentRef: "cat:c1", amount: 1000 },
    { ref: "item:i2", label: "Concrete", kind: "item", parentRef: "cat:c1", amount: 2000 },
    { ref: "cat:c2", label: "Finishes", kind: "category", parentRef: null, amount: 500 },
  ];

  it("sums the chosen lines exactly", () => {
    expect(toMajor(sumEstimateLines(lines, ["item:i1", "cat:c2"], CUR))).toBe(1500);
  });

  it("drops an item whose category is also chosen, so money is never counted twice", () => {
    expect(toMajor(sumEstimateLines(lines, ["cat:c1", "item:i1", "item:i2"], CUR))).toBe(3000);
  });

  it("returns zero for an empty selection", () => {
    expect(toMajor(sumEstimateLines(lines, [], CUR))).toBe(0);
  });

  it("ignores refs that are not in the estimate", () => {
    expect(toMajor(sumEstimateLines(lines, ["item:gone"], CUR))).toBe(0);
  });
});

describe("budget input parsing", () => {
  it("treats empty as clearing the budget, not as zero", () => {
    expect(parseBudgetInput("")).toEqual({ ok: true, value: null });
    expect(parseBudgetInput("   ")).toEqual({ ok: true, value: null });
  });

  it("accepts a plain and a grouped number", () => {
    expect(parseBudgetInput("1250")).toEqual({ ok: true, value: 1250 });
    expect(parseBudgetInput("1,234.50")).toEqual({ ok: true, value: 1234.5 });
  });

  it("rounds to the minor unit rather than carrying float noise", () => {
    expect(parseBudgetInput("10.005")).toEqual({ ok: true, value: 10.01 });
  });

  it("accepts an explicit zero budget", () => {
    expect(parseBudgetInput("0")).toEqual({ ok: true, value: 0 });
  });

  it("rejects a typo instead of coercing it to zero", () => {
    expect(parseBudgetInput("12o0")).toEqual({ ok: false, reason: "Not a number" });
    expect(parseBudgetInput("abc").ok).toBe(false);
  });

  it("rejects a negative budget", () => {
    expect(parseBudgetInput("-5")).toEqual({ ok: false, reason: "A budget cannot be negative" });
  });
});
