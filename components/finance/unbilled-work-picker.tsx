"use client";

/**
 * Choosing which approved work goes on an invoice.
 *
 * ─── THE RUNNING TOTAL IS THE POINT ─────────────────────────────────────────
 * Whoever raises the invoice is deciding how much to ask for, so the figure has
 * to move as the ticks move — and it is computed by `chosenTotal`, the same
 * pure function the server sums with. A screen that totals with its own
 * arithmetic and a server that stores a different number is how a client gets
 * billed one amount and shown another.
 *
 * ─── "SUMMARISE" CHANGES THE WORDING, NEVER THE ROWS ────────────────────────
 * Collapsing to one line re-groups the proposed lines, which changes their
 * keys — so the ticks are kept per mode rather than carried across. What gets
 * stamped is still every underlying timesheet row, so the double-bill guard is
 * untouched by how the invoice happens to read.
 *
 * ─── EXCLUDED WORK IS SHOWN, NOT DROPPED ────────────────────────────────────
 * "Why is Tuesday not on here" is the question this screen exists to answer.
 * Unapproved and non-billable rows are listed with the reason. Work that is
 * already on an invoice is not: it would pile up and bury the handful of rows
 * being held back, and the timesheet answers where it went.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Receipt } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { chosenTotal, type WorkLine } from "@/lib/finance/billing";
import { invoiceTotals } from "@/lib/finance/calc";
import { raiseFromWorkAction } from "@/app/(app)/finance/invoices/actions";

const input =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

export type UnbilledWorkView = {
  projectId: string;
  projectName: string;
  currency: string;
  /** Grouped one line per person-and-rate, one per expense. */
  detailed: WorkLine[];
  /** The same work, time collapsed into a single line. */
  summarised: WorkLine[];
  totalHours: number;
  excluded: { id: string; what: string; why: string }[];
};

export function UnbilledWorkPicker({ work }: { work: UnbilledWorkView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summarise, setSummarise] = useState(false);
  const [taxName, setTaxName] = useState("");
  const [taxPercent, setTaxPercent] = useState(0);

  const lines = summarise ? work.summarised : work.detailed;

  // Ticks are kept per mode, because collapsing to one line changes the keys.
  // Absent means "all of them" — bill the work, minus anything deliberately
  // held back, which is the intent of the screen.
  const [ticked, setTicked] = useState<Record<string, string[]>>({});
  const mode = summarise ? "summary" : "detail";
  const chosen = ticked[mode] ?? lines.map((l) => l.key);

  const money = (n: number) =>
    formatCurrency(n, work.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const net = useMemo(
    () => chosenTotal(lines, chosen, work.currency),
    [lines, chosen, work.currency],
  );
  const totals = useMemo(
    () =>
      invoiceTotals(
        lines.filter((l) => chosen.includes(l.key)).map((l) => ({ amount: l.amount, taxable: true })),
        { percent: taxPercent, mode: "EXCLUSIVE" },
        work.currency,
      ),
    [lines, chosen, taxPercent, work.currency],
  );

  const toggle = (key: string) =>
    setTicked((t) => {
      const current = t[mode] ?? lines.map((l) => l.key);
      return {
        ...t,
        [mode]: current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
      };
    });

  function submit() {
    setError(null);
    const form = new FormData();
    form.set("projectId", work.projectId);
    if (summarise) form.set("summarise", "on");
    if (taxName.trim()) form.set("taxName", taxName.trim());
    form.set("taxPercent", String(taxPercent));
    // What this screen is showing. The server refuses if the work has changed
    // underneath it — see `expectedTotal` in lib/data/work-billing.ts.
    form.set("expectedTotal", net.toFixed(2));
    for (const key of chosen) form.append("line", key);

    start(async () => {
      const res = await raiseFromWorkAction(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/finance/invoices/${res.id}`);
    });
  }

  if (work.detailed.length === 0) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm font-medium text-fg">
            There is no approved, unbilled work on {work.projectName}.
          </p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
            Hours and expenses reach this screen once they are marked billable and approved. Until
            then they show on the timesheet and the expense register.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="What this invoice bills"
          subtitle="Approved, billable and not yet on an invoice. Untick anything being held back."
          action={
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={summarise}
                onChange={(e) => setSummarise(e.target.checked)}
              />
              One line for all time
            </label>
          }
        />
        <CardBody>
          <div className="overflow-x-auto pb-1">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-1.5" />
                  <th className="pb-1.5 font-medium">Line</th>
                  <th className="pb-1.5 text-right font-medium">Quantity</th>
                  <th className="pb-1.5 text-right font-medium">Rate</th>
                  <th className="pb-1.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-t border-border/60">
                    <td className="py-2 pr-2 align-top">
                      <input
                        type="checkbox"
                        checked={chosen.includes(l.key)}
                        onChange={() => toggle(l.key)}
                        aria-label={`Bill ${l.description}`}
                      />
                    </td>
                    <td className="py-2 align-top">
                      <div className="text-fg">{l.description}</div>
                      {l.kind === "TIME" && l.unitRate === null ? (
                        <div className="text-[11px] text-faint">
                          {l.hours.toFixed(2)} hours across more than one rate, so the line carries
                          no rate.
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right align-top font-mono tabular-nums text-muted">
                      {l.quantity === null ? "—" : `${l.quantity.toFixed(2)} h`}
                    </td>
                    <td className="py-2 text-right align-top font-mono tabular-nums text-muted">
                      {l.unitRate === null ? "—" : money(l.unitRate)}
                    </td>
                    <td className="py-2 text-right align-top font-mono font-semibold tabular-nums text-fg">
                      {money(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {work.excluded.length > 0 ? (
        <Card>
          <CardHeader
            title="Not billed, and why"
            subtitle="Shown so nothing goes missing without a reason."
          />
          <CardBody>
            <ul className="space-y-1 text-sm">
              {work.excluded.map((x) => (
                <li key={x.id} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="text-muted">
                    <span className="text-fg">{x.what}</span> — {x.why}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Tax and total" subtitle="The draft can be edited before it is issued." />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="work-tax-name">
                Tax name
              </label>
              <input
                id="work-tax-name"
                className={input}
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
                placeholder="BBO"
              />
            </div>
            <div>
              <label className={label} htmlFor="work-tax-percent">
                Tax %
              </label>
              <input
                id="work-tax-percent"
                type="number"
                step="0.01"
                min="0"
                className={input}
                value={taxPercent}
                onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
              />
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] uppercase tracking-wide text-faint">Total</div>
              <div className="font-mono text-lg font-semibold tabular-nums text-fg">
                {money(totals.total)}
              </div>
              <div className="text-[11px] text-faint">
                {money(net)} net{taxPercent > 0 ? ` · ${money(totals.taxTotal)} tax` : ""}
              </div>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={pending || chosen.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              <Receipt className="h-4 w-4" />
              {pending ? "Raising…" : "Raise draft invoice"}
            </button>
            <span className="text-xs text-muted">
              {chosen.length} line{chosen.length === 1 ? "" : "s"} · {work.totalHours.toFixed(2)} hours
              available
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
