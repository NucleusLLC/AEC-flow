import { describe, expect, it } from "vitest";
import {
  buildTaxReport,
  lastFullMonth,
  monthPeriod,
  parsePeriod,
  periodFromRange,
  periodOptions,
  quarterPeriod,
  shiftPeriod,
  taxKind,
  type TaxInvoice,
} from "./tax-report";
import { buildTable, isExportKind, toCsv } from "./export";
import type { InvoiceDTO } from "./types";

function inv(p: Partial<TaxInvoice> & { id: string }): TaxInvoice {
  return {
    number: p.id.toUpperCase(),
    status: "ISSUED",
    currency: "AWG",
    clientName: "Client",
    issueDate: "2026-09-05",
    subtotal: 1000,
    taxableSubtotal: 1000,
    taxTotal: 70,
    total: 1070,
    taxName: "BBO",
    taxPercent: 7,
    taxMode: "EXCLUSIVE",
    payments: [],
    ...p,
  };
}

const SEPT = { from: "2026-09-01", to: "2026-09-30" };
const Q3 = { from: "2026-07-01", to: "2026-09-30" };
const ALL = { from: null, to: null };

/** One practice's book: AWG and USD, a void, a draft, a no-tax invoice, payments. */
const BOOK: TaxInvoice[] = [
  inv({ id: "a", payments: [{ paidAt: "2026-09-30", amount: 535 }, { paidAt: "2026-10-05", amount: 535 }] }),
  inv({
    id: "b", issueDate: "2026-09-20", status: "PAID", taxName: "BAVP", taxPercent: 2, taxMode: "INCLUSIVE",
    subtotal: 1020, taxableSubtotal: 1020, taxTotal: 20, total: 1020,
    payments: [{ paidAt: "2026-09-21", amount: 1020 }],
  }),
  inv({ id: "c", currency: "USD", issueDate: "2026-09-10", subtotal: 500, taxableSubtotal: 400, taxTotal: 28, total: 528 }),
  inv({ id: "d", status: "VOID", issueDate: "2026-09-12", subtotal: 5000, taxableSubtotal: 5000, taxTotal: 350, total: 5350,
    payments: [{ paidAt: "2026-09-13", amount: 100 }] }),
  inv({ id: "e", status: "DRAFT", issueDate: "2026-09-15", subtotal: 9000, taxableSubtotal: 9000, taxTotal: 630, total: 9630 }),
  inv({ id: "f", issueDate: "2026-09-25", taxName: null, taxPercent: 0, subtotal: 300, taxableSubtotal: 300, taxTotal: 0, total: 300,
    payments: [{ paidAt: "2026-09-26", amount: 350 }] }),
  inv({ id: "g", issueDate: "2026-08-30" }),
];

