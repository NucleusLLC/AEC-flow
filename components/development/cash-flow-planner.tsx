"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SaveControl } from "@/components/development/save-control";
import { computeCashFlow, type CashFlowMonthInput } from "@/lib/development/calc";
import type { CashFlowMonth } from "@/lib/data/development.types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";

const cell = "border-b border-border px-2 py-1.5";
const numInput = "h-8 w-24 rounded border border-transparent bg-transparent px-1.5 text-right text-sm tabular-nums text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";

type Field = keyof Pick<CashFlowMonth, "acquisitionCost" | "infrastructureCost" | "constructionCost" | "marketingCost" | "financingCost" | "salesIncome" | "depositIncome" | "loanDraw" | "loanRepayment">;

const COLS: Array<{ key: Field; label: string }> = [
  { key: "acquisitionCost", label: "Acquisition" },
  { key: "infrastructureCost", label: "Infra" },
  { key: "constructionCost", label: "Construction" },
  { key: "marketingCost", label: "Marketing" },
  { key: "financingCost", label: "Financing" },
  { key: "salesIncome", label: "Sales" },
  { key: "depositIncome", label: "Deposits" },
  { key: "loanDraw", label: "Loan draw" },
  { key: "loanRepayment", label: "Loan repay" },
];

export function CashFlowPlanner({ projectId, months: initial, currency }: { projectId: string; months: CashFlowMonth[]; currency: string }) {
  const [months, setMonths] = useState(initial);
  const set = (id: string, k: Field, v: number) => setMonths((p) => p.map((m) => (m.id === id ? { ...m, [k]: v } : m)));

  const result = useMemo(() => {
    const input: CashFlowMonthInput[] = months.map((m) => ({
      month: m.month, acquisitionCost: m.acquisitionCost, consultantCost: m.consultantCost, permitCost: m.permitCost,
      infrastructureCost: m.infrastructureCost, constructionCost: m.constructionCost, marketingCost: m.marketingCost,
      financingCost: m.financingCost, salesIncome: m.salesIncome, depositIncome: m.depositIncome,
      loanDraw: m.loanDraw, loanRepayment: m.loanRepayment,
    }));
    return computeCashFlow(input, 0);
  }, [months]);

  const chartData = result.months.map((m) => ({ month: m.month, closing: m.closingCash }));

  const metrics = [
    { label: "Peak capital requirement", value: formatCurrency(result.peakCapitalRequirement, currency), hint: result.peakNegativeMonth ?? "—" },
    { label: "Break-even month", value: result.breakEvenMonth ?? "—" },
    { label: "Payback month", value: result.paybackMonth ?? "—" },
    { label: "Final cash position", value: formatCurrency(result.months.at(-1)?.closingCash ?? 0, currency) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted">{m.label}</div>
            <div className="mt-1 text-base font-semibold text-fg">{m.value}</div>
            {m.hint ? <div className="text-[11px] text-faint">{m.hint}</div> : null}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Cumulative cash position" subtitle="The trough is the peak capital you must fund" />
        <CardBody>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatCurrencyCompact(v as number, currency)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v) => formatCurrency(v as number, currency)} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Area type="monotone" dataKey="closing" stroke="#3b82f6" fill="url(#cashFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Monthly cash-flow planner" action={<SaveControl url={`/api/development/${projectId}/cash-flow`} build={() => ({ months })} label="Save cash flow" />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-2 py-2 font-medium">Month</th>
                {COLS.map((c) => <th key={c.key} className="px-2 py-2 text-right font-medium">{c.label}</th>)}
                <th className="px-2 py-2 text-right font-medium">Closing</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={m.id} className="even:bg-surface-2/40">
                  <td className={`${cell} font-mono text-xs text-muted`}>{m.month}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className={cell}><input type="number" className={numInput} value={m[c.key]} onChange={(e) => set(m.id, c.key, Number(e.target.value))} /></td>
                  ))}
                  <td className={`${cell} text-right font-medium tabular-nums ${result.months[i].closingCash < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(result.months[i].closingCash, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[11px] text-faint">Closing cash, peak capital and break-even recalculate instantly as you edit.</p>
      </Card>
    </div>
  );
}
