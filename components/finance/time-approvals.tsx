"use client";

/**
 * The approver's queue: hours somebody has sent up, waiting for a decision.
 *
 * ONLY SUBMITTED ROWS APPEAR. Approving a draft the owner has not finished is
 * how a half-typed week ends up on an invoice, and the data layer refuses it —
 * this list simply never offers it.
 *
 * A REJECTION ALWAYS CARRIES A REASON. The prompt is not politeness: "rejected"
 * with no note is an argument next week, and the zod gate refuses it anyway.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Undo2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { timesheetTotals } from "@/lib/finance/timesheet";
import type { TimeEntryDTO } from "@/lib/finance/types";
import { decideTimeAction } from "@/app/(app)/finance/time/actions";

export function TimeApprovals({
  entries,
  currency,
}: {
  entries: TimeEntryDTO[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  if (entries.length === 0) return null;

  const totals = timesheetTotals(entries, currency);
  const ids = selected.length > 0 ? selected : entries.map((e) => e.id);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That decision did not save.");
      else {
        setSelected([]);
        router.refresh();
      }
    });
  }

  function sendBack() {
    const reason = window.prompt("Why are these hours being sent back?")?.trim();
    if (!reason) return;
    run(() => decideTimeAction(ids, { approve: false, reason }));
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Card>
      <CardHeader
        title="Waiting for approval"
        subtitle={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}, ${totals.hours.toFixed(2)} hours, ${formatCurrency(totals.value, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of billable work`}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => decideTimeAction(ids, { approve: true }))}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" /> Approve {selected.length > 0 ? selected.length : "all"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={sendBack}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted hover:bg-surface-2 disabled:opacity-60"
            >
              <Undo2 className="h-3.5 w-3.5" /> Send back
            </button>
          </div>
        }
      />
      <CardBody className="space-y-2">
        {error ? (
          <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-2 pb-1.5" />
                <th className="px-3 pb-1.5 font-medium">Who</th>
                <th className="px-3 pb-1.5 font-medium">Date</th>
                <th className="px-3 pb-1.5 font-medium">Project</th>
                <th className="px-3 pb-1.5 font-medium">What</th>
                <th className="px-3 pb-1.5 text-right font-medium">Hours</th>
                <th className="px-3 pb-1.5 text-right font-medium">Worth</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      onChange={() => toggle(e.id)}
                      aria-label={`Select ${e.userName}'s ${e.hours} hours on ${e.date}`}
                      className="h-4 w-4 rounded border-border"
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-fg">{e.userName}</td>
                  <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs tabular-nums text-muted">
                    {e.date}
                  </td>
                  <td className="px-3 py-2 align-top text-muted">
                    {e.projectName ?? "No project"}
                    {!e.billable ? (
                      <span className="ml-1 text-[11px] text-faint">(non-billable)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-muted">{e.description ?? "—"}</td>
                  <td className="px-3 py-2 text-right align-top font-mono tabular-nums text-fg">
                    {e.hours.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right align-top font-mono tabular-nums text-muted">
                    {e.billable
                      ? formatCurrency(e.value, e.currency, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
