import { describe, expect, it } from "vitest";
import { isOverdue, overdueChase, reminderText, type ChaseInvoiceInput } from "./overdue";

const TODAY = "2026-10-09";

function inv(over: Partial<ChaseInvoiceInput> & Pick<ChaseInvoiceInput, "id">): ChaseInvoiceInput {
  return {
    number: `INV-2026-${over.id}`,
    status: "ISSUED",
    currency: "AWG",
    clientId: "c1",
    clientName: "Eagle Beach Holdings",
    projectName: "Villa 7",
    issueDate: "2026-08-01",
    dueDate: "2026-09-01",
    total: 1000,
    outstanding: 1000,
    ...over,
  };
}

const money = (n: number, c: string) => `${c} ${n.toFixed(2)}`;

describe("isOverdue", () => {
  it("needs money outstanding and a due date before today", () => {
    expect(isOverdue(inv({ id: "1" }), TODAY)).toBe(true);
    expect(isOverdue(inv({ id: "2", outstanding: 0 }), TODAY)).toBe(false);
    expect(isOverdue(inv({ id: "3", dueDate: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(inv({ id: "4", dueDate: "2026-10-30" }), TODAY)).toBe(false);
    expect(isOverdue(inv({ id: "5", dueDate: null }), TODAY)).toBe(false);
  });

  it("never chases a draft or a void, and does chase a part-paid invoice", () => {
    expect(isOverdue(inv({ id: "1", status: "DRAFT" }), TODAY)).toBe(false);
    expect(isOverdue(inv({ id: "2", status: "VOID" }), TODAY)).toBe(false);
    expect(isOverdue(inv({ id: "3", status: "PART_PAID", outstanding: 250 }), TODAY)).toBe(true);
  });

  it("ignores less than a cent outstanding", () => {
    expect(isOverdue(inv({ id: "1", outstanding: 0.001 }), TODAY)).toBe(false);
  });
});

describe("overdueChase", () => {
  it("groups by client and sums exactly", () => {
    const { groups, totals } = overdueChase(
      [
        inv({ id: "1", outstanding: 0.1, dueDate: "2026-09-30" }),
        inv({ id: "2", outstanding: 0.2, dueDate: "2026-08-31" }),
        inv({ id: "3", clientId: "c2", clientName: "Palm Developments", outstanding: 500 }),
      ],
      TODAY,
    );
    expect(groups).toHaveLength(2);
    const eagle = groups.find((g) => g.clientId === "c1")!;
    expect(eagle.outstanding).toBe(0.3);
    expect(eagle.invoices.map((i) => i.id)).toEqual(["2", "1"]); // most overdue first
    expect(eagle.maxDaysOverdue).toBe(39);
    expect(totals).toEqual([{ currency: "AWG", outstanding: 500.3, invoices: 3, clients: 2 }]);
  });

  it("never adds across currencies: one group and one total per currency", () => {
    const { groups, totals } = overdueChase(
      [inv({ id: "1", outstanding: 100 }), inv({ id: "2", currency: "USD", outstanding: 40 })],
      TODAY,
    );
    expect(groups.map((g) => [g.clientId, g.currency, g.outstanding])).toEqual([
      ["c1", "AWG", 100],
      ["c1", "USD", 40],
    ]);
    expect(totals.map((t) => [t.currency, t.outstanding])).toEqual([
      ["AWG", 100],
      ["USD", 40],
    ]);
  });

  it("leaves out drafts, voids, paid and not-yet-due invoices", () => {
    const { groups, totals } = overdueChase(
      [
        inv({ id: "1", status: "DRAFT" }),
        inv({ id: "2", status: "VOID" }),
        inv({ id: "3", status: "PAID", outstanding: 0 }),
        inv({ id: "4", dueDate: "2026-12-01" }),
      ],
      TODAY,
    );
    expect(groups).toEqual([]);
    expect(totals).toEqual([]);
  });

  it("puts the oldest debt first", () => {
    const { groups } = overdueChase(
      [
        inv({ id: "1", clientId: "a", clientName: "A", dueDate: "2026-10-01" }),
        inv({ id: "2", clientId: "b", clientName: "B", dueDate: "2026-06-01" }),
      ],
      TODAY,
    );
    expect(groups.map((g) => g.clientName)).toEqual(["B", "A"]);
  });

  it("groups clients without an id by name", () => {
    const { groups } = overdueChase(
      [
        inv({ id: "1", clientId: null, clientName: "Walk-in Client" }),
        inv({ id: "2", clientId: null, clientName: " walk-in client " }),
      ],
      TODAY,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.invoices).toHaveLength(2);
  });
});

describe("reminderText", () => {
  const one = overdueChase([inv({ id: "7", status: "PART_PAID", total: 1000, outstanding: 250 })], TODAY).groups[0]!;

  it("names the client, the invoice, the amount still outstanding and the due date", () => {
    const text = reminderText(one, { money, sender: "Jane Architect\nZenArch" });
    expect(text).toContain("Dear Eagle Beach Holdings,");
    expect(text).toContain("invoice INV-2026-7, due on 2026-09-01, still has AWG 250.00 outstanding");
    expect(text).not.toContain("1000.00"); // the balance, not the original total
    expect(text).toContain("please disregard this message");
    expect(text.trimEnd().endsWith("Jane Architect\nZenArch")).toBe(true);
  });

  it("lists every invoice and a total when there are several", () => {
    const group = overdueChase(
      [inv({ id: "1", outstanding: 100.1 }), inv({ id: "2", outstanding: 200.2, dueDate: "2026-08-01" })],
      TODAY,
    ).groups[0]!;
    const text = reminderText(group, { money, date: (d) => `[${d}]` });
    expect(text).toContain("- Invoice INV-2026-2: AWG 200.20 outstanding, due on [2026-08-01]");
    expect(text).toContain("- Invoice INV-2026-1: AWG 100.10 outstanding, due on [2026-09-01]");
    expect(text).toContain("Total outstanding: AWG 300.30");
    expect(text.trimEnd().endsWith("Kind regards,")).toBe(true);
  });

  it("can be limited to one invoice of the group", () => {
    const group = overdueChase([inv({ id: "1" }), inv({ id: "2" })], TODAY).groups[0]!;
    const text = reminderText(group, { money }, ["2"]);
    expect(text).toContain("invoice INV-2026-2");
    expect(text).not.toContain("INV-2026-1");
    expect(reminderText(group, { money }, ["nope"])).toBe("");
  });

  it("runs every sentence through the translator", () => {
    const text = reminderText(one, { money, t: (s) => s.replace("Dear", "Beste").replace("Kind regards", "Met vriendelijke groet") });
    expect(text).toContain("Beste Eagle Beach Holdings,");
    expect(text).toContain("Met vriendelijke groet,");
  });
});
