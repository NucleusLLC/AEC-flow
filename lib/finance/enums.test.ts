import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  FINANCE_APPROVAL_LABEL,
  FINANCE_APPROVAL_STATUSES,
  FINANCE_APPROVAL_TONE,
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  TAX_MODE_LABEL,
} from "./types";

/**
 * The tripwire promised in the header of lib/finance/types.ts, and the same one
 * the permit module carries: the unions there are a copy of the schema's enums
 * so client components can import them, and a copy drifts. On an invoice that
 * drift is worse than cosmetic — a payment method the schema knows and the
 * union does not is money that cannot be recorded.
 *
 * Reads the schema as text: no database, no Prisma client.
 */
const SCHEMA = readFileSync(resolve(__dirname, "../../prisma/schema.prisma"), "utf8");

function schemaEnum(name: string): string[] {
  const m = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`, "m").exec(SCHEMA);
  if (!m) throw new Error(`enum ${name} is not in prisma/schema.prisma`);
  return m[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => line.length > 0 && /^[A-Z0-9_]+$/.test(line));
}

describe("the enum unions match prisma/schema.prisma", () => {
  it("InvoiceStatus", () => {
    expect([...INVOICE_STATUSES].sort()).toEqual(schemaEnum("InvoiceStatus").sort());
  });

  it("InvoicePaymentMethod", () => {
    expect([...PAYMENT_METHODS].sort()).toEqual(schemaEnum("InvoicePaymentMethod").sort());
  });

  it("TaxMode — shared with the proposal module, so it must match there too", () => {
    expect(Object.keys(TAX_MODE_LABEL).sort()).toEqual(schemaEnum("TaxMode").sort());
  });

  it("FinanceApprovalStatus — shared by timesheets and expenses", () => {
    expect([...FINANCE_APPROVAL_STATUSES].sort()).toEqual(schemaEnum("FinanceApprovalStatus").sort());
  });

  it("ExpenseCategory", () => {
    expect([...EXPENSE_CATEGORIES].sort()).toEqual(schemaEnum("ExpenseCategory").sort());
  });
});

describe("every value has something to render", () => {
  it("every invoice status has a label and a badge tone", () => {
    for (const s of INVOICE_STATUSES) {
      expect(INVOICE_STATUS_LABEL[s], s).toBeTruthy();
      expect(INVOICE_STATUS_LABEL[s]).not.toBe(s);
      expect(INVOICE_STATUS_TONE[s], s).toBeTruthy();
    }
  });

  it("every approval status has a label and a badge tone", () => {
    for (const s of FINANCE_APPROVAL_STATUSES) {
      expect(FINANCE_APPROVAL_LABEL[s], s).toBeTruthy();
      expect(FINANCE_APPROVAL_LABEL[s]).not.toBe(s);
      expect(FINANCE_APPROVAL_TONE[s], s).toBeTruthy();
    }
  });

  it("every expense category has a label", () => {
    for (const c of EXPENSE_CATEGORIES) {
      expect(EXPENSE_CATEGORY_LABEL[c], c).toBeTruthy();
      expect(EXPENSE_CATEGORY_LABEL[c]).not.toBe(c);
    }
  });

  it("every payment method has a label", () => {
    for (const m of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABEL[m], m).toBeTruthy();
      expect(PAYMENT_METHOD_LABEL[m]).not.toBe(m);
    }
  });
});
