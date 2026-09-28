import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TeamView } from "@/components/team/team-view";
import { TeamInvites } from "@/components/team/team-invites";
import { getTeam, summarizeTeam } from "@/lib/data/team";
import { getSeatUsage, listInvitations } from "@/lib/data/invitations";
import { requireActor } from "@/lib/server/actor";
import { canChangeMemberAccess } from "@/lib/team/member-write-policy";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const metadata = { title: "Team · AEC-flow" };

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const actor = await requireActor().catch(() => null);
  const t = await getServerT();
  const canInvite = actor ? canChangeMemberAccess(actor) : false;
  const [members, seatUsage, invitations] = await Promise.all([
    getTeam(),
    getSeatUsage(),
    // Pending invites carry their accept TOKENS. Anyone holding one can finish the
    // signup as that invitee — at the invited role, ADMIN included — so they are
    // only ever loaded for member administrators, never merely hidden in the UI.
    canInvite ? listInvitations() : Promise.resolve([]),
  ]);
  const summary = summarizeTeam(members);

  const tiles = [
    { label: t("Team Members"), value: String(summary.total), hint: fmt(t("{count} active"), { count: summary.active }) },
    { label: t("On Leave"), value: String(summary.onLeave), hint: t("this week") },
    { label: t("Avg Utilisation"), value: `${summary.avgUtilisation}%`, hint: t("across the studio") },
    {
      label: t("Over-allocated"),
      value: String(summary.overAllocated),
      hint: t("above 100% capacity"),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Team")}</h2>
          <p className="text-sm text-muted">
            {t("Staff across disciplines and departments — roles, capacity, and current allocation.")}
          </p>
        </div>
        <Link
          href="/team/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <UserPlus className="h-4 w-4" />
          {t("Add Member")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-5">
            <div className="text-sm text-muted">{tile.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{tile.value}</div>
            <div className="mt-1 text-xs text-faint">{tile.hint}</div>
          </Card>
        ))}
      </div>

      <TeamInvites seatUsage={seatUsage} invitations={invitations} canInvite={canInvite} />

      <TeamView members={members} />
    </div>
  );
}
