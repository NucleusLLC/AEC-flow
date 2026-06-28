import Link from "next/link";
import { Plus } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { ReportList } from "@/components/construction-admin/report-list";
import { listReports } from "@/lib/data/ca/reports";

export const metadata = { title: "Reports · ZenArch" };

export default async function ReportsPage() {
  const reports = await listReports();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Progress Reports</h2>
          <p className="text-sm text-muted">Daily, weekly, bi-weekly and monthly executive reports.</p>
        </div>
        <Link href="/construction-admin/reports/new" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
          <Plus className="h-4 w-4" />
          New Report
        </Link>
      </div>
      <CaSubNav />
      <ReportList reports={reports} />
    </div>
  );
}
