"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { evaluateScenario, sensitivity, type ScenarioVars } from "@/lib/development/calc";
import { SCENARIO_KIND_LABEL, type Scenario } from "@/lib/data/development.types";
import { formatCurrency } from "@/lib/format";

const numInput = "h-8 w-28 rounded border border-border bg-surface px-2 text-right text-sm tabular-nums text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function ScenarioPlanner({
  scenarios,
  netSellableLand,
  unitArea,
  unitCount,
  currency,
}: {
  scenarios: Scenario[];
  netSellableLand: number;
  unitArea: number;
  unitCount: number;
  currency: string;
}) {
  const toVars = (s: Scenario): ScenarioVars => ({
    landPurchasePrice: s.landPurchasePrice, salesPricePerM2: s.salesPricePerM2, constructionCostPerM2: s.constructionCostPerM2,
    infrastructureCost: s.infrastructureCost, softCostPct: s.softCostPct, financingRatePct: s.financingRatePct,
    contingencyPct: s.contingencyPct, netSellableLand, unitConstructionArea: unitArea, unitCount,
  });

  const compared = scenarios.map((s) => ({ s, r: evaluateScenario(toVars(s)) }));

  // Custom scenario seeded from the base case.
  const base = scenarios.find((s) => s.kind === "BASE") ?? scenarios[0];
  const [custom, setCustom] = useState<ScenarioVars>(
    base ? toVars(base) : { landPurchasePrice: 0, salesPricePerM2: 0, constructionCostPerM2: 0, infrastructureCost: 0, softCostPct: 0, financingRatePct: 0, contingencyPct: 0, netSellableLand, unitConstructionArea: unitArea, unitCount },
  );
  const setV = (k: keyof ScenarioVars, v: number) => setCustom((p) => ({ ...p, [k]: v }));
  const customResult = useMemo(() => evaluateScenario(custom), [custom]);
  const sens = useMemo(() => sensitivity(customResult.revenue, customResult.cost), [customResult]);

  const driverRows: Array<{ k: keyof ScenarioVars; label: string; suffix?: string }> = [
    { k: "landPurchasePrice", label: "Land purchase price" },
    { k: "salesPricePerM2", label: "Sales price /m²" },
    { k: "constructionCostPerM2", label: "Construction cost /m²" },
    { k: "infrastructureCost", label: "Infrastructure cost" },
    { k: "softCostPct", label: "Soft cost", suffix: "%" },
    { k: "financingRatePct", label: "Financing rate", suffix: "%" },
    { k: "contingencyPct", label: "Contingency", suffix: "%" },
  ];

  return (
    <div className="space-y-6">
      {/* Comparison */}
      <Card className="overflow-hidden">
        <CardHeader title="Scenario comparison" subtitle="Revenue, cost and return for each case" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-2.5 font-medium">Scenario</th>
                <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                <th className="px-3 py-2.5 text-right font-medium">Profit</th>
                <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                <th className="px-3 py-2.5 text-right font-medium">ROI</th>
                <th className="px-3 py-2.5 text-right font-medium">Break-even /m²</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {compared.map(({ s, r }) => (
                <tr key={s.id} className="even:bg-surface-2/40">
                  <td className="px-4 py-2.5"><span className="font-medium text-fg">{s.name}</span> <span className="text-[11px] text-faint">{SCENARIO_KIND_LABEL[s.kind]}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-fg">{formatCurrency(r.revenue, currency)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{formatCurrency(r.cost, currency)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${r.profit < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(r.profit, currency)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{r.marginPct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{r.roiPct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{formatCurrency(r.breakEvenSalesPricePerM2, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Custom + sensitivity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Custom scenario" subtitle="Tune the drivers — outputs recalc live" />
          <CardBody className="space-y-2">
            {driverRows.map((d) => (
              <label key={d.k} className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">{d.label}</span>
                <span className="flex items-center gap-1.5">
                  <input type="number" className={numInput} value={custom[d.k] as number} onChange={(e) => setV(d.k, Number(e.target.value))} />
                  {d.suffix ? <span className="w-4 text-xs text-faint">{d.suffix}</span> : null}
                </span>
              </label>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
              <Out label="Revenue" value={formatCurrency(customResult.revenue, currency)} />
              <Out label="Cost" value={formatCurrency(customResult.cost, currency)} />
              <Out label="Profit" value={formatCurrency(customResult.profit, currency)} accent />
              <Out label="ROI" value={`${customResult.roiPct.toFixed(1)}%`} accent />
              <Out label="Margin" value={`${customResult.marginPct.toFixed(1)}%`} />
              <Out label="Break-even /m²" value={formatCurrency(customResult.breakEvenSalesPricePerM2, currency)} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sensitivity" subtitle="Profit at ±5% / ±10% on price and cost" />
          <CardBody className="space-y-4">
            {([["Sales price", sens.price], ["Construction cost", sens.cost]] as const).map(([title, cells]) => (
              <div key={title}>
                <div className="mb-1.5 text-xs font-medium text-muted">{title}</div>
                <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                  {cells.map((c) => (
                    <div key={c.label} className={`rounded-lg px-1 py-2 ${c.deltaPct === 0 ? "bg-brand/10 ring-1 ring-brand/30" : "bg-surface-2"}`}>
                      <div className="text-[10px] text-faint">{c.deltaPct > 0 ? `+${c.deltaPct}` : c.deltaPct}%</div>
                      <div className={`mt-0.5 font-medium tabular-nums ${c.profit < 0 ? "text-red-600" : "text-fg"}`}>{formatCurrency(c.profit, currency, { notation: "compact", maximumFractionDigits: 1 })}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Out({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${accent ? "text-emerald-700" : "text-fg"}`}>{value}</div>
    </div>
  );
}
