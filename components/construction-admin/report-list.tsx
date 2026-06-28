"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReportStatusBadge } from "@/components/construction-admin/badges";
import { CA_REPORT_TYPE_LABEL } from "@/lib/ca/labels";
import type { CaReport, CaReportType } from "@/lib/ca/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPES: Array<{ key: "ALL" | CaReportType; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DAILY", label: "Daily" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "BIWEEKLY", label: "Bi-Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "EXECUTIVE", label: "Executive" },
];

export function ReportList({ reports }: { reports: CaReport[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ALL" | CaReportType>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (type !== "ALL" && r.reportType !== type) return false;
      if (!q) return true;
      return [r.reportNumber, r.projectName, r.preparedBy ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [reports, query, type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {TYPES.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setType(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                type === f.key ? "bg-brand text-brand-fg ring-brand" : "bg-surface text-muted ring-border hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search reports…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-64"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Report</th>
                <th className="px-3 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Period</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="group transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/construction-admin/reports/${r.id}`} className="block">
                      <span className="font-mono text-[11px] text-faint">{r.reportNumber}</span>
                      <span className="mt-0.5 block font-medium text-fg group-hover:text-brand">{CA_REPORT_TYPE_LABEL[r.reportType]}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{r.projectName}</td>
                  <td className="px-3 py-3 text-muted">
                    {r.reportingPeriodStart ? `${formatDate(r.reportingPeriodStart)} – ${formatDate(r.reportingPeriodEnd)}` : "—"}
                  </td>
                  <td className="px-5 py-3"><ReportStatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No reports match your filters</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">Showing {rows.length} of {reports.length} reports</p>
    </div>
  );
}
