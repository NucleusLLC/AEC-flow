import { describe, expect, it } from "vitest";
import { invoiceTotals } from "./calc";
import { creditNotesTable, invoicesTable, taxTable } from "./export";
import { buildTaxReport, type TaxInvoice } from "./tax-report";
import type { CreditNoteDTO, InvoiceDTO } from "./types";

/**
 * Two taxes on one invoice (Aruba: BBO + BAVP). Each is charged on the same
 * taxable subtotal — never on the other — and rounded on its own; INCLUSIVE
 * backs the combined rate out once and splits it in proportion. A one-tax
 * invoice must come out exactly as it did before the second tax existed.
 */
const AWG = "AWG";
const BOTH_EX = { percent: 3, percent2: 4, mode: "EXCLUSIVE" } as const;
const BOTH_IN = { percent: 3, percent2: 4, mode: "INCLUSIVE" } as const;

describe("invoiceTotals with a second tax — EXCLUSIVE", () => {
  it("charges each tax on the taxable subtotal and adds both on top", () => {
    expect(invoiceTotals([{ amount: 1000 }], BOTH_EX, AWG)).toEqual({
      subtotal: 1000,
      taxableSubtotal: 1000,
      taxTotal: 30,
      tax2Total: 40,
      total: 1070,
    });
  });

  it("does not compound: the second tax is not charged on the first", () => {
    // Compounded, BAVP would be 4% of 1030 = 41.20.
    expect(invoiceTotals([{ amount: 1000 }], BOTH_EX, AWG).tax2Total).toBe(40);
  });

  it("leaves non-taxable lines out of both taxes but in the total", () => {
    expect(invoiceTotals([{ amount: 1000 }, { amount: 200, taxable: false }], BOTH_EX, AWG)).toEqual({
      subtotal: 1200,
      taxableSubtotal: 1000,
      taxTotal: 30,
      tax2Total: 40,
      total: 1270,
    });
  });

  it("rounds each tax on its own, half-up to the cent", () => {
    // 0.17 × 3% = 0.0051 → 0.01; 0.17 × 4% = 0.0068 → 0.01. (A single 7% would be 0.0119 → 0.01.)
    expect(invoiceTotals([{ amount: 0.17 }], BOTH_EX, AWG)).toEqual({
      subtotal: 0.17,
      taxableSubtotal: 0.17,
      taxTotal: 0.01,
      tax2Total: 0.01,
      total: 0.19,
    });
    // 12.34 × 3% = 0.3702 → 0.37; × 4% = 0.4936 → 0.49.
    expect(invoiceTotals([{ amount: 12.34 }], BOTH_EX, AWG)).toMatchObject({ taxTotal: 0.37, tax2Total: 0.49, total: 13.2 });
  });
});

describe("invoiceTotals with a second tax — INCLUSIVE", () => {
  it("backs the combined rate out of the lines and splits it by rate", () => {
    // 1070 at 3% + 4% contains 70.00: 30.00 BBO and 40.00 BAVP. The client still owes 1070.
    expect(invoiceTotals([{ amount: 1070 }], BOTH_IN, AWG)).toEqual({
      subtotal: 1070,
      taxableSubtotal: 1070,
      taxTotal: 30,
      tax2Total: 40,
      total: 1070,
    });
  });

  it("assigns the rounding remainder so the two parts add up to the contained tax exactly", () => {
    // 100.00 / 1.07 = 93.457… → 93.46 net, 6.54 contained.
    // 6.54 × 3/7 = 2.8028…, × 4/7 = 3.7371… → floors 2.80 + 3.73 = 6.53; the cent goes to the
    // larger remainder (BAVP): 2.80 + 3.74 = 6.54.
    expect(invoiceTotals([{ amount: 100 }], BOTH_IN, AWG)).toEqual({
      subtotal: 100,
      taxableSubtotal: 100,
      taxTotal: 2.8,
      tax2Total: 3.74,
      total: 100,
    });
  });

  it("always contains exactly what one tax at the combined rate would", () => {
    for (const amount of [0.01, 0.17, 1, 9.99, 33.33, 100, 123.45, 999.99, 1070, 12345.67]) {
      const both = invoiceTotals([{ amount }], BOTH_IN, AWG);
      const single = invoiceTotals([{ amount }], { percent: 7, mode: "INCLUSIVE" }, AWG);
      const cents = (n: number) => Math.round(n * 100);
      expect(cents(both.taxTotal) + cents(both.tax2Total)).toBe(cents(single.taxTotal));
      expect(both.total).toBe(amount);
    }
  });
});

describe("one tax is exactly what it was", () => {
  it("a missing, null or zero second tax changes nothing, in either mode", () => {
    for (const mode of ["EXCLUSIVE", "INCLUSIVE"] as const) {
      const before = invoiceTotals([{ amount: 1234.56 }, { amount: 99.99, taxable: false }], { percent: 6, mode }, AWG);
      for (const percent2 of [undefined, null, 0, Number.NaN, -3]) {
        expect(
          invoiceTotals([{ amount: 1234.56 }, { amount: 99.99, taxable: false }], { percent: 6, mode, percent2 }, AWG),
        ).toEqual(before);
      }
      expect(before.tax2Total).toBe(0);
    }
  });
});

