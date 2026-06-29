import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print/print-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { getProposals } from "@/lib/data/proposals";
import { getOrders } from "@/lib/data/orders";
import { getTeam } from "@/lib/data/team";

export const metadata: Metadata = { title: "Practice Overview · AEC-flow" };

const OPEN_PROPOSAL = ["DRAFT", "SENT", "PENDING", "ON_HOLD"];

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, it) => {
    const k = key(it);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-gray-200 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-gray-900">{value}</div>
      {sub ? <div className="text-[11px] text-gray-500">{sub}</div> : null}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, v]) => n + v, 0);
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <table className="mt-2 w-full border-collapse text-[11.5px]">
        <tbody>
          {entries.length ? (
            entries.map(([k, v]) => (
              <tr key={k} className="border-b border-gray-100">
                <td className="py-1 text-gray-700">{k.replace(/_/g, " ")}</td>
                <td className="py-1 text-right tabular-nums text-gray-900">{v}</td>
                <td className="w-12 py-1 text-right tabular-nums text-gray-400">
                  {total ? Math.round((v / total) * 100) : 0}%
                </td>
              </tr>
            ))
          ) : (
            <tr><td className="py-2 text-gray-400">—</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function PracticeOverview() {
  const [clients, projects, proposals, orders, team] = await Promise.all([
    getClients(), getProjects(), getProposals(), getOrders(), getTeam(),
  ]);

  const activeClients = clients.filter((c) => c.status === "ACTIVE").length;
  const prospects = clients.filter((c) => c.status === "PROSPECT").length;

  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const overdue = projects.filter((p) => p.isOverdue).length;
  const avgProgress = projects.length ? Math.round(projects.reduce((n, p) => n + p.progressPct, 0) / projects.length) : 0;

  const openProposals = proposals.filter((p) => OPEN_PROPOSAL.includes(p.status));
  const pipeline = openProposals.reduce((n, p) => n + p.totalFee, 0);
  const won = proposals.filter((p) => p.status === "APPROVED").reduce((n, p) => n + p.totalFee, 0);

  const orderValue = orders.reduce((n, o) => n + o.fee, 0);

  const teamActive = team.filter((t) => t.status === "ACTIVE").length;
  const avgUtil = team.length ? Math.round(team.reduce((n, t) => n + t.utilisation, 0) / team.length) : 0;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`@page { size: A4 portrait; margin: 14mm; } @media print { html, body { background: #fff; } }`}</style>

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link href="/exports" className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Data
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto my-6 w-[210mm] max-w-full bg-white p-[16mm] text-[12px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:w-auto print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4">
          <div>
            <div className="text-2xl font-bold tracking-tight text-gray-900">AEC-flow</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-500">
              Architecture · Engineering · Project Management
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">Practice Overview</div>
            <div className="mt-1 text-xs text-gray-500">{formatDate(new Date())}</div>
          </div>
        </div>

        {/* KPI grid */}
        <div className="mt-5 grid grid-cols-4 gap-3">
          <Kpi label="Clients" value={String(clients.length)} sub={`${activeClients} active · ${prospects} prospect`} />
          <Kpi label="Active Projects" value={String(activeProjects)} sub={`${projects.length} total · ${overdue} overdue`} />
          <Kpi label="Avg Progress" value={`${avgProgress}%`} sub="across all projects" />
          <Kpi label="Team" value={String(team.length)} sub={`${teamActive} active · ${avgUtil}% utilisation`} />
          <Kpi label="Open Proposals" value={String(openProposals.length)} sub={`${proposals.length} total`} />
          <Kpi label="Pipeline Value" value={formatCurrency(pipeline, "AED")} sub="open proposals" />
          <Kpi label="Won Value" value={formatCurrency(won, "AED")} sub="approved proposals" />
          <Kpi label="Order Book" value={formatCurrency(orderValue, "AED")} sub={`${orders.length} orders`} />
        </div>

        {/* Breakdowns */}
        <div className="mt-7 grid grid-cols-3 gap-8">
          <Breakdown title="Projects by status" data={countBy(projects, (p) => p.status)} />
          <Breakdown title="Proposals by status" data={countBy(proposals, (p) => p.status)} />
          <Breakdown title="Orders by status" data={countBy(orders, (o) => o.status)} />
        </div>

        <div className="mt-7 grid grid-cols-2 gap-8">
          <Breakdown title="Clients by type" data={countBy(clients, (c) => c.type)} />
          <Breakdown title="Team by department" data={countBy(team, (t) => t.department)} />
        </div>

        <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          AEC-flow · Practice Overview · Generated {formatDate(new Date())} · Figures from live data
        </div>
      </div>
    </div>
  );
}
