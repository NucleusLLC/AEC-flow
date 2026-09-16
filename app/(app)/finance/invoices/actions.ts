"use server";

/**
 * Invoice server actions.
 *
 * Each one re-parses its payload through the zod gate before the data layer
 * sees it, and returns a discriminated result rather than throwing. On an
 * invoice that matters more than elsewhere: a thrown action reaches the user as
 * a digest string, and "did that save?" about money is the worst question a
 * screen can leave open.
 *
 * There is deliberately no action that edits an issued invoice, and none that
 * sets a status to PAID: payments are recorded, and the status follows the
 * money (lib/finance/calc.ts).
 */

import { revalidatePath } from "next/cache";
import {
  createInvoice,
  deleteInvoice,
  deletePayment,
  issueInvoice,
  recordPayment,
  updateInvoice,
  voidInvoice,
  InvoiceLockedError,
  InvoiceNotFoundError,
  InvoiceNumberInUseError,
} from "@/lib/data/invoices";
import {
  issuesToMessage,
  parseInvoiceInput,
  parseInvoicePaymentInput,
} from "@/lib/finance/schema";
import type { InvoiceInput, InvoicePaymentInput } from "@/lib/finance/types";

export type InvoiceActionResult = { ok: true; id: string } | { ok: false; error: string };

const REGISTER = "/finance/invoices";

function revalidateInvoice(id: string): void {
  revalidatePath(REGISTER);
  revalidatePath(`${REGISTER}/${id}`);
}

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof InvoiceNumberInUseError ||
    e instanceof InvoiceNotFoundError ||
    e instanceof InvoiceLockedError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function createInvoiceAction(input: InvoiceInput): Promise<InvoiceActionResult> {
  const parsed = parseInvoiceInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const invoice = await createInvoice(parsed.value as InvoiceInput);
    revalidateInvoice(invoice.id);
    return { ok: true, id: invoice.id };
  } catch (e) {
    return failure(e, "Failed to create the invoice.");
  }
}

export async function updateInvoiceAction(
  id: string,
  input: InvoiceInput,
): Promise<InvoiceActionResult> {
  const parsed = parseInvoiceInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const invoice = await updateInvoice(id, parsed.value as InvoiceInput);
    revalidateInvoice(invoice.id);
    return { ok: true, id: invoice.id };
  } catch (e) {
    return failure(e, "Failed to save the invoice.");
  }
}

export async function issueInvoiceAction(
  id: string,
  dates: { issueDate?: string | null; dueDate?: string | null } = {},
): Promise<InvoiceActionResult> {
  try {
    const invoice = await issueInvoice(id, dates);
    revalidateInvoice(invoice.id);
    return { ok: true, id: invoice.id };
  } catch (e) {
    return failure(e, "Failed to issue the invoice.");
  }
}

export async function voidInvoiceAction(id: string, reason: string): Promise<InvoiceActionResult> {
  try {
    const invoice = await voidInvoice(id, reason);
    revalidateInvoice(invoice.id);
    return { ok: true, id: invoice.id };
  } catch (e) {
    return failure(e, "Failed to void the invoice.");
  }
}

export async function deleteInvoiceAction(id: string): Promise<InvoiceActionResult> {
  try {
    await deleteInvoice(id);
    revalidateInvoice(id);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the invoice.");
  }
}

export async function recordPaymentAction(
  invoiceId: string,
  input: InvoicePaymentInput,
): Promise<InvoiceActionResult> {
  const parsed = parseInvoicePaymentInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const payment = await recordPayment(invoiceId, parsed.value as InvoicePaymentInput);
    revalidateInvoice(invoiceId);
    return { ok: true, id: payment.id };
  } catch (e) {
    return failure(e, "Failed to record the payment.");
  }
}

export async function deletePaymentAction(
  invoiceId: string,
  id: string,
): Promise<InvoiceActionResult> {
  try {
    await deletePayment(id);
    revalidateInvoice(invoiceId);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the payment.");
  }
}
