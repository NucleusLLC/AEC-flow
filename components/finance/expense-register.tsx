"use client";

/**
 * The expense register: what the practice laid out, what may be passed on, and
 * what is still waiting for somebody to sign it off.
 *
 * WHY THE TILES ARE PER CURRENCY — the same reason the invoice register gives:
 * a total across currencies is a number with no meaning, so the list filters to
 * one currency before it adds anything up, and says which one.
 *
 * SPENT AND CHARGEABLE ARE DIFFERENT COLUMNS. A markup changes what a client
 * pays, never what was spent; showing one figure for both is how a practice
 * loses track of which it is looking at.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Inbox, Search, Send, Trash2, Undo2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ApprovalBadge, BilledBadge } from "@/components/finance/badges";
import { formatCurrency } from "@/lib/format";
import { expenseSummary } from "@/lib/finance/timesheet";
import {
  EXPENSE_CATEGORY_LABEL,
  FINANCE_APPROVAL_LABEL,
  FINANCE_APPROVAL_STATUSES,
  type ExpenseDTO,
  type FinanceApprovalStatus,
} from "@/lib/finance/types";
import {
  decideExpensesAction,
  deleteExpenseAction,
  markReimbursedAction,
  submitExpensesAction,
} from "@/app/(app)/finance/expenses/actions";

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function haystack(x: ExpenseDTO): string {
  return [x.description, x.vendor, x.projectName, x.userName, EXPENSE_CATEGORY_LABEL[x.category]]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function ExpenseRegister({
  expenses,
  canApprove,
  currentUserId,
}: {
  expenses: ExpenseDTO[];
  canApprove: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currencies = useMemo(
    () => [...new Set(expenses.map((x) => x.currency))].sort(),
    [expenses],
  );
  const [currency, setCurrency] = useState(currencies[0] ?? "AWG");
  const [status, setStatus] = useState<FinanceApprovalStatus | "ALL" | "UNBILLED">("ALL");
  const [q, setQ] = useState("");

  const inCurrency = useMemo(
    () => expenses.filter((x) => x.currency === currency),
    [expenses, currency],
  );
  const summary = useMemo(() => expenseSummary(inCurrency, currency), [inCurrency, currency]);

  const rows = useMemo(
    () =>
      inCurrency.filter((x) => {
        if (status === "UNBILLED" && !(x.status === "APPROVED" && x.billable && !x.invoicedAt)) {
          return false;
        }
        if (status !== "ALL" && status !== "UNBILLED" && x.status !== status) return false;
        const needle = q.trim().toLowerCase();
        if (needle && !haystack(x).includes(needle)) return false;
        return true;
      }),
    [inCurrency, status, q],
  );

  const money = (n: number) =>
    formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That did not save.");
      else router.refresh();
    });
  }

  function reject(id: string) {
    const reason = window.prompt("Why is this being sent back?")?.trim();
    if (!reason) return;
    run(() => decideExpensesAction([id], { approve: false, reason }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Spent" value={money(summary.spent)} note={`${summary.count} recorded`} />
        <Tile label="Rechargeable" value={money(summary.rechargeable)} />
        <Tile label="Not yet billed" value={money(summary.unbilled)} />
        <Tile
          label="Waiting for approval"
          value={money(summary.awaitingApproval)}
          note={summary.absorbed > 0 ? `${money(summary.absorbed)} absorbed` : undefined}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search what, who, vendor, project…"
            aria-label="Search expenses"
            className={`${CONTROL} w-full pl-8 pr-3 placeholder:text-faint`}
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FinanceApprovalStatus | "ALL" | "UNBILLED")}
          aria-label="Filter by status"
          className={CONTROL}
        >
          <option value="ALL">All</option>
          <option value="UNBILLED">Ready to bill</option>
          {FINANCE_APPROVAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FINANCE_APPROVAL_LABEL[s]}
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

        <span className="text-xs tabular-nums text-muted">
          {rows.length} of {inCurrency.length} in {currency}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Inbox className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm font-medium text-fg">No expense matches these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 pb-1.5 font-medium">Date</th>
                <th className="px-3 pb-1.5 font-medium">What</th>
                <th className="px-3 pb-1.5 font-medium">Project</th>
                <th className="px-3 pb-1.5 font-medium">Who</th>
                <th className="px-3 pb-1.5 text-right font-medium">Spent</th>
                <th className="px-3 pb-1.5 text-right font-medium">Chargeable</th>
                <th className="px-3 pb-1.5 font-medium">Status</th>
                <th className="px-4 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const mine = x.userId === currentUserId;
                const editable = !x.invoicedAt && (x.status !== "APPROVED" || canApprove) && (mine || canApprove);
                return (
                  <tr
                    key={x.id}
                    className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                      {x.date}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {editable ? (
                        <Link
                          href={`/finance/expenses/${x.id}/edit`}
                          className="font-medium text-brand hover:underline"
                        >
                          {x.description}
                        </Link>
                      ) : (
                        <span className="font-medium text-fg">{x.description}</span>
                      )}
                      <div className="text-[11px] text-faint">
                        {EXPENSE_CATEGORY_LABEL[x.category]}
                        {x.vendor ? ` · ${x.vendor}` : ""}
                        {x.reimbursable
                          ? x.reimbursedAt
                            ? " · reimbursed"
                            : " · owed back"
                          : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top text-muted">{x.projectName ?? "—"}</td>
                    <td className="px-3 py-2.5 align-top text-muted">{x.userName}</td>
                    <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-fg">
                      {money(x.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-muted">
                      {x.billable ? money(x.chargeable) : "Absorbed"}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <ApprovalBadge status={x.status} />
                        <BilledBadge invoiceNumber={x.invoiceNumber} />
                        {x.rejectedReason ? (
                          <span className="text-[11px] text-red-600">{x.rejectedReason}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex items-center justify-end gap-2">
                        {(x.status === "DRAFT" || x.status === "REJECTED") && (mine || canApprove) ? (
                          <IconButton
                            label="Send for approval"
                            disabled={pending}
                            onClick={() => run(() => submitExpensesAction([x.id]))}
                          >
                            <Send className="h-4 w-4" />
                          </IconButton>
                        ) : null}
                        {canApprove && x.status === "SUBMITTED" ? (
                          <>
                            <IconButton
                              label="Approve"
                              disabled={pending}
                              onClick={() => run(() => decideExpensesAction([x.id], { approve: true }))}
                            >
                              <Check className="h-4 w-4" />
                            </IconButton>
                            <IconButton label="Send back" disabled={pending} onClick={() => reject(x.id)}>
                              <Undo2 className="h-4 w-4" />
                            </IconButton>
                          </>
                        ) : null}
                        {canApprove && x.reimbursable && x.status === "APPROVED" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => markReimbursedAction([x.id], !x.reimbursedAt))}
                            className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted hover:bg-surface-2 disabled:opacity-60"
                          >
                            {x.reimbursedAt ? "Undo reimbursed" : "Reimbursed"}
                          </button>
                        ) : null}
                        {editable ? (
                          <IconButton
                            label="Delete"
                            danger
                            disabled={pending}
                            onClick={() => run(() => deleteExpenseAction(x.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        ) : null}
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

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`text-faint transition-colors disabled:opacity-60 ${
        danger ? "hover:text-red-600" : "hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-fg">{value}</div>
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
