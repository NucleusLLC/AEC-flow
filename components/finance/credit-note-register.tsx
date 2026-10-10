"use client";

/**
 * The credit note register. Tiles are PER CURRENCY, like the invoice register:
 * a total credited across currencies is a number with no meaning, so the page
 * filters to one before it adds anything up, and the totals strip lists every
 * currency separately.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { CreditNoteStatusBadge } from "@/components/finance/badges";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import { add, fromMajor, toMajor, zero } from "@/lib/proposals/engine/money";
import {
  CREDIT_NOTE_STATUSES,
  CREDIT_NOTE_STATUS_LABEL,
  type CreditNoteStatus,
  type CreditNoteSummaryDTO,
} from "@/lib/finance/types";

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

/** Issued total per currency — the money the practice has given back. */
function issuedByCurrency(notes: CreditNoteSummaryDTO[]): { currency: string; total: number; count: number }[] {
  const out = new Map<string, { total: ReturnType<typeof zero>; count: number }>();
  for (const n of notes) {
    if (n.status !== "ISSUED") continue;
    const row = out.get(n.currency) ?? { total: zero(n.currency), count: 0 };
    out.set(n.currency, { total: add(row.total, fromMajor(n.total, n.currency)), count: row.count + 1 });
  }
  return [...out.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, r]) => ({ currency, total: toMajor(r.total), count: r.count }));
}

export function CreditNoteRegister({ notes }: { notes: CreditNoteSummaryDTO[] }) {
  const t = useT();
  const currencies = useMemo(() => [...new Set(notes.map((n) => n.currency))].sort(), [notes]);
  const [currency, setCurrency] = useState(currencies[0] ?? "AWG");
  const [status, setStatus] = useState<CreditNoteStatus | "ALL">("ALL");
  const [q, setQ] = useState("");

  const inCurrency = useMemo(() => notes.filter((n) => n.currency === currency), [notes, currency]);
  const perCurrency = useMemo(() => issuedByCurrency(notes), [notes]);
  const here = perCurrency.find((p) => p.currency === currency) ?? { total: 0, count: 0 };
  const drafts = inCurrency.filter((n) => n.status === "DRAFT");
  const voids = inCurrency.filter((n) => n.status === "VOID");
  const draftTotal = toMajor(drafts.reduce((m, n) => add(m, fromMajor(n.total, currency)), zero(currency)));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inCurrency.filter((n) => {
      if (status !== "ALL" && n.status !== status) return false;
      if (!needle) return true;
      return [n.number, n.invoiceNumber, n.clientName, n.projectName, n.reason]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [inCurrency, status, q]);

  const money = (n: number, c = currency) =>
    formatCurrency(n, c, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={t("Credited")}
          value={money(here.total)}
          note={fmt(t("{count} issued"), { count: here.count })}
        />
        <Tile label={t("Drafts")} value={money(draftTotal)} note={fmt(t("{count} not issued"), { count: drafts.length })} />
        <Tile label={t("Voided")} value={String(voids.length)} />
        <Tile label={t("Credit notes")} value={String(inCurrency.length)} note={currency} />
      </div>

      {perCurrency.length > 0 ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm" >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{t("Credited per currency")}</span>
            {perCurrency.map((p) => (
              <span key={p.currency} className="flex items-baseline gap-1.5" data-testid={`cn-total-${p.currency}`}>
                <span className="font-mono text-xs text-muted">{p.currency}</span>
                <span className="font-mono tabular-nums text-fg">{money(p.total, p.currency)}</span>
                <span className="text-[11px] text-faint">({p.count})</span>
              </span>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search number, invoice, client, reason…")}
            aria-label={t("Search credit notes")}
            className={`${CONTROL} w-full pl-8 pr-3 placeholder:text-faint`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CreditNoteStatus | "ALL")}
          aria-label={t("Filter by status")}
          className={CONTROL}
        >
          <option value="ALL">{t("All")}</option>
          {CREDIT_NOTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(CREDIT_NOTE_STATUS_LABEL[s])}
            </option>
          ))}
        </select>
        {currencies.length > 1 ? (
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label={t("Currency")} className={CONTROL}>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Inbox className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm font-medium text-fg">{t("No credit note matches these filters.")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="px-4 pb-1.5 font-semibold">{t("Credit note")}</th>
                <th className="px-3 pb-1.5 font-semibold">{t("Date")}</th>
                <th className="px-3 pb-1.5 font-semibold">{t("Invoice")}</th>
                <th className="px-3 pb-1.5 font-semibold">{t("Client")}</th>
                <th className="px-3 pb-1.5 font-semibold">{t("Reason")}</th>
                <th className="px-3 pb-1.5 text-right font-semibold">{t("Total")}</th>
                <th className="px-4 pb-1.5 font-semibold">{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} className="border-b border-border/60 last:border-0 even:bg-surface-2/40 hover:bg-surface-2">
                  <td className="px-4 py-2.5 align-top">
                    <Link href={`/finance/credit-notes/${n.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                      {n.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                    {militaryDate(n.date)}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Link href={`/finance/invoices/${n.invoiceId}`} className="font-mono text-xs text-muted hover:text-fg hover:underline">
                      {n.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="truncate font-medium text-fg">{n.clientName}</div>
                    {n.projectName ? <div className="truncate text-[11px] text-faint">{n.projectName}</div> : null}
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 align-top text-muted">{n.reason}</td>
                  <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-fg">{money(n.total)}</td>
                  <td className="px-4 py-2.5 align-top">
                    <CreditNoteStatusBadge status={n.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</div>
        <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-fg">{value}</div>
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
