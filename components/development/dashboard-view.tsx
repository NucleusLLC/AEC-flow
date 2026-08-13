"use client";

import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/format";
import type { ProjectMetrics } from "@/lib/development/metrics";

const PIE_COLORS = ["#94a3b8", "#f59e0b", "#8b5cf6", "#10b981"];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-fg">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-faint">{hint}</div> : null}
    </div>
  );
}

export function DevDashboardView({
  metrics: m,
  closeoutDate,
}: {
  metrics: ProjectMetrics;
  closeoutDate: string;
}) {
  const cur = m.currency;
  return (
    <div className="space-y-6">
      {m.warnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">{m.warnings.join(" ")}</div>
        </div>
      ) : null}

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Gross parcel" value={`${formatNumber(m.grossParcelArea)} m²`} />
        <Kpi label="Net sellable" value={`${formatNumber(m.netSellableLand)} m²`} hint={`${m.sellableRatioPct.toFixed(1)}% of gross`} />
        <Kpi label="Total lots" value={String(m.totalLots)} hint={`${m.totalUnits} units`} />
        <Kpi label="Break-even" value={`${formatCurrency(m.breakEvenPerM2, cur)}/m²`} />
        <Kpi label="Project cost" value={formatCurrency(m.totalProjectCost, cur)} />
        <Kpi label="Expected revenue" value={formatCurrency(m.totalRevenue, cur)} hint={`lots ${formatCurrencyCompact(m.lotRevenue, cur)} · units ${formatCurrencyCompact(m.unitRevenue, cur)}`} />
        <Kpi label="Total profit" value={formatCurrency(m.totalProfit, cur)} />
        <Kpi label="Margin / ROI" value={`${m.grossMarginPct.toFixed(1)}% / ${m.roiPct.toFixed(1)}%`} />
        <Kpi label="Cash collected" value={formatCurrency(m.cashCollected, cur)} />
        <Kpi label="Receivable" value={formatCurrency(m.outstandingReceivables, cur)} />
        <Kpi label="Close-out target" value={closeoutDate} />
        <Kpi label="Budget overruns" value={String(m.budgetOverruns)} />
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: "Sales progress", pct: m.salesProgressPct, hint: `${m.lotsSold + m.lotsClosed}/${m.totalLots} placed` },
          { label: "Budget used", pct: m.budgetUsedPct, hint: `${formatCurrencyCompact(m.budgetPaid, cur)} paid` },
          { label: "Permit progress", pct: m.permitProgressPct, hint: `${m.permitDone}/${m.permitTotal} approved` },
        ].map((b) => (
          <Card key={b.label}>
            <CardBody>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{b.label}</span>
                <span className="font-semibold text-fg">{b.pct.toFixed(0)}%</span>
              </div>
              <ProgressBar value={Math.min(100, b.pct)} className="mt-2" />
              <div className="mt-1 text-[11px] text-faint">{b.hint}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue vs cost" />
          <CardBody>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={[{ name: "Project", Revenue: m.revenueVsCost.revenue, Cost: m.revenueVsCost.cost, Profit: m.revenueVsCost.profit }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatCurrencyCompact(v as number, cur)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => formatCurrency(v as number, cur)} />
                <Legend />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sales status" />
          <CardBody>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={m.salesStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {m.salesStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cost breakdown by category" />
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={m.budgetByCode} margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v as number, cur)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatCurrency(v as number, cur)} />
                <Bar dataKey="budget" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Profit by lot" />
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={m.profitByLot}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="lot" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={50} />
                <YAxis tickFormatter={(v) => formatCurrencyCompact(v as number, cur)} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => formatCurrency(v as number, cur)} />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {m.profitByLot.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? "#10b981" : "#ef4444"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
