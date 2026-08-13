"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SaveControl } from "@/components/development/save-control";
import { CsvImport } from "@/components/development/csv-import";
import { withHeader, csvNum } from "@/lib/development/csv";
import { computeCostLine, sum, COST_CODES } from "@/lib/development/calc";
import type { InfrastructureBudget } from "@/lib/data/development.types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { uid } from "@/components/projects/dashboard/hooks";

type Row = InfrastructureBudget;

const cell = "border-b border-border px-2 py-1.5";
const numInput = "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-sm tabular-nums text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";
const txtInput = "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-sm text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";

export function CostBudget({ projectId, budget, currency }: { projectId: string; budget: InfrastructureBudget[]; currency: string }) {
  const [rows, setRows] = useState<Row[]>(budget);
  const set = (id: string, k: keyof Row, v: string | number) => setRows((p) => p.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const remove = (id: string) => setRows((p) => p.filter((r) => r.id !== id));
  const add = () => setRows((p) => [...p, { id: uid("bud"), projectId, costCode: 5000, category: "Infrastructure / Civil Works", item: "New item", quantity: 1, unit: "ls", unitRate: 0, budget: 0, committed: 0, actualPaid: 0, vendor: null, contractRef: null, invoiceRef: null, status: "BUDGETED" }]);

  const importCsv = (raw: string[][]): number => {
    const { records } = withHeader(raw, ["code", "category", "item", "qty", "unit", "rate", "committed", "paid"]);
    const mapped: Row[] = records.map((r) => ({
      id: uid("bud"), projectId, costCode: csvNum(r.code) || 5000,
      category: r.category || "Infrastructure / Civil Works", item: r.item || "Imported item",
      quantity: csvNum(r.qty) || 1, unit: r.unit || "ls", unitRate: csvNum(r.rate), budget: 0,
      committed: csvNum(r.committed), actualPaid: csvNum(r.paid), vendor: null, contractRef: null, invoiceRef: null, status: "BUDGETED",
    }));
    setRows((p) => [...p, ...mapped]);
    return mapped.length;
  };

  const computed = useMemo(
    () => rows.map((r) => ({ row: r, calc: computeCostLine({ quantity: r.quantity, unitRate: r.unitRate, committed: r.committed, actualPaid: r.actualPaid }) })),
    [rows],
  );
  const totals = useMemo(() => {
    const budgetT = sum(computed.map((c) => c.calc.budget));
    const committedT = sum(computed.map((c) => c.calc.committed));
    const paidT = sum(computed.map((c) => c.calc.actualPaid));
    return { budget: budgetT, committed: committedT, paid: paidT, remaining: budgetT - paidT };
  }, [computed]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Infrastructure / cost-code budget</h3>
            <p className="text-xs text-muted">Budget = qty × rate. Variance = budget − paid. Codes 1000–10000.</p>
          </div>
          <div className="flex items-center gap-2">
            <CsvImport onRows={importCsv} hint="Columns: code, category, item, qty, unit, rate, committed, paid" />
            <button type="button" onClick={add} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"><Plus className="h-4 w-4" /> Add line</button>
            <SaveControl url={`/api/development/${projectId}/budget`} build={() => ({ lines: rows.map((r) => ({ ...r, budget: r.quantity * r.unitRate })) })} label="Save budget" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-2 py-2 font-medium">Code</th>
                <th className="px-2 py-2 font-medium">Item</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="px-2 py-2 font-medium">Unit</th>
                <th className="px-2 py-2 text-right font-medium">Rate</th>
                <th className="px-2 py-2 text-right font-medium">Budget</th>
                <th className="px-2 py-2 text-right font-medium">Committed</th>
                <th className="px-2 py-2 text-right font-medium">Paid</th>
                <th className="px-2 py-2 text-right font-medium">Remaining</th>
                <th className="px-2 py-2 text-right font-medium">Variance</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {computed.map(({ row: r, calc: c }) => (
                <tr key={r.id} className="even:bg-surface-2/40">
                  <td className={cell}>
                    <select className="h-8 w-24 rounded border border-border bg-surface px-1 text-xs" value={r.costCode} onChange={(e) => set(r.id, "costCode", Number(e.target.value))}>
                      {COST_CODES.map((cc) => <option key={cc.code} value={cc.code}>{cc.code}</option>)}
                    </select>
                  </td>
                  <td className={cell}><input className={`${txtInput} w-44`} value={r.item} onChange={(e) => set(r.id, "item", e.target.value)} /></td>
                  <td className={cell}><input type="number" className={numInput} value={r.quantity} onChange={(e) => set(r.id, "quantity", Number(e.target.value))} /></td>
                  <td className={cell}><input className={`${txtInput} w-14`} value={r.unit ?? ""} onChange={(e) => set(r.id, "unit", e.target.value)} /></td>
                  <td className={cell}><input type="number" className={numInput} value={r.unitRate} onChange={(e) => set(r.id, "unitRate", Number(e.target.value))} /></td>
                  <td className={`${cell} text-right tabular-nums font-medium text-fg`}>{formatCurrency(c.budget, currency)}</td>
                  <td className={cell}><input type="number" className={numInput} value={r.committed} onChange={(e) => set(r.id, "committed", Number(e.target.value))} /></td>
                  <td className={cell}><input type="number" className={numInput} value={r.actualPaid} onChange={(e) => set(r.id, "actualPaid", Number(e.target.value))} /></td>
                  <td className={`${cell} text-right tabular-nums text-muted`}>{formatCurrency(c.remainingBudget, currency)}</td>
                  <td className={`${cell} text-right tabular-nums ${c.overBudget ? "text-red-600 font-medium" : "text-emerald-600"}`}>{formatCurrency(c.variance, currency)}</td>
                  <td className={cell}><button type="button" onClick={() => remove(r.id)} className="text-faint hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2 font-semibold">
                <td className="px-2 py-2.5" colSpan={5}>Totals · {rows.length} lines</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(totals.budget, currency)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(totals.committed, currency)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(totals.paid, currency)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(totals.remaining, currency)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total budget", value: formatCurrency(totals.budget, currency) },
          { label: "Committed", value: formatCurrency(totals.committed, currency) },
          { label: "Paid to date", value: formatCurrency(totals.paid, currency) },
          { label: "Remaining", value: formatCurrency(totals.remaining, currency) },
        ].map((t) => (
          <div key={t.label} className="card-surface rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-muted">{t.label}</div>
            <div className="mt-1 text-base font-semibold text-fg">{t.value}</div>
          </div>
        ))}
      </div>
      <p className="px-1 text-[11px] text-faint">Lines edit and roll up instantly. Use “Save budget” to persist (requires the database to be live). {formatNumber(rows.length)} lines.</p>
    </div>
  );
}
