/**
 * Who may do what to an invoice.
 *
 * Raising, editing a draft, issuing and recording a payment are everyday work
 * and stay open to every active member. Three things undo money or records and
 * are for the people who manage the practice — ADMIN, DIRECTOR or the founder,
 * `canManagePasswords`, the same set that issues and voids credit notes,
 * approves expenses and exports the accounts:
 *
 *   - voiding an issued invoice (it withdraws a demand and frees its work);
 *   - deleting a recorded payment (it puts money back on the balance);
 *   - deleting a draft invoice.
 *
 * One definition: the server actions and the data layer call it to ENFORCE,
 * and the invoice panel calls it only to decide whether to draw the buttons.
 */
import { canManagePasswords } from "@/lib/password-policy";

export type InvoiceAction = "create" | "edit" | "issue" | "recordPayment" | "void" | "deletePayment" | "deleteDraft";

/** The actions only an administrator, a director or the founder may take. */
export const MANAGER_ONLY_INVOICE_ACTIONS: readonly InvoiceAction[] = ["void", "deletePayment", "deleteDraft"];

export const INVOICE_MANAGER_ONLY = "Only an administrator or director can void an invoice or delete a payment or a draft.";

export function canDoInvoiceAction(
  action: InvoiceAction,
  role: string | null | undefined,
  isFounder: boolean,
): boolean {
  if (!MANAGER_ONLY_INVOICE_ACTIONS.includes(action)) return true;
  return canManagePasswords(role, isFounder);
}

/** True when the actor may void invoices and delete payments and drafts. */
export function canManageInvoices(role: string | null | undefined, isFounder: boolean): boolean {
  return canManagePasswords(role, isFounder);
}
