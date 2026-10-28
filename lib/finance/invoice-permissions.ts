/**
 * Who may do what to an invoice.
 *
 * Raising, editing a draft, issuing, emailing and recording a payment are
 * everyday work and stay open to every active member. Four things undo money or
 * records and are for the people who manage the practice — ADMIN, DIRECTOR or
 * the founder, `canManagePasswords`, the same set that issues and voids credit
 * notes, approves expenses and exports the accounts:
 *
 *   - voiding an issued invoice (it withdraws a demand and frees its work);
 *   - re-issuing a voided one as `<number>-2` (it re-claims the milestones);
 *   - reversing a recorded payment (it puts money back on the balance) — since
 *     0.38.0 a payment is reversed with a reason, never deleted;
 *   - deleting a draft invoice.
 *
 * One definition: the server actions and the data layer call it to ENFORCE,
 * and the invoice panel calls it only to decide whether to draw the buttons.
 */
import { canManagePasswords } from "@/lib/password-policy";

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
export const MANAGER_ONLY_INVOICE_ACTIONS: readonly InvoiceAction[] = ["void", "reissue", "reversePayment", "deleteDraft"];

export const INVOICE_MANAGER_ONLY =
  "Only an administrator or director can void or re-issue an invoice, reverse a payment or delete a draft.";

export function canDoInvoiceAction(
  action: InvoiceAction,
  role: string | null | undefined,
  isFounder: boolean,
): boolean {
  if (!MANAGER_ONLY_INVOICE_ACTIONS.includes(action)) return true;
  return canManagePasswords(role, isFounder);
}

/** True when the actor may void and re-issue invoices, reverse payments and delete drafts. */
export function canManageInvoices(role: string | null | undefined, isFounder: boolean): boolean {
  return canManagePasswords(role, isFounder);
}
