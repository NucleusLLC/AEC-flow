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
 *
 * VOID, DELETE A PAYMENT and DELETE A DRAFT are for an administrator, a director
 * or the founder (lib/finance/invoice-permissions.ts) — checked here first, so
 * the refusal is a plain sentence, and again in lib/data/invoices.ts. Raising,
 * editing a draft, issuing and recording a payment stay open to every member.
 */

import { revalidatePath } from "next/cache";
import { getServerT } from "@/lib/i18n/server";
import { requireActor } from "@/lib/server/actor";
import { canDoInvoiceAction, INVOICE_MANAGER_ONLY, type InvoiceAction } from "@/lib/finance/invoice-permissions";
import {
  createInvoice,
  deleteInvoice,
  deletePayment,
  issueInvoice,
  recordPayment,
  updateInvoice,
  voidInvoice,
  InvoiceForbiddenError,
  InvoiceLockedError,
  InvoiceNotFoundError,
  InvoiceNumberInUseError,
} from "@/lib/data/invoices";
import { raiseInvoiceFromWork, WorkBillingError } from "@/lib/data/work-billing";
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

/** The zod messages are English keys; translate each one before joining them. */
async function issuesError(issues: { path: string; message: string }[]): Promise<string> {
  const t = await getServerT();
  return issuesToMessage(issues.map((i) => ({ ...i, message: t(i.message) })));
}

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof InvoiceForbiddenError ||
    e instanceof InvoiceNumberInUseError ||
    e instanceof InvoiceNotFoundError ||
    e instanceof InvoiceLockedError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Signed in AND allowed this action; a refusal is the reason, not a digest. */
async function invoiceGate(action: InvoiceAction): Promise<{ ok: false; error: string } | null> {
  try {
    const actor = await requireActor();
    if (!canDoInvoiceAction(action, actor.role, actor.isFounder)) return { ok: false, error: INVOICE_MANAGER_ONLY };
    return null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "You must be signed in." };
  }
}

export async function createInvoiceAction(input: InvoiceInput): Promise<InvoiceActionResult> {
  const parsed = parseInvoiceInput(input);
  if (!parsed.ok) return { ok: false, error: await issuesError(parsed.issues) };
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
  if (!parsed.ok) return { ok: false, error: await issuesError(parsed.issues) };
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
  const denied = await invoiceGate("void");
  if (denied) return denied;
  try {
    const invoice = await voidInvoice(id, reason);
    revalidateInvoice(invoice.id);
    return { ok: true, id: invoice.id };
  } catch (e) {
    return failure(e, "Failed to void the invoice.");
  }
}

export async function deleteInvoiceAction(id: string): Promise<InvoiceActionResult> {
  const denied = await invoiceGate("deleteDraft");
  if (denied) return denied;
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
  if (!parsed.ok) return { ok: false, error: await issuesError(parsed.issues) };
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
  const denied = await invoiceGate("deletePayment");
  if (denied) return denied;
  try {
    await deletePayment(id);
    revalidateInvoice(invoiceId);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the payment.");
  }
}

/**
 * Raise a draft invoice from a project's approved, unbilled time and expenses.
 *
 * Takes FormData because the screen is a plain progressively-enhanced form: the
 * ticked lines travel as repeated `line` fields. The heavy lifting — grouping,
 * totals, and stamping the source rows inside one transaction — is
 * `raiseInvoiceFromWork`; this only translates the payload and the errors.
 */
export async function raiseFromWorkAction(form: FormData): Promise<InvoiceActionResult> {
  const projectId = String(form.get("projectId") ?? "").trim();
  const lineKeys = form.getAll("line").map(String).filter(Boolean);
  const summarise = form.get("summarise") === "on";
  const taxName = String(form.get("taxName") ?? "").trim() || null;
  const taxPercentRaw = Number(form.get("taxPercent"));
  const taxPercent = Number.isFinite(taxPercentRaw) ? Math.max(0, taxPercentRaw) : 0;
  // What the screen showed. Sent so the data layer can refuse if the work has
  // moved since — see `expectedTotal` in lib/data/work-billing.ts.
  const expectedRaw = Number(form.get("expectedTotal"));
  const expectedTotal = Number.isFinite(expectedRaw) ? expectedRaw : undefined;

  if (!projectId) return { ok: false, error: "No project was chosen." };
  if (lineKeys.length === 0) return { ok: false, error: "Tick at least one line to bill." };

  try {
    const raised = await raiseInvoiceFromWork({
      projectId,
      lineKeys,
      summarise,
      taxName,
      taxPercent,
      expectedTotal,
    });
    revalidateInvoice(raised.id);
    revalidatePath("/finance/time");
    revalidatePath("/finance/expenses");
    revalidatePath("/finance/profit");
    return { ok: true, id: raised.id };
  } catch (e) {
    if (e instanceof WorkBillingError) return { ok: false, error: e.message };
    return failure(e, "Failed to raise the invoice.");
  }
}
