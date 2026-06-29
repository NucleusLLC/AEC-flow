import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getRecentActivity, type ActivityEntry } from "@/lib/data/activity";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Activity · AEC-flow" };

// Group entries by calendar day (YYYY-MM-DD) preserving recency order.
function groupByDay(entries: ActivityEntry[]): { day: string; items: ActivityEntry[] }[] {
  const groups: { day: string; items: ActivityEntry[] }[] = [];
  for (const e of entries) {
    const day = e.createdAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }
  return groups;
}

function ActivityRow({ e }: { e: ActivityEntry }) {
  const body = (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
        {e.actorInitials ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-fg">
          <span className="font-medium">{e.actor}</span>{" "}
          <span className="text-muted">{e.action}</span>{" "}
          <span className="text-muted">{e.entityType}</span>{" "}
          <span className="font-medium">{e.entityLabel}</span>
        </div>
        <div className="mt-0.5 text-xs text-faint">{e.at}</div>
      </div>
    </div>
  );

  if (e.href) {
    return (
      <Link href={e.href} className="block transition-colors hover:bg-slate-50">
        {body}
      </Link>
    );
  }
  return body;
}

export default async function ActivityPage() {
  const entries = await getRecentActivity();
  const groups = groupByDay(entries);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Activity</h2>
        <p className="text-sm text-muted">
          A live feed of what&apos;s happening across the practice.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-5 py-12 text-center">
          <ActivityIcon className="h-6 w-6 text-faint" />
          <div className="text-sm font-medium text-fg">No activity yet</div>
          <div className="text-xs text-muted">
            Actions across proposals, clients, projects and meetings will appear here.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.day}>
              <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-faint">
                {formatDate(g.day)}
              </div>
              <Card>
                <div className="divide-y divide-border">
                  {g.items.map((e) => (
                    <ActivityRow key={e.id} e={e} />
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