describe("credit notes credit both taxes in proportion", () => {
  it("EXCLUSIVE: a quarter of the line takes back a quarter of each tax", () => {
    expect(invoiceTotals([{ amount: 250 }], BOTH_EX, AWG)).toEqual({
      subtotal: 250,
      taxableSubtotal: 250,
      taxTotal: 7.5,
      tax2Total: 10,
      total: 267.5,
    });
  });

  it("INCLUSIVE: the credited gross contains both taxes, split by rate", () => {
    expect(invoiceTotals([{ amount: 53.5 }], BOTH_IN, AWG)).toMatchObject({ taxTotal: 1.5, tax2Total: 2, total: 53.5 });
  });

  it("crediting the whole invoice returns exactly the invoice's two taxes", () => {
    const invoice = invoiceTotals([{ amount: 812.4 }, { amount: 77.77 }], BOTH_EX, AWG);
    const credit = invoiceTotals([{ amount: 812.4 }, { amount: 77.77 }], BOTH_EX, AWG);
    expect(credit).toEqual(invoice);
  });
});

// ── Tax report ─────────────────────────────────────────────────────────────

function inv(p: Partial<TaxInvoice> & { id: string }): TaxInvoice {
  return {
    number: p.id.toUpperCase(),
    status: "ISSUED",
    currency: AWG,
    clientName: "Client",
    issueDate: "2026-09-05",
    subtotal: 1000,
    taxableSubtotal: 1000,
    taxTotal: 30,
    total: 1030,
    taxName: "BBO",
    taxPercent: 3,
    taxMode: "EXCLUSIVE",
    payments: [],
    ...p,
  };
}

const SEPT = { from: "2026-09-01", to: "2026-09-30" };
const ALL = { from: null, to: null };

const BOTH = inv({
  id: "x",
  tax2Name: "BAVP",
  tax2Percent: 4,
  tax2Total: 40,
  total: 1070,
  payments: [
    { paidAt: "2026-09-10", amount: 100 },
    { paidAt: "2026-10-05", amount: 970 },
  ],
});
const BBO_ONLY = inv({ id: "y" });

describe("tax report with two taxes", () => {
  it("counts each tax under its own name; a two-tax invoice is in both rows", () => {
    const r = buildTaxReport([BOTH, BBO_ONLY], SEPT);
    const awg = r.invoiced[0];
    expect(awg).toMatchObject({ currency: AWG, count: 2, gross: 2100, tax: 100, net: 2000, untaxed: 0 });
    expect(awg.lines.map((l) => [l.kind, l.name, l.percent, l.base, l.tax, l.count])).toEqual([
      ["BBO", "BBO", 3, 2000, 60, 2],
      ["BAVP", "BAVP", 4, 1000, 40, 1],
    ]);
    const row = r.invoices.find((x) => x.id === "x")!;
    expect(row).toMatchObject({ taxName: "BBO", taxPercent: 3, tax2Name: "BAVP", tax2Percent: 4, net: 1000, tax: 70, tax2: 40, gross: 1070 });
    expect(r.invoices.find((x) => x.id === "y")).toMatchObject({ tax2Name: null, tax2Percent: 0, tax: 30, tax2: 0 });
  });

  it("gives an INCLUSIVE two-tax invoice the same base on both rows", () => {
    const z = inv({ id: "z", taxMode: "INCLUSIVE", subtotal: 1070, taxableSubtotal: 1070, taxTotal: 30, tax2Name: "BAVP", tax2Percent: 4, tax2Total: 40, total: 1070 });
    const lines = buildTaxReport([z], SEPT).invoiced[0].lines;
    expect(lines.map((l) => [l.name, l.mode, l.base, l.tax])).toEqual([
      ["BBO", "INCLUSIVE", 1000, 30],
      ["BAVP", "INCLUSIVE", 1000, 40],
    ]);
  });

  it("received basis: each tax pro rata on its own, adding back to its own total to the cent", () => {
    const sept = buildTaxReport([BOTH], SEPT);
    // 100 of 1070: BBO 30 × 100/1070 = 2.80; BAVP 40 × 100/1070 = 3.74.
    expect(sept.payments).toHaveLength(1);
    expect(sept.payments[0]).toMatchObject({ gross: 100, tax: 6.54, tax2: 3.74, net: 93.46 });
    expect(sept.received[0].lines.map((l) => [l.name, l.tax])).toEqual([
      ["BBO", 2.8],
      ["BAVP", 3.74],
    ]);

    const all = buildTaxReport([BOTH], ALL);
    expect(all.received[0].lines.map((l) => [l.name, l.base, l.tax])).toEqual([
      ["BBO", 1000, 30],
      ["BAVP", 1000, 40],
    ]);
    expect(all.received[0]).toMatchObject({ gross: 1070, tax: 70, net: 1000 });
  });

  it("an invoice with no second tax reports exactly one row, as before", () => {
    const r = buildTaxReport([BBO_ONLY], SEPT);
    expect(r.invoiced[0].lines).toHaveLength(1);
    expect(r.invoiced[0].lines[0]).toMatchObject({ name: "BBO", base: 1000, tax: 30, count: 1 });
  });

  it("notes a second tax charged under no name", () => {
    const r = buildTaxReport([inv({ id: "n", tax2Name: null, tax2Percent: 4, tax2Total: 40, total: 1070 })], SEPT);
    expect(r.notes.map((n) => n.kind)).toEqual(["unnamed-tax"]);
  });
});

