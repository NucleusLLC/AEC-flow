"use client";

/**
 * A project's FINANCE tab: the contract against what has been invoiced, the
 * work waiting to be billed, the job's margin (administrators only), its hours
 * by phase and by person, and its invoices and expenses.
 *
 * ─── PER CURRENCY ───────────────────────────────────────────────────────────
 * Every block of money is shown once per currency and says which one it is. A
 * job invoiced in two currencies has two rows of tiles, never one meaningless
 * sum — see docs/finance/SPEC.md.
 *
 * ─── INVOICED IS NOT EARNED ─────────────────────────────────────────────────
 * The top tiles are receivables (what the client was asked for and paid); the
 * margin block is what the work was worth against what it cost. They answer
 * different questions and are kept in separate cards so nobody adds them up.
 */

import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { militaryDate } from "@/lib/building-permits/register";
import { daysOverdue } from "@/lib/finance/calc";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/types";
import { ApprovalBadge, BilledBadge, InvoiceStatusBadge, OverdueBadge } from "@/components/finance/badges";
import type { ProjectFinance } from "@/lib/data/project-finance";

const money = (n: number, currency: string) =>
  formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUTTON =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90";

export function ProjectFinanceView({ data, today }: { data: ProjectFinance; today: string }) {
  const t = useT();
  const raiseHref = `/finance/invoices/new?work=${data.projectId}`;

  return (
    <div className="space-y-5">
      {/* ── Contract and receivables ─────────────────────────────────────── */}
      {data.billing.length === 0 ? (
        <Card>
          <CardBody className="py-8 text-center">
            <p className="text-sm font-medium text-fg">{t("Nothing has been invoiced on this project yet.")}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              {t("Set a contract value on the project to follow how much of it has been billed.")}
            </p>
          </CardBody>
        </Card>
      ) : (
        data.billing.map((b) => (
          <div key={b.currency} className="space-y-2">
            {data.billing.length > 1 ? (
              <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{b.currency}</div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Tile
                label={t("Contract value")}
                value={b.contractValue === null ? "—" : money(b.contractValue, b.currency)}
                note={
                  b.leftToBill === null
                    ? undefined
                    : b.leftToBill < 0
                      ? fmt(t("{amount} billed beyond the contract"), { amount: money(-b.leftToBill, b.currency) })
                      : fmt(t("{amount} left to bill"), { amount: money(b.leftToBill, b.currency) })
                }
              />
              <Tile
                label={t("Invoiced")}
                value={money(b.summary.billed, b.currency)}
                note={
                  b.billedPct === null
                    ? fmt(t("{count} issued"), { count: b.summary.count })
                    : fmt(t("{percent}% of contract"), { percent: b.billedPct })
                }
                bar={b.billedPct}
              />
              <Tile label={t("Received")} value={money(b.summary.paid, b.currency)} />
              <Tile label={t("Outstanding")} value={money(b.summary.outstanding, b.currency)} />
              <Tile
                label={t("Overdue")}
                value={money(b.summary.overdue, b.currency)}
                note={
                  b.summary.drafts > 0
                    ? b.summary.drafts === 1
                      ? t("1 draft not counted")
                      : fmt(t("{count} drafts not counted"), { count: b.summary.drafts })
                    : undefined
                }
                tone={b.summary.overdue > 0 ? "red" : undefined}
              />
            </div>
          </div>
        ))
      )}

      {/* ── Work in progress ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={t("Not yet billed")}
          subtitle={t("Approved, billable hours and expenses that are not on an invoice yet.")}
          action={
            data.wip.length > 0 ? (
              <Link href={raiseHref} className={BUTTON}>
                <Plus className="h-4 w-4" /> {t("Raise an invoice")}
              </Link>
            ) : null
          }
        />
        <CardBody>
          {data.wip.length === 0 ? (
            <p className="text-sm text-muted">{t("Nothing approved is waiting to be billed.")}</p>
          ) : (
            <div className="space-y-2">
              {data.wip.map((w) => (
                <div key={w.currency} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                  <span className="font-mono text-lg font-semibold tabular-nums text-fg">
                    {money(w.total, w.currency)}
                  </span>
                  <span className="text-muted">
                    {fmt(t("{hours} h of time"), { hours: w.hours.toFixed(2) })}{" "}
                    <span className="font-mono tabular-nums text-fg">{money(w.timeValue, w.currency)}</span>
                  </span>
                  <span className="text-muted">
                    {t("Expenses")}{" "}
                    <span className="font-mono tabular-nums text-fg">{money(w.expenseValue, w.currency)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ── Margin (administrators only) ─────────────────────────────────── */}
      {data.profit ? (
        <Card>
          <CardHeader
            title={t("Profitability")}
            subtitle={t("Cost counts every hour worked, billable or not.")}
          />
          <CardBody>
            {data.profit.length === 0 ? (
              <p className="text-sm text-muted">{t("No hours or expenses have been recorded yet.")}</p>
            ) : (
              <div className="space-y-3">
                {data.profit.map(({ currency, row }) => (
                  <div key={currency} className="grid gap-3 sm:grid-cols-3">
                    <Tile
                      label={t("Worth at charge-out")}
                      value={money(row.earned, currency)}
                      note={fmt(t("{hours} hours worked"), { hours: row.hours.toFixed(2) })}
                    />
                    <Tile label={t("Cost to the practice")} value={money(row.cost, currency)} />
                    <Tile
                      label={t("Margin")}
                      value={money(row.margin, currency)}
                      note={`${row.marginPct}%`}
                      tone={row.margin < 0 ? "red" : row.margin > 0 ? "green" : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {/* ── Hours ────────────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Hours by phase")} />
          <HoursTable
            empty={t("No hours have been logged on this project yet.")}
            first={t("Phase")}
            rows={data.phases.map((p) => ({
              key: p.phaseId ?? "none",
              name: p.phaseName ?? t("No phase"),
              approved: p.approved,
              pending: p.pending,
              hours: p.hours,
            }))}
            total={data.totalHours}
          />
        </Card>
        <Card>
          <CardHeader title={t("Hours by person")} />
          <HoursTable
            empty={t("No hours have been logged on this project yet.")}
            first={t("Person")}
            rows={data.people.map((p) => ({
              key: p.userId,
              name: p.userName,
              approved: p.approved,
              pending: p.pending,
              hours: p.hours,
            }))}
            total={data.totalHours}
          />
        </Card>
      </div>

      {/* ── Invoices ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title={t("Invoices")} />
        {data.invoices.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">{t("Nothing has been invoiced on this project yet.")}</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto pb-1">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-5 pb-1.5 pt-3 font-medium">{t("Invoice")}</th>
                  <th className="px-3 pb-1.5 pt-3 font-medium">{t("Dated")}</th>
                  <th className="px-3 pb-1.5 pt-3 font-medium">{t("Due")}</th>
                  <th className="px-3 pb-1.5 pt-3 font-medium">{t("Status")}</th>
                  <th className="px-3 pb-1.5 pt-3 text-right font-medium">{t("Total")}</th>
                  <th className="px-5 pb-1.5 pt-3 text-right font-medium">{t("Outstanding")}</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((i) => {
                  const late = daysOverdue({ dueDate: i.dueDate, outstanding: i.outstanding }, today);
                  return (
                    <tr
                      key={i.id}
                      className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                    >
                      <td
                        className={cn(
                          "px-5 py-2.5 align-top",
                          late !== null && "shadow-[inset_2px_0_0_0_var(--color-red-600)]",
                        )}
                      >
                        <Link
                          href={`/finance/invoices/${i.id}`}
                          className="font-mono text-xs font-semibold text-brand hover:underline"
                        >
                          {i.number}
                        </Link>
                        {i.title ? <div className="truncate text-[11px] text-faint">{i.title}</div> : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                        {militaryDate(i.issueDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                        {militaryDate(i.dueDate)}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <InvoiceStatusBadge status={i.status} />
                          <OverdueBadge days={late} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-fg">
                        {money(i.total, i.currency)}
                      </td>
                      <td className="px-5 py-2.5 text-right align-top font-mono font-semibold tabular-nums text-fg">
                        {i.outstanding > 0 ? money(i.outstanding, i.currency) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Expenses ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title={t("Expenses")} />
        {data.expenses.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">{t("No expenses have been recorded on this project.")}</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto pb-1">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-5 pb-1.5 pt-3 font-medium">{t("Date")}</th>
                  <th className="px-3 pb-1.5 pt-3 font-medium">{t("Description")}</th>
                  <th className="px-3 pb-1.5 pt-3 font-medium">{t("Category")}</th>
                  <th className="px-3 pb-1.5 pt-3 font-medium">{t("Status")}</th>
                  <th className="px-3 pb-1.5 pt-3 text-right font-medium">{t("Amount")}</th>
                  <th className="px-5 pb-1.5 pt-3 text-right font-medium">{t("Chargeable")}</th>
                </tr>
              </thead>
              <tbody>
                {data.expenses.map((x) => (
                  <tr
                    key={x.id}
                    className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                  >
                    <td className="whitespace-nowrap px-5 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                      {militaryDate(x.date)}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Link
                        href={`/finance/expenses/${x.id}/edit`}
                        className="font-medium text-fg hover:text-brand hover:underline"
                      >
                        {x.description}
                      </Link>
                      <div className="truncate text-[11px] text-faint">
                        {[x.vendor, x.userName].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted">{t(EXPENSE_CATEGORY_LABEL[x.category])}</td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <ApprovalBadge status={x.status} />
                        <BilledBadge invoiceNumber={x.invoiceNumber} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-fg">
                      {money(x.amount, x.currency)}
                    </td>
                    <td className="px-5 py-2.5 text-right align-top font-mono tabular-nums text-muted">
                      {x.billable ? money(x.chargeable, x.currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

type HoursRow = { key: string; name: string; approved: number; pending: number; hours: number };

function HoursTable({
  rows,
  total,
  first,
  empty,
}: {
  rows: HoursRow[];
  total: { approved: number; pending: number; hours: number };
  first: string;
  empty: string;
}) {
  const t = useT();
  if (rows.length === 0) {
    return (
      <CardBody>
        <p className="text-sm text-muted">{empty}</p>
      </CardBody>
    );
  }
  const h = (n: number) => (n > 0 ? n.toFixed(2) : "—");
  return (
    <div className="overflow-x-auto pb-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
            <th className="px-5 pb-1.5 pt-3 font-medium">{first}</th>
            <th className="px-3 pb-1.5 pt-3 text-right font-medium">{t("Approved")}</th>
            <th className="px-3 pb-1.5 pt-3 text-right font-medium">{t("Pending")}</th>
            <th className="px-5 pb-1.5 pt-3 text-right font-medium">{t("Hours")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border/60 even:bg-surface-2/40">
              <td className="px-5 py-2 align-top text-fg">{r.name}</td>
              <td className="px-3 py-2 text-right align-top font-mono tabular-nums text-muted">{h(r.approved)}</td>
              <td className="px-3 py-2 text-right align-top font-mono tabular-nums text-muted">{h(r.pending)}</td>
              <td className="px-5 py-2 text-right align-top font-mono font-semibold tabular-nums text-fg">
                {h(r.hours)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-faint">{t("Total")}</td>
            <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">{h(total.approved)}</td>
            <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">{h(total.pending)}</td>
            <td className="px-5 py-2 text-right font-mono font-semibold tabular-nums text-fg">{h(total.hours)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  tone,
  bar,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "red" | "green";
  /** A percentage to draw as a thin progress bar under the figure. */
  bar?: number | null;
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
        {bar !== undefined && bar !== null ? (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn("h-full rounded-full", bar > 100 ? "bg-red-600" : "bg-brand")}
              style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
            />
          </div>
        ) : null}
        {note ? <div className="mt-1 text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
