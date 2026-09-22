"use client";

/**
 * Standard hourly rates, one row per person.
 *
 * WHY THIS LIVES IN FINANCE AND NOT ON THE MEMBER FORM. A charge-out rate is
 * the price of the firm's work and a cost rate is close to somebody's salary.
 * Both are money, both are administrator-only, and neither belongs beside the
 * fields a colleague may edit on a team record (`lib/team/member-write-policy.ts`
 * explains that split). `setPersonRates` enforces the same gate server-side.
 *
 * CHANGING A RATE PRICES THE NEXT HOUR LOGGED. Entries already saved keep the
 * rates they were saved with — that snapshot is the whole point — so this panel
 * says so rather than leaving somebody to expect a retroactive correction.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { setPersonRatesAction } from "@/app/(app)/finance/time/actions";

const CONTROL =
  "h-9 w-28 rounded-lg border border-border bg-surface px-3 text-right font-mono text-sm tabular-nums text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export type RatePerson = {
  id: string;
  name: string;
  chargeOutRate: number | null;
  costRate: number | null;
};

export function RateTable({ people, currency }: { people: RatePerson[]; currency: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { charge: string; cost: string }>>(() =>
    Object.fromEntries(
      people.map((p) => [
        p.id,
        { charge: p.chargeOutRate?.toString() ?? "", cost: p.costRate?.toString() ?? "" },
      ]),
    ),
  );

  function set(id: string, key: "charge" | "cost", value: string) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));
  }

  function toNumberOrNull(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function save(id: string) {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await setPersonRatesAction(id, {
        chargeOutRate: toNumberOrNull(draft[id]?.charge ?? ""),
        costRate: toNumberOrNull(draft[id]?.cost ?? ""),
      });
      if (!result.ok) setError(result.error);
      else {
        setSaved(id);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Hourly rates"
        subtitle={`In ${currency}. A change prices the next hour logged — entries already saved keep the rate they were saved with.`}
      />
      <CardBody className="space-y-2">
        {error ? (
          <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 pb-1.5 font-medium">Who</th>
                <th className="px-3 pb-1.5 text-right font-medium">Charged out at</th>
                <th className="px-3 pb-1.5 text-right font-medium">Costs the practice</th>
                <th className="px-3 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-fg">{p.name}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={draft[p.id]?.charge ?? ""}
                      onChange={(e) => set(p.id, "charge", e.target.value)}
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`What ${p.name} is charged out at, per hour`}
                      className={CONTROL}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={draft[p.id]?.cost ?? ""}
                      onChange={(e) => set(p.id, "cost", e.target.value)}
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`What an hour of ${p.name}'s time costs the practice`}
                      className={CONTROL}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => save(p.id)}
                      className="h-8 rounded-lg border border-border px-3 text-xs text-muted hover:bg-surface-2 disabled:opacity-60"
                    >
                      {saved === p.id && !pending ? "Saved" : "Save"}
                    </button>
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
