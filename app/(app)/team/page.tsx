import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TeamView } from "@/components/team/team-view";
import { getTeam, summarizeTeam } from "@/lib/data/team";

export const metadata = { title: "Team · ZenArch" };

export default async function TeamPage() {
  const members = await getTeam();
  const summary = summarizeTeam(members);

  const tiles = [
    { label: "Team Members", value: String(summary.total), hint: `${summary.active} active` },
    { label: "On Leave", value: String(summary.onLeave), hint: "this week" },
    { label: "Avg Utilisation", value: `${summary.avgUtilisation}%`, hint: "across the studio" },
    {
      label: "Over-allocated",
      value: String(summary.overAllocated),
      hint: "above 100% capacity",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Team</h2>
          <p className="text-sm text-muted">
            Staff across disciplines and departments — roles, capacity, and current allocation.
          </p>
        </div>
        <Link
          href="/team/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <UserPlus className="h-4 w-4" />
          Add Member
        </Link>
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

      <TeamView members={members} />
    </div>
  );
}
