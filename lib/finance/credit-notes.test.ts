import { describe, expect, it } from "vitest";
import {
  checkCreditNote,
  creditableByLine,
  creditsOf,
  invoiceBalance,
  invoiceStatus,
  invoiceTotals,
  nextCreditNoteNumber,
  receivablesSummary,
  type CalcCredit,
} from "./calc";
import { creditNotesTable, invoicesTable } from "./export";
import type { CreditNoteDTO, InvoiceDTO } from "./types";

/**
 * Credit notes, through the one function that decides what an invoice still
 * owes (`invoiceBalance`) and the one guard that decides whether a credit may
 * be issued (`checkCreditNote`). Every screen, print, tile and export reads
 * the balance from the first, so these cases are the whole behaviour.
 */
const AWG = "AWG";
const issued = (amount: number, currency = AWG): CalcCredit => ({ amount, status: "ISSUED", currency });

describe("invoiceBalance with credit notes", () => {
  it("a partial credit reduces what is owed and nothing else", () => {
    expect(invoiceBalance({ total: 1060, currency: AWG, payments: [], credits: [issued(265)] })).toEqual({
      paid: 0,
      credited: 265,
      creditCount: 1,
      outstanding: 795,
      settled: false,
      overpaidBy: 0,
    });
  });

  it("a full credit settles the invoice with nothing received", () => {
    const b = invoiceBalance({ total: 1060, currency: AWG, payments: [], credits: [issued(1060)] });
    expect(b).toMatchObject({ paid: 0, credited: 1060, outstanding: 0, settled: true, overpaidBy: 0 });
  });

  it("a credit and a payment together settle it between them", () => {
    const b = invoiceBalance({
      total: 1000,
      currency: AWG,
      payments: [{ amount: 600 }],
      credits: [issued(150), issued(250)],
    });
    expect(b).toEqual({ paid: 600, credited: 400, creditCount: 2, outstanding: 0, settled: true, overpaidBy: 0 });
  });

  it("a credit and a payment that do not cover it leave the rest owed, to the cent", () => {
    const b = invoiceBalance({
      total: 100,
      currency: AWG,
      payments: [{ amount: 33.33 }],
      credits: [issued(33.33)],
    });
    expect(b.outstanding).toBe(33.34);
  });

  it("ignores a VOID credit note, so voiding one restores the balance", () => {
    const before = invoiceBalance({ total: 1000, currency: AWG, payments: [], credits: [issued(300)] });
    const after = invoiceBalance({
      total: 1000,
      currency: AWG,
      payments: [],
      credits: [{ amount: 300, status: "VOID", currency: AWG }],
    });
    expect(before.outstanding).toBe(700);
    expect(after).toMatchObject({ credited: 0, creditCount: 0, outstanding: 1000 });
  });

  it("ignores a DRAFT credit note — it has not been sent", () => {
    const b = invoiceBalance({
      total: 1000,
      currency: AWG,
      payments: [],
      credits: [{ amount: 300, status: "DRAFT", currency: AWG }],
    });
    expect(b.outstanding).toBe(1000);
  });

  it("never mixes currencies: a credit in another currency throws instead of being added", () => {
    expect(() =>
      invoiceBalance({ total: 1000, currency: AWG, payments: [], credits: [issued(100, "USD")] }),
    ).toThrow(/Currency mismatch/);
  });

  it("is settlement exactly when there are no credits", () => {
    const b = invoiceBalance({ total: 1590, currency: AWG, payments: [{ amount: 500 }] });
    expect(b).toMatchObject({ paid: 500, credited: 0, outstanding: 1090, settled: false });
  });
});

