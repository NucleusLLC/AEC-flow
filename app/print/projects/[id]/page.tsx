import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print/print-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { getProject } from "@/lib/data/projects";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getFirmIdentity } from "@/lib/server/firm";
import { PageRules } from "@/components/print/page-rules";
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
  return { title: p ? `${p.projectNumber} — ${p.name}` : "Project" };
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

  const dash = (s: string | null) => (s ? formatDate(s) : "—");

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <PageRules margins={{ top: 14, right: 14, bottom: 14, left: 14 }} />

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link href={`/projects/${p.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto my-6 w-[210mm] max-w-full bg-white p-[16mm] text-[12px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:w-auto print:p-0 print:shadow-none">
        {/* Letterhead */}
        <DocumentLetterhead
          logo={{ dataUrl: practice.logoDataUrl, position: practice.logo.position, size: practice.logo.size }}
          name={companyName}
          borderClass="border-b-2 border-gray-900 pb-4"
          details={
            <div className="text-right">
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">Project Fact Sheet</div>
              <div className="mt-1 font-mono text-xs text-gray-600">{p.projectNumber}</div>
            </div>
          }
        />

        <h1 className="mt-5 text-xl font-bold text-gray-900">{p.name}</h1>
        {p.description ? <p className="mt-1 text-gray-700">{p.description}</p> : null}

        {/* Key facts */}
        <div className="mt-5 grid grid-cols-4 gap-4 rounded-md bg-gray-50 px-4 py-3 text-xs print:bg-gray-50">
          <Meta label="Client" value={p.clientName} />
          <Meta label="Project Manager" value={p.manager} />
          <Meta label="Status" value={PROJECT_STATUS_LABEL[p.status]} />
          <Meta label="Priority" value={PRIORITY_LABEL[p.priority]} />
          <Meta label="Contract Value" value={formatCurrency(p.value, p.currency)} />
          <Meta label="Progress" value={`${p.progressPct}%`} />
          <Meta label="Start" value={dash(p.startDate)} />
          <Meta label="Target Completion" value={dash(p.targetEndDate)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <Meta label="Site Address" value={p.siteAddress || "—"} />
          <Meta
            label="Disciplines"
            value={p.disciplines.length ? p.disciplines.map((d) => DISCIPLINE_LABEL[d]).join(", ") : "—"}
          />
        </div>

        {/* Phases */}
        <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Phases</h2>
        <table className="mt-2 w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-3 font-semibold">Phase</th>
              <th className="py-2 pr-3 font-semibold">Discipline</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 text-right font-semibold">Progress</th>
              <th className="py-2 pr-3 font-semibold">Start</th>
              <th className="py-2 font-semibold">End</th>
            </tr>
          </thead>
          <tbody>
            {p.phases.length ? (
              p.phases.map((ph) => (
                <tr key={ph.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 text-gray-900">{ph.name}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{ph.discipline ? DISCIPLINE_LABEL[ph.discipline] : "—"}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{PHASE_STATUS_LABEL[ph.status]}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-900">{ph.progressPct}%</td>
                  <td className="py-1.5 pr-3 text-gray-600">{dash(ph.startDate)}</td>
                  <td className="py-1.5 text-gray-600">{dash(ph.endDate)}</td>
                </tr>
              ))
            ) : (
              <tr><td className="py-3 text-gray-400" colSpan={6}>No phases defined.</td></tr>
            )}
          </tbody>
        </table>

        {/* Team */}
        <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Project Team</h2>
        <table className="mt-2 w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-3 font-semibold">Name</th>
              <th className="py-2 pr-3 font-semibold">Role</th>
              <th className="py-2 font-semibold">Discipline</th>
            </tr>
          </thead>
          <tbody>
            {p.team.length ? (
              p.team.map((m, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 text-gray-900">{m.name}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{m.role}</td>
                  <td className="py-1.5 text-gray-600">{m.discipline ? DISCIPLINE_LABEL[m.discipline] : "—"}</td>
                </tr>
              ))
            ) : (
              <tr><td className="py-3 text-gray-400" colSpan={3}>No team assigned.</td></tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          {companyName} · {p.projectNumber} · {p.name} · Generated {formatDate(new Date())}
        </div>
      </div>
    </div>
  );
}
