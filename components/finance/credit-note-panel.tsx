"use client";

/**
 * The live half of a credit note: ISSUE, VOID, EDIT, DELETE, PRINT, and its
 * lines. Like the invoice panel it keeps no copy of the money — each write is
 * followed by a refresh of the server page that owns the figures.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Printer, Send, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { CreditNoteStatusBadge } from "@/components/finance/badges";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import type { CreditNoteDTO } from "@/lib/finance/types";
import {
  deleteCreditNoteAction,
  issueCreditNoteAction,
  voidCreditNoteAction,
} from "@/app/(app)/finance/credit-notes/actions";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold uppercase tracking-wider text-fg transition-colors hover:bg-surface-2 disabled:opacity-60";
const input =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function CreditNotePanel({ note }: { note: CreditNoteDTO }) {
  const router = useRouter();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<null | "void" | "delete">(null);
  const [voidReason, setVoidReason] = useState("");

  const money = (n: number) =>
    formatCurrency(n, note.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function run(
    fn: () => Promise<{ ok: true; id: string } | { ok: false; error: string }>,
    after?: (id: string) => void,
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
      if (after) after(res.id);
      else router.refresh();
    })();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Figure label={t("Credit total")} value={money(note.total)} />
        <Figure label={t("Date")} value={militaryDate(note.date)} />
        <Figure label={t("Invoice")} value={note.invoiceNumber} />
        <Card>
          <CardBody className="py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{t("Status")}</div>
            <div className="mt-1.5">
              <CreditNoteStatusBadge status={note.status} />
            </div>
          </CardBody>
        </Card>
      </div>

      {note.status === "VOID" ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-fg">
          {fmt(t("Voided {date}: {reason}"), {
            date: militaryDate(note.voidedAt),
            reason: note.voidReason ?? "—",
          })}
        </p>
      ) : null}
      {note.status === "DRAFT" ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
          {t("Draft. The invoice balance does not change until this is issued.")}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/print/finance/credit-notes/${note.id}`} className={BTN}>
          <Printer className="h-4 w-4" /> {t("Print / PDF")}
        </Link>
        <Link href={`/finance/invoices/${note.invoiceId}`} className={BTN}>
          {t("Invoice")} {note.invoiceNumber}
        </Link>
        {note.status === "DRAFT" ? (
          <>
            <Link href={`/finance/credit-notes/${note.id}/edit`} className={BTN}>
              {t("Edit")}
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => issueCreditNoteAction(note.id))}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-semibold uppercase tracking-wider text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {t("Issue")}
            </button>
            <button type="button" disabled={pending} onClick={() => setAsking("delete")} className={`${BTN} text-red-600`}>
              <Trash2 className="h-4 w-4" /> {t("Delete draft")}
            </button>
          </>
        ) : null}
        {note.status === "ISSUED" ? (
          <button type="button" disabled={pending} onClick={() => setAsking("void")} className={`${BTN} text-red-600`}>
            <Ban className="h-4 w-4" /> {t("Void")}
          </button>
        ) : null}
      </div>

      {asking === "void" ? (
        <Card>
          <CardBody className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("Reason")}
              </label>
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={t("Raised in error")}
                className={input}
              />
            </div>
            <button
              type="button"
              disabled={pending || !voidReason.trim()}
              onClick={() => run(() => voidCreditNoteAction(note.id, voidReason))}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-red-600/90 disabled:opacity-60"
            >
              {t("Void it")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              {t("Cancel")}
            </button>
            <p className="w-full text-[11px] text-faint">
              {t("The credit note keeps its number. The invoice balance it reduced comes back.")}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {asking === "delete" ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg">{t("Delete this draft credit note?")}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => deleteCreditNoteAction(note.id),
                  (invoiceId) => router.push(`/finance/invoices/${invoiceId}`),
                )
              }
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-red-600/90 disabled:opacity-60"
            >
              {t("Delete")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              {t("Keep it")}
            </button>
          </CardBody>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600" role="alert">{t(error)}</p> : null}

      <Card>
        <CardHeader title={t("Lines").toUpperCase()} />
        <CardBody>
          <table className="w-full text-sm">
            <tbody>
              {note.lines.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-fg">{l.description}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-fg">{money(l.amount)}</td>
                  <td className="w-16 py-2 text-right text-[11px] text-faint">{l.taxable ? "" : t("no tax")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-right text-[11px] uppercase tracking-wider text-muted">{t("Subtotal")}</td>
                <td className="pt-3 text-right font-mono tabular-nums text-fg">{money(note.subtotal)}</td>
                <td />
              </tr>
              {note.taxPercent > 0 ? (
                <tr>
                  <td className="text-right text-[11px] uppercase tracking-wider text-muted">
                    {note.taxName ?? t("Tax")} {note.taxPercent}%
                    {note.taxMode === "INCLUSIVE" ? ` ${t("(included)")}` : ""}
                  </td>
                  <td className="text-right font-mono tabular-nums text-fg">{money(note.taxTotal)}</td>
                  <td />
                </tr>
              ) : null}
              <tr>
                <td className="pt-2 text-right text-[11px] font-semibold uppercase tracking-wider text-fg">
                  {t("Credit total")}
                </td>
                <td className="pt-2 text-right font-mono text-base font-semibold tabular-nums text-fg">
                  {money(note.total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</div>
        <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-fg">{value}</div>
      </CardBody>
    </Card>
  );
}
