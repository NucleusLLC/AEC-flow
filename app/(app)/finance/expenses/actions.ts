"use server";

/**
 * Expense server actions. The sibling of ../time/actions.ts — read that header
 * for the contract: zod first, discriminated results, role checks in the data
 * layer where the write is.
 */

import { revalidatePath } from "next/cache";
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

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof ExpenseForbiddenError ||
    e instanceof ExpenseLockedError ||
    e instanceof ExpenseNotFoundError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function recordExpenseAction(input: ExpenseInput): Promise<ExpenseActionResult> {
  const parsed = parseExpenseInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
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
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
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
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
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
