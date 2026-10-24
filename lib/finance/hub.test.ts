import { describe, expect, it } from "vitest";
import { financeHubTiles, type HubPayment } from "./hub";
import type { InvoiceSummaryDTO } from "./types";

const TODAY = "2026-10-19";

type Inv = Parameters<typeof financeHubTiles>[0][number];

function inv(over: Partial<InvoiceSummaryDTO> & { id: string }): Inv {
  return {
    number: `INV-2026-${over.id}`,
    status: "ISSUED",
    currency: "AWG",
    clientId: "c1",
    clientName: "Eagle Beach Holdings",
    dueDate: "2026-11-30",
    total: 1000,
    paid: 0,
    credited: 0,
    outstanding: 1000,
    ...over,
  };
}

const pay = (over: Partial<HubPayment>): HubPayment => ({
  currency: "AWG",
  amount: 100,
  paidAt: "2026-10-05",
  invoiceStatus: "PART_PAID",
  ...over,
});

describe("financeHubTiles", () => {
  it("adds up what is owed, what is overdue and the drafts, per currency", () => {
    const rows = financeHubTiles(
      [
        inv({ id: "1", outstanding: 1000 }),
        inv({ id: "2", outstanding: 250.1, dueDate: "2026-09-01", status: "PART_PAID", paid: 749.9 }),
        inv({ id: "3", status: "DRAFT" }),
        inv({ id: "4", status: "VOID" }),
        inv({ id: "5", currency: "USD", outstanding: 500, dueDate: "2026-10-01" }),
      ],
      [],
      TODAY,
    );
    expect(rows.map((r) => r.currency)).toEqual(["AWG", "USD"]);
    expect(rows[0]).toMatchObject({
      outstanding: 1250.1,
      openCount: 2,
      overdue: 250.1,
      overdueCount: 1,
      drafts: 1,
      receivedThisMonth: 0,
    });
    expect(rows[1]).toMatchObject({ outstanding: 500, overdue: 500, overdueCount: 1, drafts: 0 });
  });

  it("counts payments dated this month only, never on a void, in exact cents", () => {
    const rows = financeHubTiles(
      [inv({ id: "1" })],
      [
        pay({ amount: 0.1 }),
        pay({ amount: 0.2, paidAt: "2026-10-31T12:00:00.000Z" }),
        pay({ amount: 999, paidAt: "2026-09-30" }),
        pay({ amount: 999, invoiceStatus: "VOID" }),
        pay({ amount: 50, currency: "USD" }),
      ],
      TODAY,
    );
    const awg = rows.find((r) => r.currency === "AWG")!;
    expect(awg.receivedThisMonth).toBe(0.3);
    expect(awg.receivedThisMonthCount).toBe(2);
    expect(rows.find((r) => r.currency === "USD")!.receivedThisMonth).toBe(50);
  });

  it("puts the system currency first and leaves out a currency with nothing to show", () => {
    const rows = financeHubTiles(
      [
        inv({ id: "1", currency: "AWG" }),
        inv({ id: "2", currency: "USD" }),
        inv({ id: "3", currency: "EUR", status: "PAID", paid: 1000, outstanding: 0 }),
      ],
      [],
      TODAY,
      "USD",
    );
    expect(rows.map((r) => r.currency)).toEqual(["USD", "AWG"]);
  });

  it("is empty for a practice that has billed nothing", () => {
    expect(financeHubTiles([], [], TODAY)).toEqual([]);
  });
});