describe("tax report periods", () => {
  it("reads a month and a quarter, case-insensitively", () => {
    expect(parsePeriod("2026-09", "2026-10-08")).toMatchObject({ kind: "month", from: "2026-09-01", to: "2026-09-30", label: "SEP 2026" });
    expect(parsePeriod("2026-q3", "2026-10-08")).toMatchObject({ kind: "quarter", from: "2026-07-01", to: "2026-09-30", label: "Q3 2026", key: "2026-Q3" });
    expect(parsePeriod("2026-Q4", "2026-10-08").to).toBe("2026-12-31");
  });

  it("defaults to the last full month, across a year end", () => {
    expect(parsePeriod(null, "2026-10-08").key).toBe("2026-09");
    expect(parsePeriod("rubbish", "2026-10-08").key).toBe("2026-09");
    expect(parsePeriod("2026-13", "2026-10-08").key).toBe("2026-09");
    expect(lastFullMonth("2026-01-15")).toMatchObject({ key: "2025-12", from: "2025-12-01", to: "2025-12-31", label: "DEC 2025" });
  });

  it("knows month lengths, leap years included", () => {
    expect(monthPeriod(2028, 2).to).toBe("2028-02-29");
    expect(monthPeriod(2026, 2).to).toBe("2026-02-28");
    expect(quarterPeriod(2026, 1).to).toBe("2026-03-31");
  });

  it("labels a from/to range as a month or quarter when it is one", () => {
    expect(periodFromRange("2026-10-01", "2026-10-31")?.label).toBe("OCT 2026");
    expect(periodFromRange("2026-07-01", "2026-09-30")?.label).toBe("Q3 2026");
    expect(periodFromRange("2026-07-01", "2026-08-15")).toMatchObject({ kind: "range", label: "01 JUL 2026 – 15 AUG 2026" });
    expect(periodFromRange("2026-09-30", "2026-09-01")).toBeNull();
    expect(periodFromRange("2026-02-30", "2026-03-01")).toBeNull();
    expect(periodFromRange(null, "2026-03-01")).toBeNull();
  });

  it("steps back and forward across year ends", () => {
    expect(shiftPeriod(monthPeriod(2026, 1), -1).key).toBe("2025-12");
    expect(shiftPeriod(monthPeriod(2026, 12), 1).key).toBe("2027-01");
    expect(shiftPeriod(quarterPeriod(2026, 1), -1).key).toBe("2025-Q4");
    expect(shiftPeriod(quarterPeriod(2026, 4), 1).key).toBe("2027-Q1");
  });

  it("offers recent months and quarters, newest first", () => {
    const o = periodOptions("2026-10-08", 3, 2);
    expect(o.months.map((p) => p.key)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(o.quarters.map((p) => p.key)).toEqual(["2026-Q4", "2026-Q3"]);
  });
});

describe("tax report: invoiced basis", () => {
  const r = buildTaxReport(BOOK, SEPT);

  it("totals each currency on its own", () => {
    expect(r.invoiced.map((c) => c.currency)).toEqual(["AWG", "USD"]);
    const awg = r.invoiced[0];
    expect(awg).toMatchObject({ count: 3, gross: 2390, tax: 90, net: 2300, untaxed: 300 });
    const usd = r.invoiced[1];
    expect(usd).toMatchObject({ count: 1, gross: 528, tax: 28, net: 500, untaxed: 100 });
    expect(usd.lines).toEqual([
      { key: "BBO|7|EXCLUSIVE", kind: "BBO", name: "BBO", percent: 7, mode: "EXCLUSIVE", base: 400, tax: 28, count: 1 },
    ]);
  });

  it("gives one line per tax the invoices carry, BBO before BAVP, inclusive tax backed out of the base", () => {
    expect(r.invoiced[0].lines.map((l) => [l.name, l.percent, l.mode, l.base, l.tax])).toEqual([
      ["BBO", 7, "EXCLUSIVE", 1000, 70],
      ["BAVP", 2, "INCLUSIVE", 1000, 20],
    ]);
  });

  it("leaves out drafts and voids, and says so", () => {
    expect(r.invoices.map((i) => i.number)).toEqual(["A", "C", "B", "F"]);
    expect(r.excluded).toEqual({ drafts: 1, voids: 1 });
    expect(r.notes.filter((n) => n.kind === "void").map((n) => n.invoiceNumber)).toEqual(["D"]);
  });

  it("lists an invoice without tax in the notes instead of imputing 7%", () => {
    const f = r.invoices.find((i) => i.number === "F");
    expect(f).toMatchObject({ tax: 0, net: 300, taxPercent: 0 });
    expect(r.notes).toContainEqual({ kind: "no-tax", invoiceId: "f", invoiceNumber: "F", currency: "AWG", amount: 300 });
  });

  it("widens to the quarter", () => {
    const q = buildTaxReport(BOOK, Q3);
    expect(q.invoiced[0]).toMatchObject({ count: 4, gross: 3460, tax: 160 });
    expect(q.invoiced[0].lines[0]).toMatchObject({ name: "BBO", base: 2000, tax: 140, count: 2 });
  });

  it("notes a rate with nothing taxable, and a tax with no name", () => {
    const x = buildTaxReport(
      [
        inv({ id: "z", taxableSubtotal: 0, taxTotal: 0, total: 1000 }),
        inv({ id: "n", taxName: "  " }),
      ],
      SEPT,
    );
    expect(x.notes.map((n) => `${n.kind}:${n.invoiceNumber}`)).toEqual(["unnamed-tax:N", "zero-tax:Z"]);
    expect(x.invoiced[0].untaxed).toBe(1000);
    expect(x.invoiced[0].lines.find((l) => l.name === null)).toMatchObject({ tax: 70 });
  });
});

describe("tax report: received basis", () => {
  it("takes the invoice's tax pro rata to each payment in the period", () => {
    const r = buildTaxReport(BOOK, SEPT);
    const awg = r.received.find((c) => c.currency === "AWG")!;
    expect(awg).toMatchObject({ count: 3, gross: 1905, tax: 55, net: 1850, untaxed: 350 });
    expect(awg.lines.map((l) => [l.name, l.base, l.tax])).toEqual([
      ["BBO", 500, 35],
      ["BAVP", 1000, 20],
    ]);
    expect(r.received.find((c) => c.currency === "USD")).toBeUndefined();
    expect(r.payments.map((p) => [p.paidAt, p.invoiceNumber, p.gross, p.tax])).toEqual([
      ["2026-09-21", "B", 1020, 20],
      ["2026-09-26", "F", 350, 0],
      ["2026-09-30", "A", 535, 35],
    ]);
  });

  it("counts a payment by its own date, not the invoice's", () => {
    const oct = buildTaxReport(BOOK, { from: "2026-10-01", to: "2026-10-31" });
    expect(oct.invoiced).toEqual([]);
    expect(oct.received[0]).toMatchObject({ currency: "AWG", gross: 535, tax: 35 });
  });

  it("leaves out payments on a voided invoice and notes overpayment", () => {
    const r = buildTaxReport(BOOK, SEPT);
    expect(r.notes).toContainEqual({ kind: "void-payment", invoiceId: "d", invoiceNumber: "D", currency: "AWG", amount: 100 });
    expect(r.notes).toContainEqual({ kind: "overpaid", invoiceId: "f", invoiceNumber: "F", currency: "AWG", amount: 50 });
  });

  it("adds an invoice's payment slices back to its tax to the cent", () => {
    const h = inv({
      id: "h", subtotal: 93.46, taxableSubtotal: 93.46, taxTotal: 6.54, total: 100,
      payments: [
        { paidAt: "2026-09-01", amount: 33.33 },
        { paidAt: "2026-09-02", amount: 33.33 },
        { paidAt: "2026-09-03", amount: 33.34 },
      ],
    });
    const r = buildTaxReport([h], ALL);
    expect(r.payments.map((p) => p.tax)).toEqual([2.18, 2.18, 2.18]);
    expect(r.received[0]).toMatchObject({ tax: 6.54, gross: 100, net: 93.46 });
  });

  it("pro-rates nothing on an overpaid excess", () => {
    const r = buildTaxReport([inv({ id: "o", payments: [{ paidAt: "2026-09-02", amount: 1070 }, { paidAt: "2026-09-03", amount: 10 }] })], SEPT);
    expect(r.payments.map((p) => p.tax)).toEqual([70, 0]);
  });
});

describe("tax kinds and the CSV", () => {
  it("reads BBO and BAVP off the tax name", () => {
    expect(taxKind("BBO")).toBe("BBO");
    expect(taxKind("bavp 2%")).toBe("BAVP");
    expect(taxKind("VAT")).toBe("OTHER");
    expect(taxKind(null)).toBe("OTHER");
  });

  it("exports both bases with the formula guard", () => {
    expect(isExportKind("tax")).toBe(true);
    const book = [
      { ...BOOK[0], clientName: "=HYPERLINK(\"x\")" },
      BOOK[3],
    ] as unknown as InvoiceDTO[];
    const table = buildTable("tax", { invoices: book }, SEPT);
    expect(table.columns[0]).toBe("Basis");
    expect(table.rows.map((r) => [r[0], r[2], r[9]])).toEqual([
      ["Invoiced", "A", "70.00"],
      ["Received", "A", "35.00"],
    ]);
    expect(toCsv(table)).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
