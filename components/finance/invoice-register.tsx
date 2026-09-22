"use client";

/**
 * The invoice register, and the receivables view on top of it.
 *
 * WHY THE TILES ARE PER CURRENCY. "Total outstanding" across currencies is a
 * number with no meaning. The register therefore filters to one currency before
 * it adds anything up, and says which one — see `receivablesSummary` in
 * lib/finance/calc.ts and the note in docs/finance/SPEC.md.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { InvoiceStatusBadge, OverdueBadge } from "@/components/finance/badges";
import { ageingBucket, daysOverdue, receivablesSummary } from "@/lib/finance/calc";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  type InvoiceStatus,
  type InvoiceSummaryDTO,
} from "@/lib/finance/types";

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function haystack(i: InvoiceSummaryDTO): string {
  return [i.number, i.clientName, i.projectName, i.proposalNumber, i.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function InvoiceRegister({
  invoices,
  today,
}: {
  invoices: InvoiceSummaryDTO[];
  today: string;
}) {
  const currencies = useMemo(
    () => [...new Set(invoices.map((i) => i.currency))].sort(),
    [invoices],
  );
  const [currency, setCurrency] = useState(currencies[0] ?? "AWG");
  const [status, setStatus] = useState<InvoiceStatus | "ALL" | "OPEN" | "OVERDUE">("ALL");
  const [q, setQ] = useState("");

  const inCurrency = useMemo(
    () => invoices.filter((i) => i.currency === currency),
    [invoices, currency],
  );

  const summary = useMemo(
    () => receivablesSummary(inCurrency, today, currency),
    [inCurrency, today, currency],
  );

  const rows = useMemo(
    () =>
      inCurrency.filter((i) => {
        const late = daysOverdue({ dueDate: i.dueDate, outstanding: i.outstanding }, today);
        if (status === "OPEN" && !(i.status === "ISSUED" || i.status === "PART_PAID")) return false;
        if (status === "OVERDUE" && late === null) return false;
        if (status !== "ALL" && status !== "OPEN" && status !== "OVERDUE" && i.status !== status) {
          return false;
        }
        const needle = q.trim().toLowerCase();
        if (needle && !haystack(i).includes(needle)) return false;
        return true;
      }),
    [inCurrency, status, q, today],
  );

  const money = (n: number) =>
    formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Billed" value={money(summary.billed)} note={`${summary.count} issued`} />
        <Tile label="Received" value={money(summary.paid)} />
        <Tile label="Outstanding" value={money(summary.outstanding)} />
        <Tile
          label="Overdue"
          value={money(summary.overdue)}
          note={summary.drafts > 0 ? `${summary.drafts} draft${summary.drafts === 1 ? "" : "s"} not counted` : undefined}
          tone={summary.overdue > 0 ? "red" : undefined}
        />
      </div>

      {summary.outstanding > 0 ? (
        <Card>
          <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm">
            <span className="text-[11px] uppercase tracking-wide text-faint">Ageing</span>
            {(["current", "1-30", "31-60", "61-90", "90+"] as const).map((bucket) => (
              <span key={bucket} className="flex items-baseline gap-1.5">
                <span className="text-muted">{bucket === "current" ? "Not yet due" : `${bucket} days`}</span>
                <span className="font-mono tabular-nums text-fg">{money(summary.ageing[bucket])}</span>
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
            placeholder="Search number, client, project, proposal…"
            aria-label="Search invoices"
            className={`${CONTROL} w-full pl-8 pr-3 placeholder:text-faint`}
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as InvoiceStatus | "ALL" | "OPEN" | "OVERDUE")}
          aria-label="Filter by status"
          className={CONTROL}
        >
          <option value="ALL">All</option>
          <option value="OPEN">Unpaid</option>
          <option value="OVERDUE">Overdue</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {INVOICE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        {currencies.length > 1 ? (
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
            className={CONTROL}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}

        <span className="text-xs text-muted tabular-nums">
          {rows.length} of {inCurrency.length} in {currency}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Inbox className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm font-medium text-fg">No invoice matches these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 pb-1.5 font-medium">Invoice</th>
                <th className="px-3 pb-1.5 font-medium">Billed to</th>
                <th className="px-3 pb-1.5 font-medium">Dated</th>
                <th className="px-3 pb-1.5 font-medium">Due</th>
                <th className="px-3 pb-1.5 text-right font-medium">Total</th>
                <th className="px-3 pb-1.5 text-right font-medium">Received</th>
                <th className="px-3 pb-1.5 text-right font-medium">Outstanding</th>
                <th className="px-4 pb-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const late = daysOverdue({ dueDate: i.dueDate, outstanding: i.outstanding }, today);
                return (
                  <tr
                    key={i.id}
                    className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                  >
                    <td
                      className={`px-4 py-2.5 align-top ${
                        late !== null ? "shadow-[inset_2px_0_0_0_var(--color-red-600)]" : ""
                      }`}
                    >
                      <Link
                        href={`/finance/invoices/${i.id}`}
                        className="font-mono text-xs font-semibold text-brand hover:underline"
                      >
                        {i.number}
                      </Link>
                      {i.proposalNumber ? (
                        <div className="font-mono text-[10px] text-faint">{i.proposalNumber}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="truncate font-medium text-fg">{i.clientName}</div>
                      {i.projectName ? (
                        <div className="truncate text-[11px] text-faint">{i.projectName}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                      {militaryDate(i.issueDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                      {militaryDate(i.dueDate)}
                      {late !== null ? (
                        <div className="text-[10px] font-medium text-red-600">
                          {ageingBucket(late) === "90+" ? "90+ days" : `${late} days`}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-fg">
                      {money(i.total)}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-muted">
                      {i.paid > 0 ? money(i.paid) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top font-mono font-semibold tabular-nums text-fg">
                      {i.outstanding > 0 ? money(i.outstanding) : "—"}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <InvoiceStatusBadge status={i.status} />
                        <OverdueBadge days={late} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
  tone?: "red";
}) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div
          className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
            tone === "red" ? "text-red-600" : "text-fg"
          }`}
        >
          {value}
        </div>
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
