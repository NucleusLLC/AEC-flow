import { describe, expect, it } from "vitest";
import {
  BOM,
  buildTable,
  csvCell,
  exportFilename,
  inRange,
  invoiceLinesTable,
  invoicesTable,
  isExportKind,
  money,
  parseRange,
  paymentsTable,
  timeTable,
  expensesTable,
  toCsv,
} from "./export";
import type { ExpenseDTO, InvoiceDTO, TimeEntryDTO } from "./types";

const ALL = { from: null, to: null };

function invoice(p: Partial<InvoiceDTO>): InvoiceDTO {
  return {
    id: "i", number: "INV-1", status: "ISSUED", currency: "AWG", clientId: null, clientName: "Client",
    projectId: null, projectName: null, proposalNumber: null, title: null, issueDate: "2026-02-10",
    dueDate: "2026-03-12", subtotal: 1000, taxTotal: 70, total: 1070, paid: 0, outstanding: 1070,
    paymentCount: 0, lineCount: 0, updatedAt: "", contactName: null, contactEmail: null,
    billingAddress: null, serviceProposalId: null, intro: null, termsDays: 30, taxName: "BBO",
    taxPercent: 7, taxMode: "EXCLUSIVE", taxableSubtotal: 1000, notes: null, footer: null,
    createdByName: null, issuedByName: null, voidReason: null, voidedAt: null, createdAt: "",
    lines: [], payments: [],
    ...p,
  } as InvoiceDTO;
}

function entry(p: Partial<TimeEntryDTO>): TimeEntryDTO {
  return {
    id: "t", userId: "u", userName: "Ana", projectId: null, projectName: "Villa", phaseId: null,
    phaseName: null, date: "2026-02-03", hours: 2.5, billable: true, chargeRate: 100, costRate: 40,
    currency: "AWG", description: null, status: "APPROVED", submittedAt: null, approvedAt: null,
    approvedByName: null, rejectedReason: null, invoicedAt: null, invoiceId: null,
    invoiceNumber: null, value: 250, createdAt: "", updatedAt: "",
    ...p,
  } as TimeEntryDTO;
}

function expense(p: Partial<ExpenseDTO>): ExpenseDTO {
  return {
    id: "e", userId: "u", userName: "Ana", projectId: null, projectName: null, date: "2026-02-04",
    category: "TRAVEL", vendor: "Taxi", description: "Site visit", amount: 25, currency: "AWG",
    billable: true, markupPercent: 10, reimbursable: true, reimbursedAt: null, status: "APPROVED",
    submittedAt: null, approvedAt: null, approvedByName: null, rejectedReason: null,
    invoicedAt: null, invoiceId: null, invoiceNumber: null, chargeable: 27.5, createdAt: "",
    updatedAt: "",
    ...p,
  } as ExpenseDTO;
}

describe("parseRange", () => {
  it("accepts open, half-open and closed ranges", () => {
    expect(parseRange(undefined, undefined)).toEqual({ ok: true, range: ALL });
    expect(parseRange("2026-01-01", "")).toEqual({ ok: true, range: { from: "2026-01-01", to: null } });
    expect(parseRange("2026-01-01", "2026-03-31")).toEqual({
      ok: true,
      range: { from: "2026-01-01", to: "2026-03-31" },
    });
  });

  it("refuses a bad date or a backwards range", () => {
    expect(parseRange("2026-02-30", null).ok).toBe(false);
    expect(parseRange("01/02/2026", null).ok).toBe(false);
    expect(parseRange(null, "tomorrow").ok).toBe(false);
    expect(parseRange("2026-04-01", "2026-03-31")).toEqual({
      ok: false,
      error: "The end date is before the start date.",
    });
  });
});

describe("inRange", () => {
  it("is inclusive at both ends and ignores the time part", () => {
    const r = { from: "2026-01-01", to: "2026-01-31" };
    expect(inRange("2026-01-01", r)).toBe(true);
    expect(inRange("2026-01-31T23:59:00.000Z", r)).toBe(true);
    expect(inRange("2026-02-01", r)).toBe(false);
    expect(inRange("2025-12-31", r)).toBe(false);
  });

  it("keeps an undated row only when the range is open", () => {
    expect(inRange(null, ALL)).toBe(true);
    expect(inRange(null, { from: "2026-01-01", to: null })).toBe(false);
  });
});

describe("money", () => {
  it("is two decimals with a dot and no separators", () => {
    expect(money(1234567.5)).toBe("1234567.50");
    expect(money(1.005)).toBe("1.01");
    expect(money(-0.001)).toBe("0.00");
    expect(money(null)).toBe("");
    expect(money(Number.NaN)).toBe("");
  });
});

