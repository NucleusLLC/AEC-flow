"use client";

import { Download, Printer, FileText } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { computeLot } from "@/lib/development/calc";
import type { DevelopmentProjectFull } from "@/lib/data/development.types";
import type { ProjectMetrics } from "@/lib/development/metrics";
import { formatCurrency } from "@/lib/format";

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsView({ project, metrics: m }: { project: DevelopmentProjectFull; metrics: ProjectMetrics }) {
  const cur = m.currency;
  const costPerM2 = m.costPerNetM2;

  const exportLots = () =>
    downloadCsv(`${project.projectNumber}-lots.csv`, project.lots.map((l) => {
      const c = computeLot({ areaM2: l.areaM2, baseLandPricePerM2: l.baseLandPricePerM2, premiumAdjustmentPerM2: l.premiumAdjustmentPerM2, allocatedCostPerM2: costPerM2 });
      return {
        Lot: l.lotNumber, Phase: l.phase ?? "", Area_m2: l.areaM2, Price_m2: c.finalSalesPricePerM2,
        Sales: Math.round(c.totalSalesPrice), Cost: Math.round(c.totalAllocatedCost), Profit: Math.round(c.grossProfit),
        Margin_pct: c.grossMarginPct.toFixed(1), Status: l.status, Buyer: l.buyerName ?? "",
      };
    }));

  const exportBudget = () =>
    downloadCsv(`${project.projectNumber}-budget.csv`, project.budget.map((b) => ({
      Code: b.costCode, Category: b.category, Item: b.item, Qty: b.quantity, Unit: b.unit ?? "", Rate: b.unitRate,
      Budget: Math.round(b.budget), Committed: Math.round(b.committed), Paid: Math.round(b.actualPaid),
      Remaining: Math.round(b.budget - b.actualPaid), Status: b.status,
    })));

  const exportCashFlow = () =>
    downloadCsv(`${project.projectNumber}-cashflow.csv`, project.cashFlow.map((c) => ({
      Month: c.month, Acquisition: c.acquisitionCost, Consultant: c.consultantCost, Infrastructure: c.infrastructureCost,
      Construction: c.constructionCost, Marketing: c.marketingCost, Financing: c.financingCost,
      Sales: c.salesIncome, Deposits: c.depositIncome, LoanDraw: c.loanDraw, LoanRepay: c.loanRepayment,
    })));

  const base = `/print/development/${project.id}`;
  type Report = { title: string; desc: string; icon: typeof Printer; label: string; href?: string; action?: () => void };
  const reports: Report[] = [
    { title: "Development feasibility report", desc: "Branded A4 pro-forma — land, cost, revenue, profit", href: `${base}/feasibility`, icon: Printer, label: "Open PDF" },
    { title: "Lot sales report", desc: "Branded A4 — per-lot price, cost, profit, status", href: `${base}/lots`, icon: Printer, label: "Open PDF" },
    { title: "Investor / bank report", desc: "Branded A4 — capital, returns, receivables", href: `${base}/investor`, icon: Printer, label: "Open PDF" },
    { title: "Project close-out report", desc: "Branded A4 — delivery, final cost & result, sign-off", href: `${base}/closeout`, icon: Printer, label: "Open PDF" },
    { title: "Lot sales (spreadsheet)", desc: "Per-lot data for Excel", action: exportLots, icon: Download, label: "Export CSV" },
    { title: "Budget vs actual (spreadsheet)", desc: "Cost codes — budget, committed, paid, variance", action: exportBudget, icon: Download, label: "Export CSV" },
    { title: "Cash-flow (spreadsheet)", desc: "Monthly inflows, outflows and position", action: exportCashFlow, icon: Download, label: "Export CSV" },
  ];

  return (
    <div className="space-y-6">
      {/* Printable feasibility summary */}
      <Card>
        <CardHeader title="Development feasibility summary" subtitle={`${project.name} · ${project.projectNumber}`} />
        <CardBody>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
            {[
              ["Gross parcel", `${m.grossParcelArea.toLocaleString()} m²`],
              ["Net sellable", `${m.netSellableLand.toLocaleString()} m²`],
              ["Sellable ratio", `${m.sellableRatioPct.toFixed(1)}%`],
              ["Total lots / units", `${m.totalLots} / ${m.totalUnits}`],
              ["Total project cost", formatCurrency(m.totalProjectCost, cur)],
              ["Cost / net m²", `${formatCurrency(m.costPerNetM2, cur)}/m²`],
              ["Expected revenue", formatCurrency(m.totalRevenue, cur)],
              ["Total profit", formatCurrency(m.totalProfit, cur)],
              ["Gross margin", `${m.grossMarginPct.toFixed(1)}%`],
              ["ROI", `${m.roiPct.toFixed(1)}%`],
              ["Break-even /m²", `${formatCurrency(m.breakEvenPerM2, cur)}/m²`],
              ["Sales progress", `${m.salesProgressPct.toFixed(0)}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-border py-1.5">
                <span className="text-muted">{label}</span>
                <span className="font-medium text-fg">{value}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.title} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-faint"><FileText className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-medium text-fg">{r.title}</div>
                  <div className="text-xs text-muted">{r.desc}</div>
                </div>
              </div>
              {r.href ? (
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2">
                  <Icon className="h-4 w-4" /> {r.label}
                </a>
              ) : (
                <button type="button" onClick={r.action} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2">
                  <Icon className="h-4 w-4" /> {r.label}
                </button>
              )}
            </Card>
          );
        })}
      </div>
      <p className="px-1 text-[11px] text-faint">Branded A4 PDF reports open in a new tab (use the browser&apos;s “Save as PDF”). CSV exports download for Excel.</p>
    </div>
  );
}
