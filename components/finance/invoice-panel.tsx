"use client";

/**
 * The live half of an invoice: what can be done to it, and the payments.
 *
 * Unlike the permit case file, this does NOT keep its own copy of the row. Every
 * figure here is money, and money shown from client state that has drifted from
 * the database is worse than money shown a beat late — so each write is followed
 * by a refresh of the server page that owns the totals.
 *
 * The status shown here is derived (lib/finance/calc.ts): recording a payment
 * that covers the total turns the invoice PAID without anyone choosing that.
 * Issued credit notes reduce the balance through the same function
 * (`invoiceBalance`) — they are listed under the payments, and a credit note
 * is raised from here, against this invoice, while money is still owed.
 *
 * PHASE B (0.38.0). "Email invoice" sends the server-generated PDF through the
 * one email path; the invoice turns SENT only when the provider confirmed, and
 * a failure keeps the composed message on screen with the reason. Every
 * payment has a numbered receipt (print it, or email it). A payment is
 * REVERSED with a reason — it stays here, struck through, and stops counting —
 * never deleted. A VOID invoice can be RE-ISSUED as `<number>-2`.
 *
 * Void, Re-issue, Delete draft and Reverse are drawn only for an administrator,
 * a director or the founder (`canManage`). That is presentation: the actions
 * and lib/data/invoices.ts refuse everyone else whatever is drawn.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Check, FileDown, FileMinus, Mail, Plus, Printer, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { CreditNoteStatusBadge, InvoiceStatusBadge, OverdueBadge } from "@/components/finance/badges";
import { creditsOf, daysOverdue, invoiceBalance } from "@/lib/finance/calc";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import {
  MANUAL_PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type InvoiceDTO,
  type InvoicePaymentDTO,
  type InvoicePaymentMethod,
} from "@/lib/finance/types";
import {
  deleteInvoiceAction,
  emailInvoiceAction,
  emailReceiptAction,
  issueInvoiceAction,
  recordPaymentAction,
  reissueInvoiceAction,
  reversePaymentAction,
  voidInvoiceAction,
} from "@/app/(app)/finance/invoices/actions";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-60";
const input =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const area =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";
const ICON_BTN = "text-faint transition-colors hover:text-fg disabled:opacity-60";

/** What the compose card is sending: the invoice itself, or one payment's receipt. */
type Compose = { kind: "invoice" } | { kind: "receipt"; payment: InvoicePaymentDTO };

