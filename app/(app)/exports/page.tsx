import { Download, Printer, Users, FolderKanban, FileText, ClipboardList, UsersRound, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { getProposals } from "@/lib/data/proposals";
import { getOrders } from "@/lib/data/orders";
import { getTeam } from "@/lib/data/team";
import { getLeaveRequests } from "@/lib/data/leave";

export const metadata = { title: "Data Export · AEC-flow" };

export default async function ExportsPage() {
  const [clients, projects, proposals, orders, team, leave] = await Promise.all([
    getClients(),
    getProjects(),
    getProposals(),
    getOrders(),
    getTeam(),
    getLeaveRequests(),
  ]);

  const datasets = [
    { entity: "clients", label: "Clients", icon: Users, count: clients.length, desc: "Client directory with contacts, type, pipeline & lifetime value." },
    { entity: "projects", label: "Projects", icon: FolderKanban, count: projects.length, desc: "Project register with status, priority, manager and progress." },
    { entity: "proposals", label: "Proposals", icon: FileText, count: proposals.length, desc: "Fee proposals with client, status, revision and total fee." },
    { entity: "orders", label: "Orders", icon: ClipboardList, count: orders.length, desc: "Confirmed engagements with client, service type and fee." },
    { entity: "team", label: "Team", icon: UsersRound, count: team.length, desc: "Studio directory with role, department and contact details." },
    { entity: "leave", label: "Leave", icon: CalendarDays, count: leave.length, desc: "Leave requests with type, status, dates and day counts." },
  ];

  // Entities that also have a printable A4 directory/register at /print/directory/<entity>.
  const PRINTABLE = new Set(["clients", "projects", "proposals", "orders", "team", "leave"]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Data Export</h2>
        <p className="text-sm text-muted">
          Download any dataset as a CSV — current values straight from the database, ready for
          Excel, accounting, or reporting. Most also offer a printable A4 directory (Save as PDF).
        </p>
        <a
          href="/print/overview"
          target="_blank"
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Printer className="h-4 w-4" />
          Practice Overview (PDF)
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {datasets.map((d) => {
          const Icon = d.icon;
          return (
            <Card key={d.entity} className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-fg">{d.label}</h3>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                    {d.count} rows
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{d.desc}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/export/${d.entity}`}
                    download
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </a>
                  {PRINTABLE.has(d.entity) ? (
                    <a
                      href={`/print/directory/${d.entity}`}
                      target="_blank"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </a>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