describe("checkCreditNote — the over-credit guard", () => {
  const invoice = {
    status: "PART_PAID" as const,
    total: 1000,
    currency: AWG,
    payments: [{ amount: 400 }],
    credits: [issued(100)],
  };

  it("allows a credit up to the outstanding balance, exactly", () => {
    expect(checkCreditNote(invoice, { amount: 500, currency: AWG })).toEqual({ ok: true, available: 500 });
  });

  it("refuses a credit one cent over the outstanding balance", () => {
    const r = checkCreditNote(invoice, { amount: 500.01, currency: AWG });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ available: 500, error: "A credit note cannot exceed the invoice's outstanding balance." });
  });

  it("refuses any credit on a fully settled invoice", () => {
    const r = checkCreditNote({ ...invoice, payments: [{ amount: 900 }] }, { amount: 0.01, currency: AWG });
    expect(r).toMatchObject({ ok: false, available: 0 });
  });

  it("does not count a VOID credit against the allowance", () => {
    const r = checkCreditNote(
      { ...invoice, credits: [{ amount: 600, status: "VOID", currency: AWG }] },
      { amount: 600, currency: AWG },
    );
    expect(r).toEqual({ ok: true, available: 600 });
  });

  it("refuses a credit in a different currency from its invoice", () => {
    expect(checkCreditNote(invoice, { amount: 10, currency: "USD" })).toMatchObject({
      ok: false,
      error: "A credit note must be in the same currency as its invoice.",
    });
  });

  it("refuses a zero credit, and anything against a draft or a void invoice", () => {
    expect(checkCreditNote(invoice, { amount: 0, currency: AWG }).ok).toBe(false);
    expect(checkCreditNote({ ...invoice, status: "DRAFT" }, { amount: 1, currency: AWG }).ok).toBe(false);
    expect(checkCreditNote({ ...invoice, status: "VOID" }, { amount: 1, currency: AWG }).ok).toBe(false);
  });

  it("a full credit of an unpaid invoice, built from its own lines, fits exactly", () => {
    // The form's FULL INVOICE fills each credit line with the invoice line's
    // amount; the same tax snapshot must give back the same total to the cent.
    const lines = [{ amount: 333.33 }, { amount: 333.33 }, { amount: 333.34, taxable: false }];
    const tax = { percent: 6, mode: "EXCLUSIVE" } as const;
    const inv = invoiceTotals(lines, tax, AWG);
    const credit = invoiceTotals(lines, tax, AWG);
    expect(
      checkCreditNote({ status: "ISSUED", total: inv.total, currency: AWG, payments: [] }, { amount: credit.total, currency: AWG }),
    ).toEqual({ ok: true, available: inv.total });
  });
});

describe("invoiceStatus with credit notes", () => {
  const base = { total: 1000, currency: AWG, issueDate: "2026-09-01" };

  it("CREDITED when credit notes settle it and nothing was received", () => {
    expect(invoiceStatus({ ...base, status: "ISSUED", payments: [], credits: [issued(1000)] })).toBe("CREDITED");
  });

  it("PAID when payments and credits settle it between them", () => {
    expect(
      invoiceStatus({ ...base, status: "ISSUED", payments: [{ amount: 700 }], credits: [issued(300)] }),
    ).toBe("PAID");
  });

  it("stays ISSUED / PART_PAID while money is still owed", () => {
    expect(invoiceStatus({ ...base, status: "ISSUED", payments: [], credits: [issued(300)] })).toBe("ISSUED");
    expect(
      invoiceStatus({ ...base, status: "ISSUED", payments: [{ amount: 100 }], credits: [issued(300)] }),
    ).toBe("PART_PAID");
  });

  it("goes back to ISSUED when the only credit is voided", () => {
    expect(
      invoiceStatus({
        ...base,
        status: "ISSUED",
        payments: [],
        credits: [{ amount: 1000, status: "VOID", currency: AWG }],
      }),
    ).toBe("ISSUED");
  });
});

describe("receivablesSummary with credit notes", () => {
  it("billed − received − credited = outstanding", () => {
    const s = receivablesSummary(
      [
        { status: "PART_PAID", total: 1000, paid: 400, credited: 100, outstanding: 500, dueDate: "2026-10-30" },
        { status: "CREDITED", total: 200, paid: 0, credited: 200, outstanding: 0, dueDate: "2026-01-01" },
      ],
      "2026-09-16",
      AWG,
    );
    expect(s).toMatchObject({ count: 2, billed: 1200, paid: 400, credited: 300, outstanding: 500, overdue: 0 });
  });
});

