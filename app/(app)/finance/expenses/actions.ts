"use server";

/**
 * Expense server actions. The sibling of ../time/actions.ts — read that header
 * for the contract: zod first, discriminated results, role checks in the data
 * layer where the write is.
 */

import { revalidatePath } from "next/cache";
import { getServerT } from "@/lib/i18n/server";
import {
  decideExpenses,
  deleteExpense,
  markReimbursed,
  recordExpense,
  submitExpenses,
  updateExpense,
  ExpenseForbiddenError,
  ExpenseLockedError,
  ExpenseNotFoundError,
  attachReceipt,
  createReceiptUploadTicket,
  discardReceiptUpload,
  removeReceipt,
  ReceiptFileError,
  type ReceiptUploadTicket,
  type UploadedReceipt,
} from "@/lib/data/expenses";
import { issuesToMessage, parseApprovalDecision, parseExpenseInput } from "@/lib/finance/schema";
import type { ExpenseInput } from "@/lib/finance/types";

export type ExpenseActionResult =
  | { ok: true; id?: string; count?: number }
  | { ok: false; error: string };

const REGISTER = "/finance/expenses";

function revalidateExpenses(id?: string): void {
  revalidatePath(REGISTER);
  if (id) revalidatePath(`${REGISTER}/${id}/edit`);
  revalidatePath("/finance/invoices");
}

/** The zod messages are English keys; translate each one before joining them. */
async function issuesError(issues: { path: string; message: string }[]): Promise<string> {
  const t = await getServerT();
  return issuesToMessage(issues.map((i) => ({ ...i, message: t(i.message) })));
}

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof ExpenseForbiddenError ||
    e instanceof ExpenseLockedError ||
    e instanceof ExpenseNotFoundError ||
    e instanceof ReceiptFileError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function recordExpenseAction(input: ExpenseInput): Promise<ExpenseActionResult> {
  const parsed = parseExpenseInput(input);
  if (!parsed.ok) return { ok: false, error: await issuesError(parsed.issues) };
  try {
    const expense = await recordExpense(parsed.value as ExpenseInput);
    revalidateExpenses(expense.id);
    return { ok: true, id: expense.id };
  } catch (e) {
    return failure(e, "Failed to record that expense.");
  }
}

export async function updateExpenseAction(
  id: string,
  input: ExpenseInput,
): Promise<ExpenseActionResult> {
  const parsed = parseExpenseInput(input);
  if (!parsed.ok) return { ok: false, error: await issuesError(parsed.issues) };
  try {
    const expense = await updateExpense(id, parsed.value as ExpenseInput);
    revalidateExpenses(expense.id);
    return { ok: true, id: expense.id };
  } catch (e) {
    return failure(e, "Failed to save that expense.");
  }
}

export async function deleteExpenseAction(id: string): Promise<ExpenseActionResult> {
  try {
    await deleteExpense(id);
    revalidateExpenses(id);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete that expense.");
  }
}

export async function submitExpensesAction(ids: string[]): Promise<ExpenseActionResult> {
  try {
    const count = await submitExpenses(ids);
    revalidateExpenses();
    return { ok: true, count };
  } catch (e) {
    return failure(e, "Failed to send those expenses for approval.");
  }
}

export async function decideExpensesAction(
  ids: string[],
  decision: { approve: boolean; reason?: string | null },
): Promise<ExpenseActionResult> {
  const parsed = parseApprovalDecision(decision);
  if (!parsed.ok) return { ok: false, error: await issuesError(parsed.issues) };
  try {
    const count = await decideExpenses(ids, parsed.value);
    revalidateExpenses();
    return { ok: true, count };
  } catch (e) {
    return failure(e, "Failed to record that decision.");
  }
}

export async function markReimbursedAction(
  ids: string[],
  paid: boolean,
): Promise<ExpenseActionResult> {
  try {
    const count = await markReimbursed(ids, paid);
    revalidateExpenses();
    return { ok: true, count };
  } catch (e) {
    return failure(e, "Failed to record the reimbursement.");
  }
}

// ── Receipts ───────────────────────────────────────────────────────────────

export type ReceiptUploadTicketResult =
  | { ok: true; ticket: ReceiptUploadTicket }
  | { ok: false; error: string };

/** Step one of attaching a receipt: a signed URL the browser uploads to. */
export async function createReceiptUploadTicketAction(
  expenseId: string,
  file: { filename: string; mimeType: string; sizeBytes: number },
): Promise<ReceiptUploadTicketResult> {
  try {
    return { ok: true, ticket: await createReceiptUploadTicket(expenseId, file) };
  } catch (e) {
    return failure(e, "Could not prepare the upload.");
  }
}

/** Step three: record the uploaded receipt on the expense (replacing any). */
export async function attachReceiptAction(
  expenseId: string,
  upload: UploadedReceipt,
): Promise<ExpenseActionResult> {
  try {
    await attachReceipt(expenseId, upload);
    revalidateExpenses(expenseId);
    return { ok: true, id: expenseId };
  } catch (e) {
    await discardReceiptUpload(expenseId, upload?.storageKey ?? "").catch(() => {});
    return failure(e, "Failed to attach that receipt.");
  }
}

/** Best-effort clean-up when the browser's upload itself failed. */
export async function discardReceiptUploadAction(expenseId: string, storageKey: string): Promise<void> {
  await discardReceiptUpload(expenseId, storageKey).catch(() => {});
}

export async function removeReceiptAction(expenseId: string): Promise<ExpenseActionResult> {
  try {
    await removeReceipt(expenseId);
    revalidateExpenses(expenseId);
    return { ok: true, id: expenseId };
  } catch (e) {
    return failure(e, "Failed to remove that receipt.");
  }
}
