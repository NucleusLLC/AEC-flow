import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReportForm } from "@/components/construction-admin/report-form";
import { getProjects } from "@/lib/data/projects";
import type { CaReportType } from "@/lib/ca/types";

export const metadata: Metadata = { title: "New Report · AEC-flow" };

type PageProps = { searchParams: Promise<{ type?: string }> };

const VALID: CaReportType[] = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "EXECUTIVE"];

export default async function NewReportPage({ searchParams }: PageProps) {
  const { type } = await searchParams;
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));
  const defaultType = (VALID as string[]).includes(type ?? "") ? (type as CaReportType) : "WEEKLY";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/construction-admin/reports" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Reports
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Report Generator</h2>
        <p className="text-sm text-muted">Compile a progress report; it is saved through the API and ready to export as a PDF.</p>
      </div>
      <ReportForm projects={options} defaultType={defaultType} />
    </div>
  );
}
