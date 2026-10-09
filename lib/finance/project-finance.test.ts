import { describe, expect, it } from "vitest";
import { hoursByPerson, projectBilling, projectWip, type ProjectBillingInvoice } from "./project-finance";
import { phaseHours } from "@/lib/projects/phases";

const TODAY = "2026-10-09";

const inv = (over: Partial<ProjectBillingInvoice> = {}): ProjectBillingInvoice => ({
  status: "ISSUED",
  currency: "AWG",
  total: 1000,
  paid: 0,
  outstanding: 1000,
  dueDate: "2026-11-01",
  ...over,
});

describe("projectBilling", () => {
  it("sets the contract against what was billed in the project's currency", () => {
    const rows = projectBilling(
      [
        inv({ total: 30000.1, paid: 10000, outstanding: 20000.1 }),
        inv({ status: "PAID", total: 0.2, paid: 0.2, outstanding: 0 }),
      ],
      { value: 120000, currency: "AWG" },
      TODAY,
    );
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r.currency).toBe("AWG");
    expect(r.contractValue).toBe(120000);
    expect(r.summary.billed).toBe(30000.3);
    expect(r.summary.paid).toBe(10000.2);
    expect(r.summary.outstanding).toBe(20000.1);
    expect(r.billedPct).toBe(25);
    expect(r.leftToBill).toBe(89999.7);
  });

  it("leaves drafts and voids out of what was billed", () => {
    const [r] = projectBilling(
      [inv({ status: "DRAFT", total: 5000, outstanding: 5000 }), inv({ status: "VOID", total: 7000 }), inv()],
      { value: 10000, currency: "AWG" },
      TODAY,
    );
    expect(r.summary.billed).toBe(1000);
    expect(r.summary.drafts).toBe(1);
    expect(r.billedPct).toBe(10);
  });

  it("counts only money still owed past its due date as overdue", () => {
    const [r] = projectBilling(
      [
        inv({ dueDate: "2026-09-01", total: 400, outstanding: 400 }),
        inv({ status: "PAID", dueDate: "2026-09-01", total: 300, paid: 300, outstanding: 0 }),
        inv({ dueDate: "2026-12-01", total: 200, outstanding: 200 }),
      ],
      { value: 0, currency: "AWG" },
      TODAY,
    );
    expect(r.summary.overdue).toBe(400);
    expect(r.summary.outstanding).toBe(600);
  });

  it("shows a contract with nothing billed yet", () => {
    const rows = projectBilling([], { value: 50000, currency: "USD" }, TODAY);
    expect(rows).toEqual([
      expect.objectContaining({ currency: "USD", contractValue: 50000, billedPct: 0, leftToBill: 50000 }),
    ]);
  });

  it("treats a zero or missing contract value as not set", () => {
    expect(projectBilling([], { value: 0, currency: "AWG" }, TODAY)).toEqual([]);
    expect(projectBilling([], { value: null, currency: "AWG" }, TODAY)).toEqual([]);
    const [r] = projectBilling([inv()], { value: null, currency: "AWG" }, TODAY);
    expect(r.contractValue).toBeNull();
    expect(r.billedPct).toBeNull();
    expect(r.leftToBill).toBeNull();
  });

  it("never adds across currencies, and keeps the contract on its own currency, listed first", () => {
    const rows = projectBilling(
      [inv({ currency: "EUR", total: 900, outstanding: 900 }), inv({ currency: "USD", total: 100, outstanding: 100 })],
      { value: 1000, currency: "USD" },
      TODAY,
    );
    expect(rows.map((r) => r.currency)).toEqual(["USD", "EUR"]);
    expect(rows[0].summary.billed).toBe(100);
    expect(rows[0].billedPct).toBe(10);
    expect(rows[1].summary.billed).toBe(900);
    expect(rows[1].contractValue).toBeNull();
    expect(rows[1].billedPct).toBeNull();
  });

  it("shows billing beyond the contract as a negative balance", () => {
    const [r] = projectBilling([inv({ total: 1200, outstanding: 1200 })], { value: 1000, currency: "AWG" }, TODAY);
    expect(r.billedPct).toBe(120);
    expect(r.leftToBill).toBe(-200);
  });
});

describe("projectWip", () => {
  const base = {
    hours: 2,
    billable: true,
    status: "APPROVED" as const,
    chargeRate: 150,
    invoicedAt: null,
    projectId: "p1",
    projectName: "Kamay 33",
    currency: "AWG",
  };

  it("counts approved, billable, uninvoiced work for this project only", () => {
    const rows = projectWip(
      [
        base,
        { ...base, hours: 1.5, chargeRate: 100.1 },
        { ...base, status: "SUBMITTED" },
        { ...base, billable: false },
        { ...base, invoicedAt: "2026-10-01T00:00:00.000Z" },
        { ...base, projectId: "p2" },
      ],
      [{ amount: 100, markupPercent: 10, billable: true, status: "APPROVED", projectId: "p1", currency: "AWG" }],
      "p1",
    );
    expect(rows).toEqual([
      { currency: "AWG", hours: 3.5, timeValue: 450.15, expenseValue: 110, total: 560.15 },
    ]);
  });

  it("keeps each currency separate and drops currencies with nothing waiting", () => {
    const rows = projectWip(
      [base, { ...base, currency: "USD", hours: 1, chargeRate: 80 }, { ...base, currency: "EUR", status: "DRAFT" }],
      [],
      "p1",
    );
    expect(rows.map((r) => [r.currency, r.total])).toEqual([
      ["AWG", 300],
      ["USD", 80],
    ]);
  });

  it("is empty when nothing is waiting", () => {
    expect(projectWip([], [], "p1")).toEqual([]);
  });
});

describe("hoursByPerson", () => {
  it("merges each person's hours across phases, most hours first, rejected left out", () => {
    const report = phaseHours(
      [
        { userId: "a", userName: "Ana", phaseId: "ph1", hours: 2.25, status: "APPROVED" },
        { userId: "a", userName: "Ana", phaseId: "ph2", hours: 1.1, status: "SUBMITTED" },
        { userId: "b", userName: "Bo", phaseId: "ph1", hours: 4, status: "DRAFT" },
        { userId: "b", userName: "Bo", phaseId: null, hours: 0.5, status: "APPROVED" },
        { userId: "c", userName: "Cy", phaseId: "ph1", hours: 9, status: "REJECTED" },
      ],
      ["ph1", "ph2"],
      "AWG",
    );
    expect(hoursByPerson(report)).toEqual([
      { userId: "b", userName: "Bo", approved: 0.5, pending: 4, hours: 4.5 },
      { userId: "a", userName: "Ana", approved: 2.25, pending: 1.1, hours: 3.35 },
    ]);
  });
});