export function InvoicePanel({
  invoice,
  today,
  canManage = false,
}: {
  invoice: InvoiceDTO;
  today: string;
  /** Draws Void, Re-issue, Delete draft and Reverse payment (Admin / Director / founder). */
  canManage?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState<null | "pay" | "void" | "delete" | "reissue">(null);

  const [paidAt, setPaidAt] = useState(today);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<InvoicePaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const [reversing, setReversing] = useState<InvoicePaymentDTO | null>(null);
  const [reverseReason, setReverseReason] = useState("");

  const [compose, setCompose] = useState<Compose | null>(null);
  const [mailTo, setMailTo] = useState("");
  const [mailCc, setMailCc] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");

  const money = (n: number) =>
    formatCurrency(n, invoice.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { paid, credited, outstanding, overpaidBy } = invoiceBalance({
    total: invoice.total,
    currency: invoice.currency,
    payments: invoice.payments,
    credits: creditsOf(invoice.creditNotes),
  });
  const late = daysOverdue({ dueDate: invoice.dueDate, outstanding }, today);
  const isDraft = invoice.status === "DRAFT";
  const isVoid = invoice.status === "VOID";
  const canTakePayment = !isDraft && !isVoid;
  // Same people as everything else on this panel (any member — see
  // app/(app)/finance/credit-notes/actions.ts); only while money is owed.
  const canCredit = canTakePayment && outstanding > 0;
  const liveReissue = invoice.reissuedAs.length > 0;
  // Every payment, live and reversed, in the order it was received.
  const allPayments = [...invoice.payments, ...invoice.reversedPayments].sort(
    (a, b) => a.paidAt.localeCompare(b.paidAt) || a.createdAt.localeCompare(b.createdAt),
  );

  /**
   * The actions return only an id, and the server page is the source of truth
   * for every figure here — so a write is followed by a refresh rather than by
   * patching a local copy of the invoice. Money shown from client state that
   * drifted from the row is worse than a reload.
   */
  async function reload() {
    router.refresh();
  }

  function run(
    fn: () => Promise<{ ok: true; id: string } | { ok: false; error: string }>,
    after?: (id: string) => void,
  ) {
    setError(null);
    setNotice(null);
    setPending(true);
    void (async () => {
      const res = await fn();
      setPending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAsking(null);
      setReversing(null);
      if (after) after(res.id);
      else await reload();
    })();
  }

  function openCompose(next: Compose) {
    setError(null);
    setNotice(null);
    setAsking(null);
    setReversing(null);
    setMailTo(invoice.contactEmail ?? "");
    setMailCc("");
    if (next.kind === "invoice") {
      setMailSubject(`${fmt(t("Invoice {number}"), { number: invoice.number })} — ${invoice.clientName}`);
      setMailBody(
        invoice.dueDate
          ? fmt(t("Please find attached invoice {number} for {amount}, due {date}."), {
              number: invoice.number,
              amount: money(outstanding > 0 ? outstanding : invoice.total),
              date: militaryDate(invoice.dueDate),
            })
          : fmt(t("Please find attached invoice {number} for {amount}."), {
              number: invoice.number,
              amount: money(outstanding > 0 ? outstanding : invoice.total),
            }),
      );
    } else {
      const number = next.payment.receiptNumber ?? "";
      setMailSubject(`${fmt(t("Receipt {number}"), { number })} — ${invoice.clientName}`);
      setMailBody(
        fmt(t("Thank you for your payment of {amount} against invoice {invoice}. Please find attached receipt {number}."), {
          amount: money(next.payment.amount),
          invoice: invoice.number,
          number,
        }),
      );
    }
    setCompose(next);
  }

  function send() {
    if (!compose) return;
    setError(null);
    setNotice(null);
    setPending(true);
    const message = { to: mailTo, cc: mailCc || undefined, subject: mailSubject, body: mailBody };
    void (async () => {
      const res =
        compose.kind === "invoice"
          ? await emailInvoiceAction(invoice.id, message)
          : await emailReceiptAction(invoice.id, compose.payment.id, message);
      setPending(false);
      if (!res.ok) {
        // The composed message stays on screen; nothing was sent, nothing was stamped.
        setError(res.error);
        return;
      }
      setCompose(null);
      setNotice(
        fmt(t("Sent to {to}. The PDF was attached: {files}."), {
          to: res.recipients.join(", "),
          files: res.attachments.join(", "),
        }),
      );
      await reload();
    })();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("Total")} value={money(invoice.total)} />
        <Stat
          label={t("Received")}
          value={paid > 0 ? money(paid) : "—"}
          note={credited > 0 ? `${t("Credited")} ${money(credited)}` : undefined}
        />
        <Stat
          label={t("Outstanding")}
          value={outstanding > 0 ? money(outstanding) : "—"}
          tone={late !== null ? "red" : undefined}
          note={late !== null ? fmt(t("{count} days overdue"), { count: late }) : undefined}
        />
        <Stat
          label={t("Status")}
          value=""
          badge={
            <div className="flex flex-col items-start gap-1">
              <InvoiceStatusBadge status={invoice.status} />
              <OverdueBadge days={late} />
            </div>
          }
        />
      </div>

      {overpaidBy > 0 ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-fg">
          {fmt(t("{amount} more has been received than this invoice asked for."), {
            amount: money(overpaidBy),
          })}
        </p>
      ) : null}
      {isVoid && invoice.voidReason ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-fg">
          {fmt(t("Voided {date}: {reason}"), {
            date: militaryDate(invoice.voidedAt),
            reason: invoice.voidReason,
          })}
        </p>
      ) : null}
      {invoice.reissuedAs.length > 0 ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg" data-testid="reissued-as">
          {t("Re-issued as")}{" "}
          {invoice.reissuedAs.map((r, i) => (
            <span key={r.id}>
              {i > 0 ? ", " : ""}
              <Link href={`/finance/invoices/${r.id}`} className="font-mono font-semibold text-brand hover:underline">
                {r.number}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      {invoice.reissuedFromId && invoice.reissuedFromNumber ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg" data-testid="reissue-of">
          {t("Re-issue of")}{" "}
          <Link
            href={`/finance/invoices/${invoice.reissuedFromId}`}
            className="font-mono font-semibold text-brand hover:underline"
          >
            {invoice.reissuedFromNumber}
          </Link>
        </p>
      ) : null}
      {invoice.sentAt ? (
        <p className="text-sm text-muted" data-testid="sent-stamp">
          {fmt(t("Emailed {date} to {to} by {name}."), {
            date: militaryDate(invoice.sentAt),
            to: invoice.sentTo ?? "—",
            name: invoice.sentByName ?? "—",
          })}
          {invoice.sentCount > 1 ? ` ${fmt(t("Sent {count} times."), { count: invoice.sentCount })}` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/print/finance/invoices/${invoice.id}`} className={BTN}>
          {t("Print / PDF")}
        </Link>
        <a href={`/finance/invoices/${invoice.id}/pdf?download=1`} className={BTN}>
          <FileDown className="h-4 w-4" /> {t("Download PDF")}
        </a>
        {isDraft ? (
          <>
            <Link href={`/finance/invoices/${invoice.id}/edit`} className={BTN}>
              {t("Edit")}
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  issueInvoiceAction(invoice.id, {
                    issueDate: invoice.issueDate ?? today,
                    dueDate: invoice.dueDate,
                  }),
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {t("Issue")}
            </button>
            {canManage ? (
              <button type="button" disabled={pending} onClick={() => setAsking("delete")} className={`${BTN} text-red-600`}>
                <Trash2 className="h-4 w-4" /> <span>{t("Delete draft")}</span>
              </button>
            ) : null}
          </>
        ) : null}
        {canTakePayment ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => openCompose({ kind: "invoice" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
          >
            <Mail className="h-4 w-4" /> {invoice.sentAt ? t("Email again") : t("Email invoice")}
          </button>
        ) : null}
        {canTakePayment ? (
          <button type="button" disabled={pending} onClick={() => setAsking("pay")} className={BTN}>
            <Plus className="h-4 w-4" /> {t("Record a payment")}
          </button>
        ) : null}
        {canCredit ? (
          <Link
            href={`/finance/credit-notes/new?invoice=${invoice.id}`}
            className={`${BTN} uppercase tracking-wider`}
          >
            <FileMinus className="h-4 w-4" /> {t("Raise credit note")}
          </Link>
        ) : null}
        {canManage && !isDraft && !isVoid ? (
          <button type="button" disabled={pending} onClick={() => setAsking("void")} className={`${BTN} text-red-600`}>
            <Ban className="h-4 w-4" /> {t("Void this invoice")}
          </button>
        ) : null}
        {canManage && isVoid && !liveReissue ? (
          <button type="button" disabled={pending} onClick={() => setAsking("reissue")} className={BTN}>
            <RotateCcw className="h-4 w-4" /> {t("Re-issue")}
          </button>
        ) : null}
      </div>

      {compose ? (
        <Card>
          <CardHeader
            title={compose.kind === "invoice" ? t("Email invoice") : t("Email receipt")}
            subtitle={
              compose.kind === "invoice"
                ? fmt(t("The invoice goes as a PDF attachment, {file}."), { file: `${invoice.number}.pdf` })
                : fmt(t("The receipt goes as a PDF attachment, {file}."), {
                    file: `${compose.payment.receiptNumber ?? t("Receipt")}.pdf`,
                  })
            }
          />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>{t("To")}</label>
              <input
                value={mailTo}
                onChange={(e) => setMailTo(e.target.value)}
                placeholder="name@example.com, other@example.com"
                className={input}
                data-testid="mail-to"
              />
            </div>
            <div>
              <label className={label}>{t("Cc")}</label>
              <input value={mailCc} onChange={(e) => setMailCc(e.target.value)} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>{t("Subject")}</label>
              <input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>{t("Message")}</label>
              <textarea rows={4} value={mailBody} onChange={(e) => setMailBody(e.target.value)} className={area} />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={pending}
                onClick={send}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
                data-testid="mail-send"
              >
                <Send className="h-4 w-4" /> {pending ? t("Sending…") : t("Send")}
              </button>
              <button type="button" onClick={() => setCompose(null)} className={BTN}>
                {t("Cancel")}
              </button>
              <span className="text-xs text-faint">
                {t("Separate several addresses with commas. The invoice is marked Sent only when the email is confirmed sent.")}
              </span>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {asking === "pay" ? (
        <Card>
          <CardHeader title={t("Record a payment")} subtitle={t("What was actually received, and when.")} />
          <CardBody className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className={label}>{t("Received on")}</label>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>{t("Amount")}</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(outstanding)}
                className={`${input} font-mono`}
                data-testid="pay-amount"
              />
            </div>
            <div>
              <label className={label}>{t("How")}</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as InvoicePaymentMethod)}
                className={input}
              >
                {MANUAL_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(PAYMENT_METHOD_LABEL[m])}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>{t("Reference")}</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t("Bank reference")}
                className={`${input} font-mono`}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-4">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    recordPaymentAction(invoice.id, {
                      paidAt,
                      amount: Number(amount),
                      method,
                      reference: reference || null,
                    }),
                  )
                }
                className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
                data-testid="pay-save"
              >
                {pending ? t("Saving…") : t("Record it")}
              </button>
              <button type="button" onClick={() => setAsking(null)} className={BTN}>
                {t("Cancel")}
              </button>
              <span className="text-xs text-faint">
                {t("Leave the amount blank at your peril — it has to be a figure, and it may not be zero.")}
              </span>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {canManage && asking === "void" ? (
        <Card>
          <CardBody className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <label className={label}>{t("Why is it being voided?")}</label>
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={t("Raised against the wrong project")}
                className={input}
              />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => voidInvoiceAction(invoice.id, voidReason))}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
            >
              {t("Void it")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              {t("Cancel")}
            </button>
            <p className="w-full text-[11px] text-faint">
              {t(
                "The invoice stays readable and keeps its number. Voiding frees the proposal milestones it billed, so they can be invoiced again.",
              )}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {canManage && asking === "reissue" ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg">
              {t("Re-issue this invoice as a new draft with the same client, lines, taxes and discount?")}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => reissueInvoiceAction(invoice.id),
                  (id) => router.push(`/finance/invoices/${id}`),
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
              data-testid="reissue-confirm"
            >
              <RotateCcw className="h-4 w-4" /> {t("Re-issue")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              {t("Cancel")}
            </button>
            <p className="w-full text-[11px] text-faint">
              {t(
                "The new draft gets this number with -2 (then -3 …). It bills the same proposal milestones again, so it is refused if another invoice has billed one of them since. Time and expenses released by the void are not re-claimed.",
              )}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {canManage && asking === "delete" ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg">{t("Delete this draft invoice?")}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteInvoiceAction(invoice.id), () => router.push("/finance/invoices"))}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
            >
              {t("Delete")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              {t("Keep it")}
            </button>
          </CardBody>
        </Card>
      ) : null}

      {canManage && reversing ? (
        <Card>
          <CardHeader
            title={t("Reverse payment")}
            subtitle={fmt(t("{receipt} · {amount} received {date}"), {
              receipt: reversing.receiptNumber ?? "—",
              amount: money(reversing.amount),
              date: militaryDate(reversing.paidAt),
            })}
          />
          <CardBody className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <label className={label}>{t("Why is it being reversed?")}</label>
              <input
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder={t("The cheque bounced")}
                className={input}
                data-testid="reverse-reason"
              />
            </div>
            <button
              type="button"
              disabled={pending || !reverseReason.trim()}
              onClick={() => run(() => reversePaymentAction(invoice.id, reversing.id, reverseReason))}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
              data-testid="reverse-confirm"
            >
              {t("Reverse it")}
            </button>
            <button type="button" onClick={() => setReversing(null)} className={BTN}>
              {t("Cancel")}
            </button>
            <p className="w-full text-[11px] text-faint">
              {t(
                "The payment stays on the invoice, struck through, with your reason, and stops counting towards what has been paid. Its receipt then prints REVERSED.",
              )}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {notice ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700" data-testid="panel-notice">
          <Check className="h-4 w-4" /> {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" data-testid="panel-error">
          {t(error)}
        </p>
      ) : null}

      <Card>
        <CardHeader
          title={t("Lines")}
          subtitle={
            invoice.proposalNumber
              ? fmt(t("Raised from proposal {number}."), { number: invoice.proposalNumber })
              : undefined
          }
        />
        <CardBody>
          <table className="w-full text-sm">
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id} className="zebra-row border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="text-fg">{l.description}</div>
                    {l.milestoneName ? (
                      <div className="text-[11px] text-faint">
                        {fmt(t("Milestone: {name}"), { name: l.milestoneName })}
                      </div>
                    ) : null}
                    {l.quantity !== null && l.unitRate !== null ? (
                      <div className="text-[11px] text-faint">
                        {l.quantity} × {money(l.unitRate)}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-fg">{money(l.amount)}</td>
                  <td className="w-16 py-2 text-right text-[11px] text-faint">
                    {l.taxable ? "" : t("no tax")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-right text-muted">{t("Subtotal")}</td>
                <td className="pt-3 text-right font-mono tabular-nums text-fg">{money(invoice.subtotal)}</td>
                <td />
              </tr>
              {invoice.discountTotal > 0 ? (
                <tr>
                  <td className="text-right text-muted">
                    {invoice.discountType === "PERCENT"
                      ? fmt(t("Discount {percent}%"), { percent: invoice.discountValue })
                      : t("Discount")}
                  </td>
                  <td className="text-right font-mono tabular-nums text-fg">−{money(invoice.discountTotal)}</td>
                  <td />
                </tr>
              ) : null}
              {invoice.taxPercent > 0 ? (
                <tr>
                  <td className="text-right text-muted">
                    {invoice.taxName ?? t("Tax")} {invoice.taxPercent}%
                    {invoice.taxMode === "INCLUSIVE" ? ` ${t("(included)")}` : ""}
                  </td>
                  <td className="text-right font-mono tabular-nums text-fg">{money(invoice.taxTotal)}</td>
                  <td />
                </tr>
              ) : null}
              {/* A second tax (BBO + BAVP) prints as its own line; one-tax documents are unchanged. */}
              {invoice.tax2Percent > 0 ? (
                <tr>
                  <td className="text-right text-muted">
                    {invoice.tax2Name ?? t("Tax")} {invoice.tax2Percent}%
                    {invoice.taxMode === "INCLUSIVE" ? ` ${t("(included)")}` : ""}
                  </td>
                  <td className="text-right font-mono tabular-nums text-fg">{money(invoice.tax2Total)}</td>
                  <td />
                </tr>
              ) : null}
              <tr>
                <td className="pt-2 text-right font-medium text-fg">{t("Total")}</td>
                <td className="pt-2 text-right font-mono text-base font-semibold tabular-nums text-fg">
                  {money(invoice.total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("Payments")}
          subtitle={t("The status above follows these rows, not the other way round.")}
        />
        <CardBody>
          {allPayments.length === 0 ? (
            <p className="text-sm text-muted">{t("Nothing received yet.")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-1.5 font-medium">{t("Received")}</th>
                  <th className="pb-1.5 font-medium">{t("Receipt")}</th>
                  <th className="pb-1.5 font-medium">{t("How")}</th>
                  <th className="pb-1.5 font-medium">{t("Reference")}</th>
                  <th className="pb-1.5 text-right font-medium">{t("Amount")}</th>
                  <th className="pb-1.5" />
                </tr>
              </thead>
              <tbody>
                {allPayments.map((p) => {
                  const reversed = Boolean(p.reversedAt);
                  return (
                    <tr
                      key={p.id}
                      className={`zebra-row border-t border-border/60 align-top ${reversed ? "text-faint" : ""}`}
                      data-testid={reversed ? "payment-reversed" : "payment-live"}
                    >
                      <td className="py-2 font-mono text-xs tabular-nums">{militaryDate(p.paidAt)}</td>
                      <td className="py-2 font-mono text-xs">
                        <Link
                          href={`/print/finance/receipts/${p.id}`}
                          className="font-semibold text-brand hover:underline"
                          data-testid="receipt-link"
                        >
                          {p.receiptNumber ?? t("Receipt")}
                        </Link>
                      </td>
                      <td className={`py-2 ${reversed ? "" : "text-muted"}`}>{t(PAYMENT_METHOD_LABEL[p.method])}</td>
                      <td className="py-2 font-mono text-xs text-muted">
                        {p.reference ?? "—"}
                        {reversed ? (
                          <div className="font-sans text-[11px] text-red-600">
                            {fmt(t("Reversed {date} by {name}: {reason}"), {
                              date: militaryDate(p.reversedAt),
                              name: p.reversedByName ?? "—",
                              reason: p.reverseReason ?? "",
                            })}
                          </div>
                        ) : null}
                      </td>
                      <td
                        className={`py-2 text-right font-mono tabular-nums ${reversed ? "line-through" : "text-fg"}`}
                      >
                        {money(p.amount)}
                      </td>
                      <td className="py-2 text-right">
                        <span className="inline-flex items-center gap-2">
                          <Link
                            href={`/print/finance/receipts/${p.id}`}
                            aria-label={t("Print receipt")}
                            title={t("Print receipt")}
                            className={ICON_BTN}
                          >
                            <Printer className="h-4 w-4" />
                          </Link>
                          {!reversed ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => openCompose({ kind: "receipt", payment: p })}
                              aria-label={t("Email receipt")}
                              title={t("Email receipt")}
                              className={ICON_BTN}
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canManage && !reversed ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                setError(null);
                                setCompose(null);
                                setReverseReason("");
                                setReversing(p);
                              }}
                              aria-label={t("Reverse payment")}
                              title={t("Reverse payment")}
                              className="text-faint transition-colors hover:text-red-600 disabled:opacity-60"
                              data-testid="reverse-open"
                            >
                              <Undo2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {invoice.creditNotes.length > 0 ? (
        <Card>
          <CardHeader
            title={t("Credits").toUpperCase()}
            subtitle={t("Only issued credit notes reduce the balance. Drafts and voids are shown, not counted.")}
          />
          <CardBody>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-1.5 font-medium">{t("Credit note")}</th>
                  <th className="pb-1.5 font-medium">{t("Date")}</th>
                  <th className="pb-1.5 font-medium">{t("Reason")}</th>
                  <th className="pb-1.5 text-right font-medium">{t("Amount")}</th>
                  <th className="pb-1.5 pl-3 font-medium">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.creditNotes.map((c) => (
                  <tr key={c.id} className="zebra-row border-t border-border/60">
                    <td className="py-2">
                      <Link href={`/finance/credit-notes/${c.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                        {c.number}
                      </Link>
                    </td>
                    <td className="py-2 font-mono text-xs tabular-nums">{militaryDate(c.date)}</td>
                    <td className="max-w-[280px] truncate py-2 text-muted">{c.reason}</td>
                    <td
                      className={`py-2 text-right font-mono tabular-nums ${c.status === "ISSUED" ? "text-fg" : "text-faint line-through"}`}
                    >
                      −{money(c.total)}
                    </td>
                    <td className="py-2 pl-3">
                      <CreditNoteStatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({
  label: l,
  value,
  note,
  tone,
  badge,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "red";
  badge?: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] uppercase tracking-wide text-faint">{l}</div>
        {badge ?? (
          <div
            className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
              tone === "red" ? "text-red-600" : "text-fg"
            }`}
          >
            {value}
          </div>
        )}
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
