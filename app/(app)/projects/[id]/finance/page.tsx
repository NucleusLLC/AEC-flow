import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/data/projects";
import { getProjectFinance } from "@/lib/data/project-finance";
import { ProjectFinanceView } from "@/components/finance/project-finance-view";
import { getServerT } from "@/lib/i18n/server";
import { ymd } from "@/lib/building-permits/register";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  const t = await getServerT();
  return { title: project ? `${project.name} · ${t("Finance")} · AEC-flow` : `${t("Project")} · AEC-flow` };
}

/**
 * The project's money in one place: contract against invoiced, work waiting to
 * be billed, margin (administrators only — the gate is in getProjectFinance),
 * hours by phase and person, and the job's invoices and expenses. Read-only:
 * every action links to the finance screen that already does it.
 */
export default async function ProjectFinancePage({ params }: PageProps) {
  const { id } = await params;
  const today = ymd(new Date());
  const data = await getProjectFinance(id, today);
  if (!data) notFound();
  const t = await getServerT();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-fg">{t("Finance")}</h3>
        <p className="text-xs text-muted">
          {t("What this job is contracted for, what has been billed and paid, and what is still to bill.")}
        </p>
      </div>
      <ProjectFinanceView data={data} today={today} />
    </div>
  );
}
