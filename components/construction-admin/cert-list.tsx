"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, BadgeCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CertStatusBadge } from "@/components/construction-admin/badges";
import type { ProgressCertification, CertificationStatus } from "@/lib/ca/types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: "ALL" | CertificationStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "APPROVED", label: "Approved" },
];

export function CertList({ certifications }: { certifications: ProgressCertification[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | CertificationStatus>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return certifications.filter((c) => {
      if (status !== "ALL" && c.status !== status) return false;
      if (!q) return true;
      return [c.certificationNumber, c.projectName, c.lenderName ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [certifications, query, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                status === f.key ? "bg-brand text-brand-fg ring-brand" : "bg-surface text-muted ring-border hover:text-fg",
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
            placeholder="Search certifications…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-64"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Certification</th>
                <th className="px-3 py-2.5 font-medium">Lender</th>
                <th className="px-3 py-2.5 font-medium text-right">% Complete</th>
                <th className="px-3 py-2.5 font-medium text-right">Recommended</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="group transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/construction-admin/certifications/${c.id}`} className="block">
                      <span className="font-mono text-[11px] text-faint">{c.certificationNumber}</span>
                      <span className="mt-0.5 block max-w-xs truncate font-medium text-fg group-hover:text-brand">{c.projectName}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{c.lenderName ?? "—"}</td>
                  <td className="px-3 py-3 text-right text-fg">{c.currentPercentComplete}%</td>
                  <td className="px-3 py-3 text-right font-medium text-fg">{formatCurrency(c.amountRecommendedForPayment, c.currency)}</td>
                  <td className="px-5 py-3"><CertStatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No certifications match your filters</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">Showing {rows.length} of {certifications.length} certifications</p>
    </div>
  );
}
