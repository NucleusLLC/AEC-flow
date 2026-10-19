import { describe, expect, it } from "vitest";
import { canDoInvoiceAction, canManageInvoices, MANAGER_ONLY_INVOICE_ACTIONS, type InvoiceAction } from "./invoice-permissions";

const OPEN: InvoiceAction[] = ["create", "edit", "issue", "recordPayment"];

describe("invoice permissions", () => {
  it("lets any member raise, edit, issue and take a payment", () => {
    for (const a of OPEN) {
      expect(canDoInvoiceAction(a, "MEMBER", false)).toBe(true);
      expect(canDoInvoiceAction(a, null, false)).toBe(true);
    }
  });

  it("keeps void, delete payment and delete draft for Admin, Director and the founder", () => {
    expect([...MANAGER_ONLY_INVOICE_ACTIONS].sort()).toEqual(["deleteDraft", "deletePayment", "void"]);
    for (const a of MANAGER_ONLY_INVOICE_ACTIONS) {
      expect(canDoInvoiceAction(a, "ADMIN", false)).toBe(true);
      expect(canDoInvoiceAction(a, "DIRECTOR", false)).toBe(true);
      expect(canDoInvoiceAction(a, "MEMBER", true)).toBe(true);
      expect(canDoInvoiceAction(a, "MEMBER", false)).toBe(false);
      expect(canDoInvoiceAction(a, "PROJECT_MANAGER", false)).toBe(false);
      expect(canDoInvoiceAction(a, undefined, false)).toBe(false);
    }
  });

  it("canManageInvoices is the same gate", () => {
    expect(canManageInvoices("DIRECTOR", false)).toBe(true);
    expect(canManageInvoices("MEMBER", false)).toBe(false);
  });
});
