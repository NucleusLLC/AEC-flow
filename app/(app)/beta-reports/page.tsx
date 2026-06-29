import { Bug, Lightbulb, Inbox, MessageSquarePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BetaReportsView } from "@/components/beta-report/beta-reports-view";
import { getBetaReports, summarizeBetaReports } from "@/lib/data/beta-reports";

export const metadata = { title: "Beta Reports · AEC-flow" };

export default async function BetaReportsPage() {
  const reports = await getBetaReports();
  const summary = await summarizeBetaReports(reports);

  const tiles = [
    {
      label: "Total",
      value: String(summary.total),
      hint: "reports received",
      icon: MessageSquarePlus,
      accent: "text-brand",
    },
    {
      label: "Open",
      value: String(summary.open),
      hint: "not yet resolved",
      icon: Inbox,
      accent: "text-amber-600",
    },
    {
      label: "Bugs",
      value: String(summary.bugs),
      hint: "something broken",
      icon: Bug,
      accent: "text-red-600",
    },
    {
      label: "Wishes",
      value: String(summary.wishes),
      hint: "ideas & requests",
      icon: Lightbulb,
      accent: "text-violet-600",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-fg">Beta Reports</h2>
        <p className="mt-1 text-sm text-muted">
          Bug reports and wishes sent by beta testers from the in-app Feedback button.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.label} className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.label}
                </div>
                <Icon className={`h-4 w-4 ${t.accent}`} />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-fg">{t.value}</div>
              <div className="mt-1 text-xs text-faint">{t.hint}</div>
            </Card>
          );
        })}
      </div>

      <BetaReportsView reports={reports} />
    </div>
  );
}
