import { describe, expect, it } from "vitest";
import { receivablesSummary, settlement } from "./calc";
import {
  clientStatement,
  invoiceDate,
  isEmptyStatement,
  onBooks,
  receivablesByClient,
  receivablesTotals,
  statementCurrencies,
  statementPeriod,
  type LedgerInvoice,
} from "./receivables";

const TODAY = "2026-10-02";

function inv(p: Partial<LedgerInvoice> & Pick<LedgerInvoice, "id" | "total">): LedgerInvoice {
  return {
    number: p.id.toUpperCase(),
    status: "ISSUED",
    currency: "AWG",
    clientId: "c1",
    clientName: "Alpha NV",
    issueDate: null,
    dueDate: null,
    createdAt: null,
    payments: [],
    ...p,
  };
}

// A hand-checked book. Days overdue are counted from the due date to 02 OCT 2026.
const BOOK: LedgerInvoice[] = [
  // 1000 due 25 SEP, 400 paid → 600 owed, 7 days late → 1–30.
  inv({ id: "a1", total: 1000, issueDate: "2026-08-26", dueDate: "2026-09-25", payments: [{ paidAt: "2026-09-10", amount: 400, reference: "TRF-1" }] }),
  // 500 due 01 JUN, nothing paid → 123 days late → 90+.
  inv({ id: "a2", total: 500, issueDate: "2026-05-02", dueDate: "2026-06-01" }),
  // VOID, with a (later) payment against it — both ignored.
  inv({ id: "a3", total: 999, status: "VOID", issueDate: "2026-09-01", dueDate: "2026-09-15", payments: [{ paidAt: "2026-09-30", amount: 100 }] }),
  // DRAFT — not asked for yet.
  inv({ id: "a4", total: 300, status: "DRAFT", dueDate: "2026-01-01" }),
  // Same client, other currency: its own row, never added to AWG.
  inv({ id: "a5", total: 200, currency: "USD", issueDate: "2026-09-30", dueDate: "2026-10-30" }),
  // Beta: 2000 due 15 AUG, 500 paid → 1500 owed, 48 days → 31–60.
  inv({ id: "b1", clientId: "c2", clientName: "Beta Ltd", total: 2000, status: "PART_PAID", issueDate: "2026-07-16", dueDate: "2026-08-15", payments: [{ paidAt: "2026-09-01", amount: 500 }] }),
  // Beta: paid in full — no debt, but its payment is the last one.
  inv({ id: "b2", clientId: "c2", clientName: "Beta Ltd", total: 100, status: "PAID", issueDate: "2026-09-01", dueDate: "2026-09-15", payments: [{ paidAt: "2026-09-20", amount: 100 }] }),
  // No client record, no due date → current.
  inv({ id: "w1", clientId: null, clientName: "Walk-in", total: 50, issueDate: "2026-09-29" }),
];

describe("onBooks / invoiceDate", () => {
  it("counts issued, part-paid and paid; not drafts or voids", () => {
    expect(["ISSUED", "PART_PAID", "PAID"].every((s) => onBooks(s as never))).toBe(true);
    expect(onBooks("DRAFT")).toBe(false);
    expect(onBooks("VOID")).toBe(false);
  });

  it("dates an invoice by its issue date, else by when it was raised", () => {
    expect(invoiceDate({ issueDate: "2026-09-01", createdAt: "2026-08-01T10:00:00Z" })).toBe("2026-09-01");
    expect(invoiceDate({ issueDate: null, createdAt: "2026-08-01T10:00:00.000Z" })).toBe("2026-08-01");
    expect(invoiceDate({ issueDate: null, createdAt: null })).toBeNull();
  });
});

