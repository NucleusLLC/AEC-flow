/**
 * Emailing an invoice or a payment receipt WITH ITS PDF, and generating those
 * PDFs on the server. SERVER-ONLY in practice (it reaches the session, Prisma
 * and the mail provider through its imports); like lib/server/document-email.ts
 * it does not `import "server-only"`, so the orchestration below — the part
 * that decides whether an invoice is marked SENT — can be unit-tested with its
 * edges mocked (lib/server/invoice-email.test.ts).
 *
 * ─── THE ONE RULE, INHERITED ─────────────────────────────────────────────────
 * There is ONE email path: `sendDocumentEmail`. It returns `ok: true` only when
 * the mail provider handed back a message id, and it logs every attempt. This
 * file adds exactly one thing on top: an invoice is stamped SENT (and its
 * sent-to / by / at / count) ONLY on that `ok: true`. Not when the PDF was
 * built, not when the request "went out", not on `unconfirmed`. A failure
 * leaves the invoice exactly as it was, and the email log says why.
 */
import { requireActor } from "@/lib/server/actor";
import { getFirmIdentity } from "@/lib/server/firm";
import { getInvoiceSettings, getPracticeSettings } from "@/lib/server/practice-config";
import { getServerT } from "@/lib/i18n/server";
import { sendDocumentEmail, type SendDocumentEmailResult } from "@/lib/server/document-email";
import {
  getInvoice,
  getReceipt,
  markInvoiceSent,
  requireSendableInvoice,
  InvoiceActionError,
  InvoiceNotFoundError,
} from "@/lib/data/invoices";
import { buildInvoicePdf, buildReceiptPdf, pdfToBase64, type PdfFirm } from "@/lib/finance/invoice-pdf";
import { safeFilename } from "@/lib/email/attachments";

/** What the compose card may supply. Nothing else — see document-email's SECURITY note. */
export type InvoiceEmailInput = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
};

async function firmForPdf(): Promise<PdfFirm> {
  const [firm, practice] = await Promise.all([getFirmIdentity(), getPracticeSettings()]);
  return { name: firm.name, location: firm.location, logoDataUrl: practice.logoDataUrl };
}

/** The invoice as PDF bytes, with its filename. Null when there is no such invoice. */
export async function renderInvoicePdf(id: string): Promise<{ filename: string; bytes: Uint8Array } | null> {
  const invoice = await getInvoice(id);
  if (!invoice) return null;
  const [firm, settings, t] = await Promise.all([firmForPdf(), getInvoiceSettings(), getServerT()]);
  const bytes = await buildInvoicePdf({ invoice, firm, settings, t });
  return { filename: safeFilename(`${invoice.number}.pdf`, "invoice.pdf"), bytes };
}

/** A payment's receipt as PDF bytes, with its filename. Numbers the payment first if it has no number. */
export async function renderReceiptPdf(paymentId: string): Promise<{ filename: string; bytes: Uint8Array } | null> {
  const found = await getReceipt(paymentId);
  if (!found) return null;
  const [firm, t] = await Promise.all([firmForPdf(), getServerT()]);
  const bytes = await buildReceiptPdf({ ...found, firm, t });
  const name = found.payment.receiptNumber ?? `receipt-${paymentId}`;
  return { filename: safeFilename(`${name}.pdf`, "receipt.pdf"), bytes };
}

/** The module edges, injectable so the SENT rule can be tested without a provider or a database. */
export type InvoiceEmailDeps = {
  requireSendable: (id: string) => Promise<void>;
  render: (id: string) => Promise<{ filename: string; bytes: Uint8Array } | null>;
  send: typeof sendDocumentEmail;
  markSent: (id: string, sentTo: string) => Promise<void>;
};

const DEFAULT_DEPS: InvoiceEmailDeps = {
  requireSendable: requireSendableInvoice,
  render: renderInvoicePdf,
  send: sendDocumentEmail,
  markSent: markInvoiceSent,
};

/**
 * Email an issued invoice with its PDF attached. On `ok: true` — and only then
 * — the invoice is stamped sent (ISSUED → SENT). Refusals before the send
 * (a draft, a void) come back as `ok: false` with a sentence, like every other
 * failure, and nothing is stamped.
 */
export async function emailInvoice(
  id: string,
  input: InvoiceEmailInput,
  deps: InvoiceEmailDeps = DEFAULT_DEPS,
): Promise<SendDocumentEmailResult> {
  try {
    await deps.requireSendable(id);
  } catch (e) {
    if (e instanceof InvoiceActionError || e instanceof InvoiceNotFoundError) {
      return { ok: false, reason: "provider_error", error: e.message, logId: null };
    }
    throw e;
  }
  const pdf = await deps.render(id);
  if (!pdf) return { ok: false, reason: "provider_error", error: "That invoice could not be found.", logId: null };

  const res = await deps.send({
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
    documentName: pdf.filename.replace(/\.pdf$/i, ""),
    relatedType: "invoice",
    relatedId: id,
    linkPath: null,
    attachments: [{ filename: pdf.filename, content: pdfToBase64(pdf.bytes), contentType: "application/pdf" }],
  });
  // THE rule: stamped only on a confirmed send.
  if (res.ok) await deps.markSent(id, res.recipients.join(", "));
  return res;
}

/**
 * Email a payment's receipt with its PDF attached. Nothing is stamped on the
 * payment — the email log records the attempt against the invoice. A reversed
 * payment's receipt is not emailed: it would read as a receipt for money the
 * practice says it did not get.
 */
export async function emailReceipt(paymentId: string, input: InvoiceEmailInput): Promise<SendDocumentEmailResult> {
  await requireActor();
  const found = await getReceipt(paymentId);
  if (!found) return { ok: false, reason: "provider_error", error: "That payment could not be found.", logId: null };
  if (found.payment.reversedAt) {
    return { ok: false, reason: "provider_error", error: "A reversed payment's receipt cannot be emailed.", logId: null };
  }
  const pdf = await renderReceiptPdf(paymentId);
  if (!pdf) return { ok: false, reason: "provider_error", error: "That payment could not be found.", logId: null };
  return sendDocumentEmail({
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
    documentName: pdf.filename.replace(/\.pdf$/i, ""),
    relatedType: "invoice",
    relatedId: found.invoice.id,
    linkPath: null,
    attachments: [{ filename: pdf.filename, content: pdfToBase64(pdf.bytes), contentType: "application/pdf" }],
  });
}
