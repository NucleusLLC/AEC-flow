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
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
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
  const t = useT();
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
      if (!result.ok) setError(result.error ?? t("That decision did not save."));
      else {
        setSelected([]);
        router.refresh();
      }
    });
  }

  function sendBack() {
    const reason = window.prompt(t("Why are these hours being sent back?"))?.trim();
    if (!reason) return;
    run(() => decideTimeAction(ids, { approve: false, reason }));
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Card>
      <CardHeader
        title={t("Waiting for approval")}
        subtitle={fmt(
          entries.length === 1
            ? t("1 entry, {hours} hours, {amount} of billable work")
            : t("{count} entries, {hours} hours, {amount} of billable work"),
          {
            count: entries.length,
            hours: totals.hours.toFixed(2),
            amount: formatCurrency(totals.value, currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          },
        )}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => decideTimeAction(ids, { approve: true }))}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />{" "}
              {selected.length > 0
                ? fmt(t("Approve {count}"), { count: selected.length })
                : t("Approve all")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={sendBack}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted hover:bg-surface-2 disabled:opacity-60"
            >
              <Undo2 className="h-3.5 w-3.5" /> {t("Send back")}
            </button>
          </div>
        }
      />
      <CardBody className="space-y-2">
        {error ? (
          <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
            {t(error)}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-2 pb-1.5" />
                <th className="px-3 pb-1.5 font-medium">{t("Who")}</th>
                <th className="px-3 pb-1.5 font-medium">{t("Date")}</th>
                <th className="px-3 pb-1.5 font-medium">{t("Project")}</th>
                <th className="px-3 pb-1.5 font-medium">{t("What")}</th>
                <th className="px-3 pb-1.5 text-right font-medium">{t("Hours")}</th>
                <th className="px-3 pb-1.5 text-right font-medium">{t("Worth")}</th>
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
                      aria-label={fmt(t("Select {name}'s {hours} hours on {date}"), {
                        name: e.userName,
                        hours: e.hours,
                        date: e.date,
                      })}
                      className="h-4 w-4 rounded border-border"
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-fg">{e.userName}</td>
                  <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs tabular-nums text-muted">
                    {e.date}
                  </td>
                  <td className="px-3 py-2 align-top text-muted">
                    {e.projectName ?? t("No project")}
                    {!e.billable ? (
                      <span className="ml-1 text-[11px] text-faint">{t("(non-billable)")}</span>
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