// ── Accounting export ──────────────────────────────────────────────────────

function invoice(p: Partial<InvoiceDTO>): InvoiceDTO {
  return {
    id: "i", number: "INV-1", status: "ISSUED", currency: AWG, clientId: null, clientName: "Client",
    projectId: null, projectName: null, proposalNumber: null, title: null, issueDate: "2026-09-10",
    dueDate: "2026-10-10", subtotal: 1000, taxTotal: 30, tax2Total: 40, total: 1070, paid: 0, credited: 0,
    outstanding: 1070, paymentCount: 0, lineCount: 0, updatedAt: "", contactName: null, contactEmail: null,
    billingAddress: null, serviceProposalId: null, intro: null, termsDays: 30, taxName: "BBO",
    taxPercent: 3, taxMode: "EXCLUSIVE", tax2Name: "BAVP", tax2Percent: 4, taxableSubtotal: 1000,
    notes: null, footer: null, createdByName: null, issuedByName: null, voidReason: null, voidedAt: null,
    createdAt: "", lines: [], payments: [], creditNotes: [],
    ...p,
  };
}

describe("accounting export with two taxes", () => {
  it("invoices file: tax 2 name, percent and amount beside the first tax", () => {
    const t = invoicesTable([invoice({}), invoice({ number: "INV-2", tax2Name: null, tax2Percent: 0, tax2Total: 0, total: 1030 })], ALL);
    const col = (name: string) => t.columns.indexOf(name);
    expect(t.rows[0][col("Tax")]).toBe("30.00");
    expect(t.rows[0][col("Tax 2 name")]).toBe("BAVP");
    expect(t.rows[0][col("Tax 2 %")]).toBe(4);
    expect(t.rows[0][col("Tax 2")]).toBe("40.00");
    expect(t.rows[0][col("Total")]).toBe("1070.00");
    expect(t.rows[1][col("Tax 2 name")]).toBe("");
    expect(t.rows[1][col("Tax 2 %")]).toBe("");
    expect(t.rows[1][col("Tax 2")]).toBe("0.00");
  });

  it("credit notes file carries the second tax too", () => {
    const note = {
      id: "c", number: "CN-2026-001", status: "ISSUED", invoiceId: "i", invoiceNumber: "INV-1",
      currency: AWG, clientId: null, clientName: "Client", projectId: null, projectName: null,
      date: "2026-09-15", reason: "Fee reduced", subtotal: 250, taxTotal: 7.5, tax2Total: 10, total: 267.5,
      updatedAt: "", contactName: null, contactEmail: null, billingAddress: null, taxName: "BBO",
      taxPercent: 3, taxMode: "EXCLUSIVE", tax2Name: "BAVP", tax2Percent: 4, taxableSubtotal: 250,
      notes: null, createdByName: null, issuedByName: null, issuedAt: null, voidReason: null,
      voidedAt: null, createdAt: "", lines: [],
    } satisfies CreditNoteDTO;
    const t = creditNotesTable([note], ALL);
    expect(t.rows[0][t.columns.indexOf("Tax")]).toBe("7.50");
    expect(t.rows[0][t.columns.indexOf("Tax 2 name")]).toBe("BAVP");
    expect(t.rows[0][t.columns.indexOf("Tax 2")]).toBe("10.00");
  });

  it("tax ledger: Net + Tax + Tax 2 = Gross on every row", () => {
    const t = taxTable([invoice({ payments: [{ id: "p", invoiceId: "i", paidAt: "2026-09-12", amount: 100, method: "BANK_TRANSFER", reference: null, notes: null, recordedByName: null, createdAt: "" }] })], ALL);
    const col = (name: string) => t.columns.indexOf(name);
    const [invoiced, received] = t.rows;
    expect([invoiced[col("Net")], invoiced[col("Tax")], invoiced[col("Tax 2 name")], invoiced[col("Tax 2")], invoiced[col("Gross")]]).toEqual([
      "1000.00", "30.00", "BAVP", "40.00", "1070.00",
    ]);
    expect([received[col("Net")], received[col("Tax")], received[col("Tax 2")], received[col("Gross")]]).toEqual([
      "93.46", "2.80", "3.74", "100.00",
    ]);
  });
});