describe("receivablesByClient", () => {
  const rows = receivablesByClient(BOOK, TODAY);

  it("has one row per client per currency with money owed, by currency then largest first", () => {
    expect(rows.map((r) => [r.currency, r.clientName, r.outstanding])).toEqual([
      ["AWG", "Beta Ltd", 1500],
      ["AWG", "Alpha NV", 1100],
      ["AWG", "Walk-in", 50],
      ["USD", "Alpha NV", 200],
    ]);
  });

  it("buckets each client's debt by the register's ageing rule", () => {
    const alpha = rows.find((r) => r.clientId === "c1" && r.currency === "AWG")!;
    expect(alpha.ageing).toEqual({ current: 0, "1-30": 600, "31-60": 0, "61-90": 0, "90+": 500 });
    const beta = rows.find((r) => r.clientId === "c2")!;
    expect(beta.ageing).toEqual({ current: 0, "1-30": 0, "31-60": 1500, "61-90": 0, "90+": 0 });
    expect(rows.find((r) => r.clientId === null)!.ageing.current).toBe(50);
  });

  it("names the oldest open invoice and the last payment, ignoring a void's payment", () => {
    const alpha = rows.find((r) => r.clientId === "c1" && r.currency === "AWG")!;
    expect(alpha.oldest).toEqual({ id: "a2", number: "A2", date: "2026-05-02" });
    expect(alpha.lastPaymentDate).toBe("2026-09-10");
    expect(alpha.openCount).toBe(2);
    // A settled invoice's payment still counts as the client's last payment.
    expect(rows.find((r) => r.clientId === "c2")!.lastPaymentDate).toBe("2026-09-20");
    expect(rows.find((r) => r.clientId === null)!.lastPaymentDate).toBeNull();
  });

  it("keys an invoice with no client record by name, so it is not lost", () => {
    expect(rows.find((r) => r.clientId === null)!.key).toBe("name:walk-in");
  });

  it("leaves out a client who owes nothing", () => {
    expect(receivablesByClient([BOOK[6]], TODAY)).toEqual([]);
  });

  it("adds up to the register's own receivables summary, currency by currency", () => {
    const awg = BOOK.filter((i) => i.currency === "AWG").map((i) => {
      const s = settlement(i.total, i.payments, i.currency);
      return { status: i.status, total: i.total, paid: s.paid, outstanding: s.outstanding, dueDate: i.dueDate };
    });
    const register = receivablesSummary(awg, TODAY, "AWG");
    const footer = receivablesTotals(rows).find((t) => t.currency === "AWG")!;
    expect(footer.outstanding).toBe(register.outstanding);
    expect(footer.ageing).toEqual(register.ageing);
  });
});

