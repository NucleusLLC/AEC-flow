import { Card } from "@/components/ui/card";
import { EmailButton } from "@/components/email/email-button";
import { ReportsCharts, type NameValue, type MonthValue } from "@/components/reports/reports-charts";
import {
  getProposals,
  summarizeProposals,
  PROPOSAL_STATUS_LABEL,
  type ProposalStatus,
} from "@/lib/data/proposals";
import {
  getProjects,
  summarizeProjects,
  PROJECT_STATUS_LABEL,
  DISCIPLINE_LABEL,
  type ProjectStatus,
  type Discipline,
} from "@/lib/data/projects";
import { formatCurrencyCompact } from "@/lib/format";

export const metadata = { title: "Reports · ZenArch" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function ReportsPage() {
  const [proposals, projects] = await Promise.all([getProposals(), getProjects()]);
  const propSummary = summarizeProposals(proposals);
  const projSummary = summarizeProjects(projects);

  // Pipeline value by proposal status
  const statusOrder: ProposalStatus[] = [
    "DRAFT",
    "SENT",
    "PENDING",
    "APPROVED",
    "ON_HOLD",
    "REJECTED",
  ];
  const pipelineByStatus: NameValue[] = statusOrder
    .map((s) => ({
      name: PROPOSAL_STATUS_LABEL[s],
      value: proposals.filter((p) => p.status === s).reduce((n, p) => n + p.totalFee, 0),
    }))
    .filter((d) => d.value > 0);

  // Projects by status
  const projStatuses: ProjectStatus[] = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
  const projectsByStatus: NameValue[] = projStatuses
    .map((s) => ({
      name: PROJECT_STATUS_LABEL[s],
      value: projects.filter((p) => p.status === s).length,
    }))
    .filter((d) => d.value > 0);

  // Projects by discipline (a project can span several)
  const disciplines: Discipline[] = [
    "ARCHITECTURE",
    "STRUCTURAL",
    "INTERIOR",
    "MEP",
    "PROJECT_MANAGEMENT",
  ];
  const projectsByDiscipline: NameValue[] = disciplines
    .map((d) => ({
      name: DISCIPLINE_LABEL[d],
      value: projects.filter((p) => p.disciplines.includes(d)).length,
    }))
    .filter((d) => d.value > 0);

  // Proposal value by month (createdAt)
  const byMonth = new Map<string, number>();
  for (const p of proposals) {
    const ym = p.createdAt.slice(0, 7); // YYYY-MM
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + p.totalFee);
  }
  const monthlyPipeline: MonthValue[] = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, value]) => {
      const [y, m] = ym.split("-");
      return { month: `${MONTHS[Number(m) - 1]} '${y.slice(2)}`, value };
    });

  const tiles = [
    { label: "Open Pipeline", value: formatCurrencyCompact(propSummary.openValue), hint: `${propSummary.openCount} live proposals` },
    { label: "Won to Date", value: formatCurrencyCompact(propSummary.wonValue), hint: `${propSummary.winRate}% win rate` },
    { label: "Active Projects", value: String(projSummary.active), hint: `${projSummary.atRisk} at risk` },
    { label: "Portfolio Value", value: formatCurrencyCompact(projSummary.portfolioValue), hint: "active contract value" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Reports</h2>
          <p className="text-sm text-muted">
            Practice analytics across proposals and project delivery.
          </p>
        </div>
        <EmailButton subject="ZenArch — Practice Report" attachment="Practice Report.pdf" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="text-sm text-muted">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{t.value}</div>
            <div className="mt-1 text-xs text-faint">{t.hint}</div>
          </Card>
        ))}
      </div>

      <ReportsCharts
        pipelineByStatus={pipelineByStatus}
        projectsByStatus={projectsByStatus}
        projectsByDiscipline={projectsByDiscipline}
        monthlyPipeline={monthlyPipeline}
      />
    </div>
  );
}