describe("invoices", () => {
  const invoices = [
    invoice({ number: "INV-3", issueDate: "2026-03-01" }),
    invoice({ number: "INV-0", status: "DRAFT", issueDate: null }),
    invoice({ number: "INV-2", status: "VOID", issueDate: "2026-02-15", outstanding: 1070, voidedAt: "2026-02-20" }),
    invoice({ number: "INV-1", status: "PART_PAID", issueDate: "2026-02-10", paid: 500, outstanding: 570 }),
  ];

  it("leaves drafts out, keeps voids with nothing outstanding, sorts by issue date", () => {
    const t = invoicesTable(invoices, ALL);
    expect(t.rows.map((r) => r[0])).toEqual(["INV-1", "INV-2", "INV-3"]);
    const voided = t.rows[1];
    expect(voided[1]).toBe("VOID");
    expect(voided[t.columns.indexOf("Outstanding")]).toBe("0.00");
    expect(voided[t.columns.indexOf("Voided on")]).toBe("2026-02-20");
    expect(t.rows[0][t.columns.indexOf("Paid")]).toBe("500.00");
  });

  it("filters on the issue date", () => {
    const t = invoicesTable(invoices, { from: "2026-02-01", to: "2026-02-28" });
    expect(t.rows.map((r) => r[0])).toEqual(["INV-1", "INV-2"]);
  });

  it("lists lines in their own order under each invoice", () => {
    const inv = invoice({
      lines: [
        { id: "b", invoiceId: "i", description: "Second", milestoneId: null, milestoneName: null, quantity: null, unitRate: null, amount: 200, taxable: false, sortOrder: 2 },
        { id: "a", invoiceId: "i", description: "First", milestoneId: "m", milestoneName: "Concept", quantity: 2, unitRate: 400, amount: 800, taxable: true, sortOrder: 1 },
      ],
    });
    const t = invoiceLinesTable([inv, invoice({ status: "DRAFT", lines: inv.lines })], ALL);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toEqual(["INV-1", "ISSUED", "2026-02-10", "Client", "", "First", "Concept", 2, "400.00", "800.00", "Yes", "AWG"]);
    expect(t.rows[1][5]).toBe("Second");
    expect(t.rows[1][7]).toBe("");
  });
});

describe("payments", () => {
  it("filters on the payment date, not the invoice's, and sorts by date", () => {
    const pay = (id: string, paidAt: string, amount: number) => ({
      id, invoiceId: "i", paidAt, amount, method: "BANK_TRANSFER" as const, reference: `ref-${id}`,
      notes: null, recordedByName: "Greg", createdAt: "",
    });
    const t = paymentsTable(
      [
        invoice({ number: "INV-9", issueDate: "2025-12-01", payments: [pay("x", "2026-01-20", 100), pay("y", "2025-12-15", 50)] }),
        invoice({ number: "INV-8", issueDate: "2026-01-02", payments: [pay("z", "2026-01-05", 75)] }),
        invoice({ number: "INV-7", status: "DRAFT", payments: [pay("d", "2026-01-06", 1)] }),
      ],
      { from: "2026-01-01", to: "2026-01-31" },
    );
    expect(t.rows.map((r) => [r[0], r[1], r[4]])).toEqual([
      ["2026-01-05", "INV-8", "75.00"],
      ["2026-01-20", "INV-9", "100.00"],
    ]);
  });
});

describe("time and expenses", () => {
  it("exports approved time only, with value and cost", () => {
    const t = timeTable(
      [entry({}), entry({ status: "SUBMITTED" }), entry({ status: "DRAFT" }), entry({ costRate: null, invoiceNumber: "INV-4", invoicedAt: "2026-02-28T10:00:00Z" })],
      ALL,
    );
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0][t.columns.indexOf("Charge value")]).toBe("250.00");
    expect(t.rows[0][t.columns.indexOf("Cost")]).toBe("100.00");
    expect(t.rows[1][t.columns.indexOf("Cost")]).toBe("");
    expect(t.rows[1][t.columns.indexOf("Invoiced on")]).toBe("2026-02-28");
  });

  it("exports approved expenses only, with markup and reimbursement", () => {
    const t = expensesTable([expense({}), expense({ status: "REJECTED" })], ALL);
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0][t.columns.indexOf("Chargeable")]).toBe("27.50");
    expect(t.rows[0][t.columns.indexOf("Reimbursable")]).toBe("Yes");
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('Smith, "Jr"')).toBe('"Smith, ""Jr"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(2.5)).toBe("2.5");
  });

  it("stops a typed value from running as a spreadsheet formula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+31 6 1234")).toBe("'+31 6 1234");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-cmd")).toBe("'-cmd");
    // A negative amount is a number, not a formula.
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(csvCell(-12.5)).toBe("-12.5");
  });

  it("starts with a BOM and ends every line with CRLF", () => {
    const csv = toCsv({ columns: ["A", "B"], rows: [["Café", 1]] });
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}A,B\r\nCafé,1\r\n`);
  });

  it("writes a header even when nothing is in range", () => {
    const csv = toCsv(buildTable("payments", { invoices: [] }, ALL));
    expect(csv).toBe(`${BOM}Paid on,Invoice number,Client,Project,Amount,Currency,Method,Reference,Recorded by\r\n`);
  });
});

describe("naming", () => {
  it("knows its kinds", () => {
    expect(isExportKind("invoices")).toBe(true);
    expect(isExportKind("team")).toBe(false);
  });

  it("puts the range in the filename", () => {
    expect(exportFilename("invoices", { from: "2026-01-01", to: "2026-03-31" }, "2026-10-02")).toBe(
      "accounting-invoices-2026-01-01-to-2026-03-31.csv",
    );
    expect(exportFilename("time", ALL, "2026-10-02")).toBe("accounting-time-start-to-2026-10-02.csv");
  });
});
