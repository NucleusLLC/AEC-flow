"use client";

/**
 * Raise or edit a DRAFT credit note against one invoice.
 *
 * The person chooses how much of each invoice line to take back — FULL INVOICE
 * fills every line with what is left on it — and the screen totals it with the
 * invoice's own tax snapshot through `invoiceTotals`, the same function the
 * server stores with. The ceiling shown (AVAILABLE) is the invoice's
 * outstanding balance; going over it disables SAVE here, and the server
 * refuses it anyway (lib/data/credit-notes.ts), on save and again at issue.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { formatCurrency } from "@/lib/format";
import { invoiceTotals } from "@/lib/finance/calc";
import { fromMajor } from "@/lib/proposals/engine/money";
import type { CreditableInvoice, CreditNoteDTO } from "@/lib/finance/types";
import {
  createCreditNoteAction,
  updateCreditNoteAction,
} from "@/app/(app)/finance/credit-notes/actions";

const input =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted";
const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold uppercase tracking-wider text-fg transition-colors hover:bg-surface-2 disabled:opacity-60";

export function CreditNoteForm({
  invoice,
  initial,
  today,
}: {
  invoice: CreditableInvoice;
  initial?: CreditNoteDTO;
  today: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(initial?.date ?? today);
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const l of initial?.lines ?? []) if (l.invoiceLineId) out[l.invoiceLineId] = String(l.amount);
    return out;
  });

  const money = (n: number) =>
    formatCurrency(n, invoice.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const chosen = useMemo(
    () =>
      invoice.lines
        .map((l) => ({ line: l, amount: Number(amounts[l.id] ?? "") }))
        .filter((x) => Number.isFinite(x.amount) && x.amount > 0),
    [invoice.lines, amounts],
  );

  const totals = useMemo(
    () =>
      invoiceTotals(
        chosen.map((c) => ({ amount: c.amount, taxable: c.line.taxable })),
        { percent: invoice.taxPercent, mode: invoice.taxMode, percent2: invoice.tax2Percent },
        invoice.currency,
      ),
    [chosen, invoice.taxPercent, invoice.taxMode, invoice.tax2Percent, invoice.currency],
  );

  const minor = (n: number) => fromMajor(n, invoice.currency).minor;
  const lineOver = (id: string, creditable: number) => {
    const n = Number(amounts[id] ?? "");
    return Number.isFinite(n) && n > 0 && minor(n) > minor(creditable);
  };
  const anyLineOver = invoice.lines.some((l) => lineOver(l.id, l.creditable));
  const over = minor(totals.total) > minor(invoice.available);
  const canSave = !pending && chosen.length > 0 && reason.trim().length > 0 && !over && !anyLineOver;

  function fillFull() {
    const out: Record<string, string> = {};
    for (const l of invoice.lines) if (l.creditable > 0) out[l.id] = String(l.creditable);
    setAmounts(out);
  }

  function save() {
    setError(null);
    const payload = {
      invoiceId: invoice.id,
      date,
      reason,
      notes: notes || null,
      lines: chosen.map((c) => ({ invoiceLineId: c.line.id, amount: c.amount })),
    };
    startTransition(async () => {
      const res = initial
        ? await updateCreditNoteAction(initial.id, payload)
        : await createCreditNoteAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/finance/credit-notes/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Figure label={t("Invoice")} value={invoice.number} mono />
        <Figure label={t("Total")} value={money(invoice.total)} />
        <Figure
          label={t("Received")}
          value={invoice.paid > 0 ? money(invoice.paid) : "—"}
          note={invoice.credited > 0 ? `${t("Credited")} ${money(invoice.credited)}` : undefined}
        />
        <Figure label={t("Available")} value={money(invoice.available)} />
      </div>

      <Card>
        <CardHeader title={t("Credit note").toUpperCase()} />
        <CardBody className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={LABEL}>{t("Date")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} font-mono`} />
          </div>
          <div className="sm:col-span-3">
            <label className={LABEL}>{t("Reason")}</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("Fee reduced by agreement")}
              className={input}
              name="reason"
            />
          </div>
          <div className="sm:col-span-4">
            <label className={LABEL}>{t("Internal notes")}</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("Lines").toUpperCase()}
          action={
            <div className="flex gap-2">
              <button type="button" onClick={fillFull} className={BTN}>
                {t("Full invoice")}
              </button>
              <button type="button" onClick={() => setAmounts({})} className={BTN}>
                {t("Clear")}
              </button>
            </div>
          }
        />
        <CardBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="pb-1.5 font-semibold">{t("Description")}</th>
                <th className="pb-1.5 text-right font-semibold">{t("Billed")}</th>
                <th className="pb-1.5 text-right font-semibold">{t("Creditable")}</th>
                <th className="w-40 pb-1.5 text-right font-semibold">{t("To credit")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="py-2 pr-3 text-fg">
                    {l.description}
                    {l.taxable ? null : <span className="text-[11px] text-faint"> · {t("no tax")}</span>}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-muted">{money(l.amount)}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-muted">{money(l.creditable)}</td>
                  <td className="py-2 pl-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      aria-label={`${t("To credit")} · ${l.description}`}
                      value={amounts[l.id] ?? ""}
                      disabled={l.creditable <= 0}
                      onChange={(e) => setAmounts((a) => ({ ...a, [l.id]: e.target.value }))}
                      className={`${input} text-right font-mono ${lineOver(l.id, l.creditable) ? "border-red-600" : ""}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr>
                <td colSpan={3} className="pt-3 text-right text-[11px] uppercase tracking-wider text-muted">
                  {t("Subtotal")}
                </td>
                <td className="pt-3 text-right font-mono tabular-nums text-fg">{money(totals.subtotal)}</td>
              </tr>
              {invoice.taxPercent > 0 ? (
                <tr>
                  <td colSpan={3} className="text-right text-[11px] uppercase tracking-wider text-muted">
                    {invoice.taxName ?? t("Tax")} {invoice.taxPercent}%
                    {invoice.taxMode === "INCLUSIVE" ? ` ${t("(included)")}` : ""}
                  </td>
                  <td className="text-right font-mono tabular-nums text-fg">{money(totals.taxTotal)}</td>
                </tr>
              ) : null}
              {/* A second tax (BBO + BAVP) prints as its own line; one-tax documents are unchanged. */}
              {invoice.tax2Percent > 0 ? (
                <tr>
                  <td colSpan={3} className="text-right text-[11px] uppercase tracking-wider text-muted">
                    {invoice.tax2Name ?? t("Tax")} {invoice.tax2Percent}%
                    {invoice.taxMode === "INCLUSIVE" ? ` ${t("(included)")}` : ""}
                  </td>
                  <td className="text-right font-mono tabular-nums text-fg">{money(totals.tax2Total)}</td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={3} className="pt-2 text-right text-[11px] font-semibold uppercase tracking-wider text-fg">
                  {t("Credit total")}
                </td>
                <td
                  className={`pt-2 text-right font-mono text-base font-semibold tabular-nums ${over ? "text-red-600" : "text-fg"}`}
                  data-testid="credit-total"
                >
                  {money(totals.total)}
                </td>
              </tr>
            </tfoot>
          </table>
          {over ? (
            <p className="mt-3 text-sm font-medium text-red-600">
              {t("A credit note cannot exceed the invoice's outstanding balance.")}
            </p>
          ) : null}
          {anyLineOver ? (
            <p className="mt-3 text-sm font-medium text-red-600">
              {t("A line cannot be credited for more than is left on it.")}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {error ? <p className="text-sm text-red-600">{t(error)}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-xs font-semibold uppercase tracking-wider text-brand-fg hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? t("Saving…") : initial ? t("Save draft") : t("Raise draft")}
        </button>
        <span className="text-xs text-faint">{t("Saved as a draft. Nothing changes on the invoice until it is issued.")}</span>
      </div>
    </div>
  );
}

function Figure({ label, value, note, mono }: { label: string; value: string; note?: string; mono?: boolean }) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</div>
        <div className={`mt-1 text-lg font-semibold tabular-nums text-fg ${mono ? "font-mono text-base" : "font-mono"}`}>
          {value}
        </div>
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
