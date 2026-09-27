import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import { getProject } from "@/lib/data/projects";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import {
  PROJECT_STATUS_LABEL,
  PRIORITY_LABEL,
  DISCIPLINE_LABEL,
  type PhaseStatus,
} from "@/lib/data/projects.types";

const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await getProject(id);
  const t = await getServerT();
  return { title: p ? `${p.projectNumber} — ${p.name}` : t("Project") };
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-medium text-gray-900">{value}</div>
    </div>
  );
}

export default async function ProjectFactSheet({ params }: PageProps) {
  const { id } = await params;
  const [p, practice] = await Promise.all([getProject(id), getPracticeSettings()]);
  if (!p) notFound();
  const firm = await getFirmIdentity();
  const companyName = firm.name;
  const t = await getServerT();

  const dash = (s: string | null) => (s ? formatDate(s) : "—");

  return (
    <PrintSurface backHref={`/projects/${p.id}`} backLabel={t("Back to project")}>
      {/* Letterhead */}
      <DocumentLetterhead
        logo={{ dataUrl: practice.logoDataUrl, position: practice.logo.position, size: practice.logo.size }}
        name={companyName}
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{t("Project Fact Sheet")}</div>
            <div className="mt-1 font-mono text-xs text-gray-600">{p.projectNumber}</div>
          </div>
        }
      />

      <h1 className="mt-5 text-xl font-bold text-gray-900">{p.name}</h1>
      {p.description ? <p className="mt-1 text-gray-700">{p.description}</p> : null}

      {/* Key facts */}
      <div className="mt-5 grid grid-cols-4 gap-4 rounded-md bg-gray-50 px-4 py-3 text-xs print:bg-gray-50">
        <Meta label={t("Client")} value={p.clientName} />
        <Meta label={t("Project Manager")} value={p.manager} />
        <Meta label={t("Status")} value={t(PROJECT_STATUS_LABEL[p.status])} />
        <Meta label={t("Priority")} value={t(PRIORITY_LABEL[p.priority])} />
        <Meta label={t("Contract Value")} value={formatCurrency(p.value, p.currency)} />
        <Meta label={t("Progress")} value={`${p.progressPct}%`} />
        <Meta label={t("Start")} value={dash(p.startDate)} />
        <Meta label={t("Target Completion")} value={dash(p.targetEndDate)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <Meta label={t("Site Address")} value={p.siteAddress || "—"} />
        <Meta
          label={t("Disciplines")}
          value={p.disciplines.length ? p.disciplines.map((d) => t(DISCIPLINE_LABEL[d])).join(", ") : "—"}
        />
      </div>

      {/* Phases */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Phases")}</h2>
      <table className="mt-2 w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-3 font-semibold">{t("Phase")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Discipline")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Status")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("Progress")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Start")}</th>
            <th className="py-2 font-semibold">{t("End")}</th>
          </tr>
        </thead>
        <tbody>
          {p.phases.length ? (
            p.phases.map((ph) => (
              <tr key={ph.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 text-gray-900">{ph.name}</td>
                <td className="py-1.5 pr-3 text-gray-600">{ph.discipline ? t(DISCIPLINE_LABEL[ph.discipline]) : "—"}</td>
                <td className="py-1.5 pr-3 text-gray-600">{t(PHASE_STATUS_LABEL[ph.status])}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-gray-900">{ph.progressPct}%</td>
                <td className="py-1.5 pr-3 text-gray-600">{dash(ph.startDate)}</td>
                <td className="py-1.5 text-gray-600">{dash(ph.endDate)}</td>
              </tr>
            ))
          ) : (
            <tr><td className="py-3 text-gray-400" colSpan={6}>{t("No phases defined.")}</td></tr>
          )}
        </tbody>
      </table>

      {/* Team */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Project Team")}</h2>
      <table className="mt-2 w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-3 font-semibold">{t("Name")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Role")}</th>
            <th className="py-2 font-semibold">{t("Discipline")}</th>
          </tr>
        </thead>
        <tbody>
          {p.team.length ? (
            p.team.map((m, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 text-gray-900">{m.name}</td>
                <td className="py-1.5 pr-3 text-gray-600">{m.role}</td>
                <td className="py-1.5 text-gray-600">{m.discipline ? t(DISCIPLINE_LABEL[m.discipline]) : "—"}</td>
              </tr>
            ))
          ) : (
            <tr><td className="py-3 text-gray-400" colSpan={3}>{t("No team assigned.")}</td></tr>
          )}
        </tbody>
      </table>

      <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {companyName} · {p.projectNumber} · {p.name} · {fmt(t("Generated {date}"), { date: formatDate(new Date()) })}
      </div>
    </PrintSurface>
  );
}
