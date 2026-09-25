"use client";

/**
 * What each job earned, what it cost, and what is still to be billed.
 *
 * ─── EARNED IS NOT INVOICED ─────────────────────────────────────────────────
 * "Earned" is what the work is worth at charge-out — billable hours at their
 * snapshotted rates, plus rechargeable expenses. It is deliberately NOT what
 * has been invoiced or collected; those are the receivables register's numbers,
 * and adding the two together counts the same job twice. The column headed
 * "Not yet billed" is the bridge between them.
 *
 * ─── COST INCLUDES THE HOURS NOBODY WILL PAY FOR ────────────────────────────
 * A job that took forty unbilled hours to fix cost the practice those hours.
 * Leaving them out is how a job looks profitable right up until payroll.
 *
 * ─── A NEGATIVE MARGIN IS SHOWN AS ONE ──────────────────────────────────────
 * In red, with the number. A screen that floors a loss at zero is a screen that
 * hides the only figure worth acting on.
 */

import { useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { CurrencyAnalysis } from "@/lib/data/finance-analysis";

type SortKey = "margin" | "earned" | "cost" | "hours" | "unbilled";

export function ProfitView({ analyses }: { analyses: CurrencyAnalysis[] }) {
  const [currency, setCurrency] = useState(analyses[0]?.currency ?? "AWG");
  const [sort, setSort] = useState<SortKey>("margin");

  const analysis = analyses.find((a) => a.currency === currency) ?? analyses[0];

  const unbilledFor = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of analysis?.unbilled ?? []) map.set(u.projectId ?? "none", u.total);
    return map;
  }, [analysis]);

  const rows = useMemo(() => {
    const list = [...(analysis?.projects ?? [])];
    list.sort((a, b) => {
      if (sort === "hours") return b.hours - a.hours;
      if (sort === "earned") return b.earned - a.earned;
      if (sort === "cost") return b.cost - a.cost;
      if (sort === "unbilled") {
        return (unbilledFor.get(b.projectId ?? "none") ?? 0) - (unbilledFor.get(a.projectId ?? "none") ?? 0);
      }
      return a.margin - b.margin; // worst first: the one to act on
    });
    return list;
  }, [analysis, sort, unbilledFor]);

  if (!analysis) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <p className="text-sm font-medium text-fg">No hours or expenses have been recorded yet.</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
            Once the practice logs time against a job, this shows what the job is worth at
            charge-out, what it has cost, and what is still waiting to be invoiced.
          </p>
        </CardBody>
      </Card>
    );
  }

  const money = (n: number) =>
    formatCurrency(n, analysis.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const t = analysis.totals;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Worth at charge-out" value={money(t.earned)} note={`${t.hours.toFixed(2)} hours worked`} />
        <Tile label="Cost to the practice" value={money(t.cost)} note={`${t.utilisation}% billable`} />
        <Tile
          label="Margin"
          value={money(t.margin)}
          note={`${t.marginPct}%`}
          tone={t.margin < 0 ? "red" : t.margin > 0 ? "green" : undefined}
        />
        <Tile label="Not yet billed" value={money(t.unbilled)} note="approved, billable, uninvoiced" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {analyses.length > 1 ? (
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg"
          >
            {analyses.map((a) => (
              <option key={a.currency} value={a.currency}>
                {a.currency}
              </option>
            ))}
          </select>
        ) : null}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort by"
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg"
        >
          <option value="margin">Worst margin first</option>
          <option value="earned">Most earned</option>
          <option value="cost">Most costly</option>
          <option value="hours">Most hours</option>
          <option value="unbilled">Most unbilled</option>
        </select>
        <span className="text-xs tabular-nums text-muted">
          {rows.length} job{rows.length === 1 ? "" : "s"} in {analysis.currency}
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="px-4 pb-1.5 font-medium">Project</th>
              <th className="px-3 pb-1.5 text-right font-medium">Hours</th>
              <th className="px-3 pb-1.5 text-right font-medium">Earned</th>
              <th className="px-3 pb-1.5 text-right font-medium">Cost</th>
              <th className="px-3 pb-1.5 text-right font-medium">Margin</th>
              <th className="px-3 pb-1.5 text-right font-medium">%</th>
              <th className="px-4 pb-1.5 text-right font-medium">Not yet billed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const unbilled = unbilledFor.get(p.projectId ?? "none") ?? 0;
              return (
                <tr
                  key={p.projectId ?? "none"}
                  className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5 align-top">
                    <div className="truncate font-medium text-fg">{p.projectName}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-muted">
                    {p.hours.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-fg">
                    {money(p.earned)}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-muted">
                    {money(p.cost)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right align-top font-mono font-semibold tabular-nums",
                      p.margin < 0 ? "text-red-600" : "text-fg",
                    )}
                  >
                    {money(p.margin)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right align-top font-mono tabular-nums",
                      p.margin < 0 ? "text-red-600" : "text-muted",
                    )}
                  >
                    {p.marginPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right align-top font-mono tabular-nums text-muted">
                    {unbilled > 0 ? money(unbilled) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Earned is what the work is worth at charge-out, not what has been invoiced — see the
        receivables tiles on Invoices for that. Cost counts every hour worked, billable or not.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "red" | "green";
}) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div
          className={cn(
            "mt-1 font-mono text-lg font-semibold tabular-nums",
            tone === "red" ? "text-red-600" : tone === "green" ? "text-green-600" : "text-fg",
          )}
        >
          {value}
        </div>
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
