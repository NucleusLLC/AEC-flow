/**
 * Who may do what to an invoice.
 *
 * Security audit D-6 (owner's ruling, 27 Nov 2026: "Director/Admin only").
 * Raising a draft and editing it is everyday work, open to every active member
 * except a VIEWER, who is read-only everywhere. Everything that makes an
 * invoice count, or undoes money, is for the people who manage the practice —
 * ADMIN, DIRECTOR or the founder, `canManagePasswords`, the same set that issues
 * and voids credit notes, approves expenses and exports the accounts:
 *
 *   - issuing an invoice (it becomes a demand for money);
 *   - emailing it or a receipt (it goes to any address the sender types);
 *   - recording a payment (it takes money off the balance and numbers a receipt);
 *   - voiding an issued invoice (it withdraws a demand and frees its work);
 *   - re-issuing a voided one as `<number>-2` (it re-claims the milestones);
 *   - reversing a recorded payment (it puts money back on the balance) — since
 *     0.38.0 a payment is reversed with a reason, never deleted;
 *   - deleting a draft invoice.
 *
 * One definition: the server actions and the data layer call it to ENFORCE,
 * and the invoice panel calls it only to decide whether to draw the buttons.
 * Stripe's webhook records online payments with no person behind them and does
 * not pass through here (lib/data/invoices.ts `recordStripePayment`).
 */
import { canManagePasswords, isReadOnlyRole } from "@/lib/password-policy";
import { READ_ONLY_REFUSAL } from "@/lib/permissions/role-gates";

export type InvoiceAction =
  | "create"
  | "edit"
  | "issue"
  | "send"
  | "recordPayment"
  | "void"
  | "reissue"
  | "reversePayment"
  | "deleteDraft";

/** The actions only an administrator, a director or the founder may take. */
export const MANAGER_ONLY_INVOICE_ACTIONS: readonly InvoiceAction[] = [
  "issue",
  "send",
  "recordPayment",
  "void",
  "reissue",
  "reversePayment",
  "deleteDraft",
];

export const INVOICE_MANAGER_ONLY =
  "Only an administrator or director can issue, email, void or re-issue an invoice, record or reverse a payment, or delete a draft.";

/** What a VIEWER is told when they try to raise or edit a draft. */
export const INVOICE_READ_ONLY = READ_ONLY_REFUSAL;

export function canDoInvoiceAction(
  action: InvoiceAction,
  role: string | null | undefined,
  isFounder: boolean,
): boolean {
  if (!MANAGER_ONLY_INVOICE_ACTIONS.includes(action)) return !isReadOnlyRole(role, isFounder);
  return canManagePasswords(role, isFounder);
}

/** True when the actor may issue, email, void and re-issue invoices, record and reverse payments and delete drafts. */
export function canManageInvoices(role: string | null | undefined, isFounder: boolean): boolean {
  return canManagePasswords(role, isFounder);
}

/** The refusal sentence for this action, or null when the actor may take it. */
export function invoiceRefusal(
  action: InvoiceAction,
  role: string | null | undefined,
  isFounder: boolean,
): string | null {
  if (canDoInvoiceAction(action, role, isFounder)) return null;
  return isReadOnlyRole(role, isFounder) ? INVOICE_READ_ONLY : INVOICE_MANAGER_ONLY;
}