describe("receivablesTotals", () => {
  it("totals per currency and never across them", () => {
    expect(receivablesTotals(receivablesByClient(BOOK, TODAY))).toEqual([
      {
        currency: "AWG",
        clients: 3,
        ageing: { current: 50, "1-30": 600, "31-60": 1500, "61-90": 0, "90+": 500 },
        outstanding: 2650,
      },
      {
        currency: "USD",
        clients: 1,
        ageing: { current: 200, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
        outstanding: 200,
      },
    ]);
  });

  it("is exact where floats are not", () => {
    const rows = receivablesByClient(
      [
        inv({ id: "x1", clientId: "x", total: 0.1, issueDate: "2026-09-01" }),
        inv({ id: "x2", clientId: "y", total: 0.2, issueDate: "2026-09-01" }),
      ],
      TODAY,
    );
    expect(receivablesTotals(rows)[0].outstanding).toBe(0.3);
  });
});

describe("statementPeriod", () => {
  it("defaults to the last 12 months to today", () => {
    expect(statementPeriod(undefined, undefined, TODAY)).toEqual({ from: "2025-10-02", to: "2026-10-02" });
  });
  it("takes a period from the query string", () => {
    expect(statementPeriod("2026-01-01", "2026-06-30", TODAY)).toEqual({ from: "2026-01-01", to: "2026-06-30" });
  });
  it("counts the default back from a chosen end date, and 29 FEB falls back to 28 FEB", () => {
    expect(statementPeriod(null, "2028-02-29", TODAY)).toEqual({ from: "2027-02-28", to: "2028-02-29" });
  });
  it("ignores a date that does not exist and turns a backwards period round", () => {
    expect(statementPeriod("2026-02-30", "nonsense", TODAY)).toEqual({ from: "2025-10-02", to: TODAY });
    expect(statementPeriod("2026-06-30", "2026-01-01", TODAY)).toEqual({ from: "2026-01-01", to: "2026-06-30" });
  });
});

describe("clientStatement", () => {
  const alpha = BOOK.filter((i) => i.clientId === "c1");

  it("lists the client's currencies, ignoring drafts and voids", () => {
    expect(statementCurrencies(alpha)).toEqual(["AWG", "USD"]);
    expect(statementCurrencies([BOOK[2], BOOK[3]])).toEqual([]);
  });

  it("opens with what was owed before the period and runs a balance to the close", () => {
    const s = clientStatement(alpha, { from: "2026-08-01", to: TODAY }, "AWG");
    expect(s.opening).toBe(500);
    expect(s.entries.map((e) => [e.date, e.kind, e.invoiceNumber, e.debit, e.credit, e.balance])).toEqual([
      ["2026-08-26", "invoice", "A1", 1000, 0, 1500],
      ["2026-09-10", "payment", "A1", 0, 400, 1100],
    ]);
    expect(s.entries[1].reference).toBe("TRF-1");
    expect([s.debits, s.credits, s.closing]).toEqual([1000, 400, 1100]);
    expect(s.ageing).toEqual({ current: 0, "1-30": 600, "31-60": 0, "61-90": 0, "90+": 500 });
    expect([s.owed, s.credit]).toEqual([1100, 0]);
  });

  it("leaves out the void invoice and its payment, and the draft", () => {
    const s = clientStatement(alpha, { from: "2026-01-01", to: TODAY }, "AWG");
    expect(s.entries.map((e) => e.invoiceNumber)).toEqual(["A2", "A1", "A1"]);
    expect(s.opening).toBe(0);
    expect(s.closing).toBe(1100);
  });

  it("ages the closing balance as it stood on the end date", () => {
    const s = clientStatement(alpha, { from: "2026-08-01", to: "2026-09-05" }, "AWG");
    expect(s.entries.map((e) => e.kind)).toEqual(["invoice"]);
    expect(s.closing).toBe(1500);
    // On 05 SEP the 1000 was not yet due; the 500 was 96 days late.
    expect(s.ageing).toEqual({ current: 1000, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 500 });
  });

  it("keeps currencies apart", () => {
    const s = clientStatement(alpha, { from: "2026-01-01", to: TODAY }, "USD");
    expect(s.entries.map((e) => e.invoiceNumber)).toEqual(["A5"]);
    expect(s.closing).toBe(200);
    expect(isEmptyStatement(s)).toBe(false);
  });

  it("calls a currency with no movement, nothing brought forward and nothing owed empty", () => {
    // The USD invoice is dated after this period ends.
    expect(isEmptyStatement(clientStatement(alpha, { from: "2026-08-01", to: "2026-09-05" }, "USD"))).toBe(true);
    // A balance brought forward with no movement is not empty.
    const old = clientStatement(alpha, { from: "2026-07-01", to: "2026-07-31" }, "AWG");
    expect(old.entries).toEqual([]);
    expect(old.opening).toBe(500);
    expect(isEmptyStatement(old)).toBe(false);
  });

  it("puts an invoice before a payment on the same day", () => {
    const s = clientStatement(
      [inv({ id: "s1", total: 100, issueDate: "2026-09-01", payments: [{ paidAt: "2026-09-01", amount: 100 }] })],
      { from: "2026-09-01", to: TODAY },
      "AWG",
    );
    expect(s.entries.map((e) => [e.kind, e.balance])).toEqual([
      ["invoice", 100],
      ["payment", 0],
    ]);
  });

  it("shows an overpayment as a credit, not as negative ageing", () => {
    const s = clientStatement(
      [inv({ id: "o1", total: 100, issueDate: "2026-09-01", dueDate: "2026-09-10", payments: [{ paidAt: "2026-09-05", amount: 120 }] })],
      { from: "2026-01-01", to: TODAY },
      "AWG",
    );
    expect(s.closing).toBe(-20);
    expect(s.owed).toBe(0);
    expect(s.credit).toBe(20);
    expect(Object.values(s.ageing).every((v) => v === 0)).toBe(true);
  });

  it("is exact where floats are not", () => {
    const s = clientStatement(
      [inv({ id: "f1", total: 0.3, issueDate: "2026-09-01", payments: [{ paidAt: "2026-09-02", amount: 0.1 }, { paidAt: "2026-09-03", amount: 0.2 }] })],
      { from: "2026-01-01", to: TODAY },
      "AWG",
    );
    expect(s.credits).toBe(0.3);
    expect(s.closing).toBe(0);
  });

  it("drops entries after the end date and dates an undated invoice by when it was raised", () => {
    const s = clientStatement(
      [
        inv({ id: "u1", total: 70, createdAt: "2026-09-15T09:00:00.000Z" }),
        inv({ id: "u2", total: 30, issueDate: "2026-10-01" }),
      ],
      { from: "2026-09-01", to: "2026-09-30" },
      "AWG",
    );
    expect(s.entries.map((e) => [e.date, e.invoiceNumber])).toEqual([["2026-09-15", "U1"]]);
    expect(s.closing).toBe(70);
  });
});
