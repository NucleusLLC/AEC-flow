import { describe, expect, it } from "vitest";
import {
  INVOICE_MANAGER_ONLY,
  INVOICE_READ_ONLY,
  canDoInvoiceAction,
  canManageInvoices,
  invoiceRefusal,
  MANAGER_ONLY_INVOICE_ACTIONS,
  type InvoiceAction,
} from "./invoice-permissions";

const DRAFTING: InvoiceAction[] = ["create", "edit"];
const ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "STAFF", "VIEWER"] as const;

describe("invoice permissions (security audit D-6)", () => {
  it("lets any member but a VIEWER raise and edit a draft", () => {
    for (const a of DRAFTING) {
      for (const role of ROLES) expect(canDoInvoiceAction(a, role, false), `${role} ${a}`).toBe(role !== "VIEWER");
      expect(canDoInvoiceAction(a, "MEMBER", false)).toBe(true);
      expect(canDoInvoiceAction(a, "VIEWER", true)).toBe(true);
    }
  });

  it("keeps issue, email, payments, void, re-issue and delete draft for Admin, Director and the founder", () => {
    expect([...MANAGER_ONLY_INVOICE_ACTIONS].sort()).toEqual([
      "deleteDraft",
      "issue",
      "recordPayment",
      "reissue",
      "reversePayment",
      "send",
      "void",
    ]);
    for (const a of MANAGER_ONLY_INVOICE_ACTIONS) {
      expect(canDoInvoiceAction(a, "ADMIN", false)).toBe(true);
      expect(canDoInvoiceAction(a, "DIRECTOR", false)).toBe(true);
      expect(canDoInvoiceAction(a, "MEMBER", true)).toBe(true);
      expect(canDoInvoiceAction(a, "MANAGER", false)).toBe(false);
      expect(canDoInvoiceAction(a, "STAFF", false)).toBe(false);
      expect(canDoInvoiceAction(a, "VIEWER", false)).toBe(false);
      expect(canDoInvoiceAction(a, "MEMBER", false)).toBe(false);
      expect(canDoInvoiceAction(a, undefined, false)).toBe(false);
    }
  });

  it("explains a refusal: read-only for a VIEWER, manager-only for everyone else", () => {
    expect(invoiceRefusal("create", "VIEWER", false)).toBe(INVOICE_READ_ONLY);
    expect(invoiceRefusal("issue", "VIEWER", false)).toBe(INVOICE_READ_ONLY);
    expect(invoiceRefusal("issue", "STAFF", false)).toBe(INVOICE_MANAGER_ONLY);
    expect(invoiceRefusal("recordPayment", "MANAGER", false)).toBe(INVOICE_MANAGER_ONLY);
    expect(invoiceRefusal("issue", "DIRECTOR", false)).toBeNull();
    expect(invoiceRefusal("create", "STAFF", false)).toBeNull();
  });

  it("canManageInvoices is the same gate", () => {
    expect(canManageInvoices("DIRECTOR", false)).toBe(true);
    expect(canManageInvoices("MEMBER", false)).toBe(false);
  });
});