describe("nextCreditNoteNumber", () => {
  it("is made the same way as an invoice number, in its own CN series", () => {
    expect(nextCreditNoteNumber([], 2026)).toBe("CN-2026-001");
    expect(nextCreditNoteNumber(["CN-2026-001", "CN-2026-009"], 2026)).toBe("CN-2026-010");
  });
});

describe("creditableByLine", () => {
  it("is each line less what issued credit notes already took from it, never below zero", () => {
    const room = creditableByLine(
      [
        { id: "a", amount: 1000 },
        { id: "b", amount: 500 },
        { id: "c", amount: 200 },
      ],
      [
        { invoiceLineId: "a", amount: 333.33 },
        { invoiceLineId: "a", amount: 0.01 },
        { invoiceLineId: "c", amount: 250 },
        { invoiceLineId: null, amount: 99 },
      ],
      AWG,
    );
    expect(Object.fromEntries(room)).toEqual({ a: 666.66, b: 500, c: 0 });
  });
});

describe("creditsOf", () => {
  it("reads a credit note DTO total as its amount, keeping status and currency", () => {
    expect(creditsOf([{ total: 12.5, status: "VOID", currency: AWG }])).toEqual([
      { amount: 12.5, status: "VOID", currency: AWG },
    ]);
  });
});

describe("accounting export", () => {
  const ALL = { from: null, to: null };
  const note = (p: Partial<CreditNoteDTO>): CreditNoteDTO =>
    ({
      id: "c", number: "CN-2026-001", status: "ISSUED", invoiceId: "i", invoiceNumber: "INV-2026-004",
      currency: AWG, clientId: null, clientName: "Client", projectId: null, projectName: null,
      date: "2026-09-15", reason: "Fee reduced", subtotal: 250, taxTotal: 15, total: 265, updatedAt: "",
      contactName: null, contactEmail: null, billingAddress: null, taxName: "BBO", taxPercent: 6,
      taxMode: "EXCLUSIVE", taxableSubtotal: 250, notes: null, createdByName: null, issuedByName: null,
      issuedAt: null, voidReason: null, voidedAt: null, createdAt: "", lines: [],
      ...p,
    }) as CreditNoteDTO;

  it("writes one row per credit note in the books, drafts left out, voids kept", () => {
    const t = creditNotesTable(
      [
        note({}),
        note({ number: "CN-2026-002", status: "DRAFT" }),
        note({ number: "CN-2026-003", status: "VOID", voidedAt: "2026-09-20" }),
      ],
      ALL,
    );
    expect(t.rows.map((r) => r[0])).toEqual(["CN-2026-001", "CN-2026-003"]);
    expect(t.rows[0][t.columns.indexOf("Invoice number")]).toBe("INV-2026-004");
    expect(t.rows[0][t.columns.indexOf("Total")]).toBe("265.00");
    expect(t.rows[1][t.columns.indexOf("Voided on")]).toBe("2026-09-20");
  });

  it("filters by the credit note's own date", () => {
    expect(creditNotesTable([note({})], { from: "2026-10-01", to: null }).rows).toEqual([]);
  });

  it("puts what was credited beside what was paid on the invoices file", () => {
    const inv = {
      id: "i", number: "INV-1", status: "PART_PAID", currency: AWG, clientName: "C", issueDate: "2026-09-01",
      dueDate: null, subtotal: 1000, taxTotal: 60, total: 1060, paid: 400, credited: 265, outstanding: 395,
      taxName: "BBO", taxPercent: 6, taxMode: "EXCLUSIVE", lines: [], payments: [], creditNotes: [],
    } as unknown as InvoiceDTO;
    const t = invoicesTable([inv], ALL);
    expect(t.rows[0][t.columns.indexOf("Paid")]).toBe("400.00");
    expect(t.rows[0][t.columns.indexOf("Credited")]).toBe("265.00");
    expect(t.rows[0][t.columns.indexOf("Outstanding")]).toBe("395.00");
  });
});
