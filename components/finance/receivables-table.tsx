"use client";

/**
 * Receivables by client: who owes what, and how late.
 *
 * One table per currency, each with its own footer total — never one total
 * across currencies (see lib/finance/receivables.ts). The rows arrive already
 * computed on the server from the register's own rules; this component only
 * filters by currency and adds up the footer through the same pure helper.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import {
  AGEING_BUCKETS,
  receivablesTotals,
  type ClientReceivable,
} from "@/lib/finance/receivables";
import type { AgeingBucket } from "@/lib/finance/calc";

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const BUCKET_LABEL: Record<AgeingBucket, string> = {
  current: "Current",
  "1-30": "1–30",
  "31-60": "31–60",
  "61-90": "61–90",
  "90+": "90+",
};

export function ReceivablesTable({ rows }: { rows: ClientReceivable[] }) {
  const t = useT();
  const currencies = useMemo(() => [...new Set(rows.map((r) => r.currency))].sort(), [rows]);
  const [currency, setCurrency] = useState<string>("ALL");

  const shown = useMemo(
    () => (currency === "ALL" ? rows : rows.filter((r) => r.currency === currency)),
    [rows, currency],
  );
  const totals = useMemo(() => receivablesTotals(shown), [shown]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <Inbox className="h-8 w-8 text-faint" />
        <p className="mt-3 text-sm font-medium text-fg">{t("No client owes the practice anything.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          aria-label={t("Currency")}
          className={CONTROL}
        >
          <option value="ALL">{t("All currencies")}</option>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted tabular-nums">
          {fmt(t("{count} open balances"), { count: shown.length })}
        </span>
      </div>

      {totals.map((total) => {
        const money = (n: number) =>
          formatCurrency(n, total.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const list = shown.filter((r) => r.currency === total.currency);
        return (
          <section key={total.currency} className="space-y-1.5">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-muted">
              {total.currency}
            </h3>
            <div className="overflow-x-auto pb-1">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="px-4 pb-1.5 font-medium">{t("Client")}</th>
                    {AGEING_BUCKETS.map((b) => (
                      <th key={b} className="px-3 pb-1.5 text-right font-medium">
                        {b === "current" ? t("Current") : BUCKET_LABEL[b]}
                      </th>
                    ))}
                    <th className="px-3 pb-1.5 text-right font-medium">{t("Total outstanding")}</th>
                    <th className="px-3 pb-1.5 font-medium">{t("Oldest invoice")}</th>
                    <th className="px-4 pb-1.5 font-medium">{t("Last payment")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr
                      key={`${r.currency}:${r.key}`}
                      className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                    >
                      <td
                        className={`px-4 py-2.5 align-top ${
                          r.ageing["90+"] > 0 ? "shadow-[inset_2px_0_0_0_var(--color-red-600)]" : ""
                        }`}
                      >
                        {r.clientId ? (
                          <Link
                            href={`/finance/receivables/${r.clientId}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {r.clientName}
                          </Link>
                        ) : (
                          <span className="font-medium text-fg">{r.clientName}</span>
                        )}
                        <div className="text-[10px] text-faint">
                          {r.clientId
                            ? r.openCount === 1
                              ? t("1 open invoice")
                              : fmt(t("{count} open invoices"), { count: r.openCount })
                            : t("No client record — no statement")}
                        </div>
                      </td>
                      {AGEING_BUCKETS.map((b) => (
                        <td
                          key={b}
                          className={`px-3 py-2.5 text-right align-top font-mono tabular-nums ${
                            r.ageing[b] > 0
                              ? b === "90+" || b === "61-90"
                                ? "text-red-600"
                                : "text-fg"
                              : "text-faint"
                          }`}
                        >
                          {r.ageing[b] > 0 ? money(r.ageing[b]) : "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right align-top font-mono font-semibold tabular-nums text-fg">
                        {money(r.outstanding)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                        {r.oldest ? (
                          <>
                            <Link href={`/finance/invoices/${r.oldest.id}`} className="text-brand hover:underline">
                              {r.oldest.number}
                            </Link>
                            <div className="text-[10px]">{militaryDate(r.oldest.date)}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                        {militaryDate(r.lastPaymentDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border text-[11px] uppercase tracking-wide">
                    <td className="px-4 py-2.5 font-semibold text-fg">
                      {fmt(t("Total {currency}"), { currency: total.currency })}
                    </td>
                    {AGEING_BUCKETS.map((b) => (
                      <td key={b} className="px-3 py-2.5 text-right font-mono text-sm tabular-nums text-fg">
                        {money(total.ageing[b])}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-mono text-sm font-bold tabular-nums text-fg">
                      {money(total.outstanding)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
