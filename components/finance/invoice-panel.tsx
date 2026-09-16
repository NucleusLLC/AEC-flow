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
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Plus, Send, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InvoiceStatusBadge, OverdueBadge } from "@/components/finance/badges";
import { daysOverdue, settlement } from "@/lib/finance/calc";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type InvoiceDTO,
  type InvoicePaymentMethod,
} from "@/lib/finance/types";
import {
  deleteInvoiceAction,
  deletePaymentAction,
  issueInvoiceAction,
  recordPaymentAction,
  voidInvoiceAction,
} from "@/app/(app)/finance/invoices/actions";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-60";
const input =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

export function InvoicePanel({
  invoice,
  today,
}: {
  invoice: InvoiceDTO;
  today: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<null | "pay" | "void" | "delete">(null);

  const [paidAt, setPaidAt] = useState(today);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<InvoicePaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const money = (n: number) =>
    formatCurrency(n, invoice.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { paid, outstanding, overpaidBy } = settlement(
    invoice.total,
    invoice.payments,
    invoice.currency,
  );
  const late = daysOverdue({ dueDate: invoice.dueDate, outstanding }, today);
  const isDraft = invoice.status === "DRAFT";
  const canTakePayment = !isDraft && invoice.status !== "VOID";

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
    after?: () => void,
  ) {
    setError(null);
    setPending(true);
    void (async () => {
      const res = await fn();
      setPending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAsking(null);
      if (after) after();
      else await reload();
    })();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={money(invoice.total)} />
        <Stat label="Received" value={paid > 0 ? money(paid) : "—"} />
        <Stat
          label="Outstanding"
          value={outstanding > 0 ? money(outstanding) : "—"}
          tone={late !== null ? "red" : undefined}
          note={late !== null ? `${late} days overdue` : undefined}
        />
        <Stat
          label="Status"
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
          {money(overpaidBy)} more has been received than this invoice asked for.
        </p>
      ) : null}
      {invoice.status === "VOID" && invoice.voidReason ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-fg">
          Voided {militaryDate(invoice.voidedAt)}: {invoice.voidReason}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/print/finance/invoices/${invoice.id}`} className={BTN}>
          Print / PDF
        </Link>
        {isDraft ? (
          <>
            <Link href={`/finance/invoices/${invoice.id}/edit`} className={BTN}>
              Edit
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
              <Send className="h-4 w-4" /> Issue
            </button>
            <button type="button" disabled={pending} onClick={() => setAsking("delete")} className={`${BTN} text-red-600`}>
              <Trash2 className="h-4 w-4" /> Delete draft
            </button>
          </>
        ) : null}
        {canTakePayment ? (
          <button type="button" disabled={pending} onClick={() => setAsking("pay")} className={BTN}>
            <Plus className="h-4 w-4" /> Record a payment
          </button>
        ) : null}
        {!isDraft && invoice.status !== "VOID" ? (
          <button type="button" disabled={pending} onClick={() => setAsking("void")} className={`${BTN} text-red-600`}>
            <Ban className="h-4 w-4" /> Void
          </button>
        ) : null}
      </div>

      {asking === "pay" ? (
        <Card>
          <CardHeader title="Record a payment" subtitle="What was actually received, and when." />
          <CardBody className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className={label}>Received on</label>
              <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(outstanding)}
                className={`${input} font-mono`}
              />
            </div>
            <div>
              <label className={label}>How</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as InvoicePaymentMethod)}
                className={input}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Reference</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Bank reference"
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
              >
                {pending ? "Saving…" : "Record it"}
              </button>
              <button type="button" onClick={() => setAsking(null)} className={BTN}>
                Cancel
              </button>
              <span className="text-xs text-faint">
                Leave the amount blank at your peril — it has to be a figure, and it may not be zero.
              </span>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {asking === "void" ? (
        <Card>
          <CardBody className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <label className={label}>Why is it being voided?</label>
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Raised against the wrong project"
                className={input}
              />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => voidInvoiceAction(invoice.id, voidReason))}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
            >
              Void it
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              Cancel
            </button>
            <p className="w-full text-[11px] text-faint">
              The invoice stays readable and keeps its number. Voiding frees the proposal
              milestones it billed, so they can be invoiced again.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {asking === "delete" ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg">Delete this draft invoice?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteInvoiceAction(invoice.id), () => router.push("/finance/invoices"))}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
            >
              Delete
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              Keep it
            </button>
          </CardBody>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader
          title="Lines"
          subtitle={invoice.proposalNumber ? `Raised from proposal ${invoice.proposalNumber}.` : undefined}
        />
        <CardBody>
          <table className="w-full text-sm">
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="text-fg">{l.description}</div>
                    {l.milestoneName ? (
                      <div className="text-[11px] text-faint">Milestone: {l.milestoneName}</div>
                    ) : null}
                    {l.quantity !== null && l.unitRate !== null ? (
                      <div className="text-[11px] text-faint">
                        {l.quantity} × {money(l.unitRate)}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-fg">{money(l.amount)}</td>
                  <td className="w-16 py-2 text-right text-[11px] text-faint">
                    {l.taxable ? "" : "no tax"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-right text-muted">Subtotal</td>
                <td className="pt-3 text-right font-mono tabular-nums text-fg">{money(invoice.subtotal)}</td>
                <td />
              </tr>
              {invoice.taxPercent > 0 ? (
                <tr>
                  <td className="text-right text-muted">
                    {invoice.taxName ?? "Tax"} {invoice.taxPercent}%
                    {invoice.taxMode === "INCLUSIVE" ? " (included)" : ""}
                  </td>
                  <td className="text-right font-mono tabular-nums text-fg">{money(invoice.taxTotal)}</td>
                  <td />
                </tr>
              ) : null}
              <tr>
                <td className="pt-2 text-right font-medium text-fg">Total</td>
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
        <CardHeader title="Payments" subtitle="The status above follows these rows, not the other way round." />
        <CardBody>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted">Nothing received yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-1.5 font-medium">Received</th>
                  <th className="pb-1.5 font-medium">How</th>
                  <th className="pb-1.5 font-medium">Reference</th>
                  <th className="pb-1.5 text-right font-medium">Amount</th>
                  <th className="pb-1.5" />
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="py-2 font-mono text-xs tabular-nums">{militaryDate(p.paidAt)}</td>
                    <td className="py-2 text-muted">{PAYMENT_METHOD_LABEL[p.method]}</td>
                    <td className="py-2 font-mono text-xs text-muted">{p.reference ?? "—"}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-fg">{money(p.amount)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => deletePaymentAction(invoice.id, p.id))}
                        aria-label="Delete payment"
                        className="text-faint transition-colors hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
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
