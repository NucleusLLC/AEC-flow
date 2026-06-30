import Link from "next/link";
import {
  Search as SearchIcon,
  Users,
  FolderKanban,
  FileText,
  ClipboardList,
  UsersRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProposalStatusBadge } from "@/components/proposals/badges";
import { OrderStatusBadge } from "@/components/orders/badges";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { getProposals } from "@/lib/data/proposals";
import { getOrders } from "@/lib/data/orders";
import { getTeam } from "@/lib/data/team";
import { formatCurrencyCompact } from "@/lib/format";

export const metadata = { title: "Search · AEC-flow" };

type Result = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
};

type Group = {
  key: string;
  label: string;
  icon: typeof Users;
  results: Result[];
};

function matches(q: string, ...fields: Array<string | null | undefined>): boolean {
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

async function search(q: string): Promise<Group[]> {
  const [clients, projects, proposals, orders, team] = await Promise.all([
    getClients(),
    getProjects(),
    getProposals(),
    getOrders(),
    getTeam(),
  ]);

  const groups: Group[] = [
    {
      key: "clients",
      label: "Clients",
      icon: Users,
      results: clients
        .filter((c) => matches(q, c.name, c.companyName, c.contactPerson, c.email, c.location, ...c.tags))
        .slice(0, 6)
        .map((c) => ({
          id: c.id,
          href: `/clients/${c.id}`,
          title: c.name,
          subtitle: c.companyName ?? c.location,
          badge: <StatusBadge status={c.status} />,
        })),
    },
    {
      key: "projects",
      label: "Projects",
      icon: FolderKanban,
      results: projects
        .filter((p) => matches(q, p.name, p.projectNumber, p.clientName, p.manager))
        .slice(0, 6)
        .map((p) => ({
          id: p.id,
          href: `/projects/${p.id}`,
          title: p.name,
          subtitle: `${p.projectNumber} · ${p.clientName}`,
          badge: <StatusBadge status={p.status} />,
        })),
    },
    {
      key: "proposals",
      label: "Proposals",
      icon: FileText,
      results: proposals
        .filter((p) => matches(q, p.refNumber, p.title, p.clientName, p.owner))
        .slice(0, 6)
        .map((p) => ({
          id: p.id,
          href: `/proposals/${p.id}`,
          title: p.title,
          subtitle: `${p.refNumber} · ${formatCurrencyCompact(p.totalFee, p.currency)}`,
          badge: <ProposalStatusBadge status={p.status} />,
        })),
    },
    {
      key: "orders",
      label: "Orders",
      icon: ClipboardList,
      results: orders
        .filter((o) => matches(q, o.orderNumber, o.title, o.clientName, o.serviceType))
        .slice(0, 6)
        .map((o) => ({
          id: o.id,
          href: `/orders/${o.id}`,
          title: o.title,
          subtitle: `${o.orderNumber} · ${o.serviceType}`,
          badge: <OrderStatusBadge status={o.status} />,
        })),
    },
    {
      key: "team",
      label: "Team",
      icon: UsersRound,
      results: team
        .filter((m) => matches(q, m.name, m.email, m.role, m.discipline))
        .slice(0, 6)
        .map((m) => ({
          id: m.id,
          href: `/team/${m.id}`,
          title: m.name,
          subtitle: m.email,
          badge: <Badge tone="slate">{m.role.toLowerCase()}</Badge>,
        })),
    },
  ];

  return groups.filter((g) => g.results.length > 0);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();
  const groups = q ? await search(q.toLowerCase()) : [];
  const totalResults = groups.reduce((n, g) => n + g.results.length, 0);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Search</h2>
        {q ? (
          <p className="text-sm text-muted">
            {totalResults} result{totalResults === 1 ? "" : "s"} for{" "}
            <span className="font-medium text-fg">&ldquo;{q}&rdquo;</span>
          </p>
        ) : (
          <p className="text-sm text-muted">
            Search across clients, projects, proposals, orders, and team.
          </p>
        )}
      </div>

      {!q ? (
        <Card className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <SearchIcon className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted">Type a query in the search bar above to begin.</p>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <SearchIcon className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-fg">No matches</p>
          <p className="text-xs text-muted">Nothing found for &ldquo;{q}&rdquo;. Try another term.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.key}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Icon className="h-4 w-4 text-faint" />
                  <h3 className="text-sm font-semibold text-fg">{group.label}</h3>
                  <span className="text-xs text-faint">{group.results.length}</span>
                </div>
                <Card className="divide-y divide-border overflow-hidden">
                  {group.results.map((r) => (
                    <Link
                      key={r.id}
                      href={r.href}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-fg">{r.title}</div>
                        <div className="truncate text-xs text-muted">{r.subtitle}</div>
                      </div>
                      {r.badge}
                    </Link>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
