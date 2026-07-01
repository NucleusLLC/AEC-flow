import { PunchClock } from "@/components/widgets/punch-clock";
import { getServerT } from "@/lib/i18n/server";
import { WorldClocks } from "@/components/widgets/world-clocks";
import { KanbanBoard } from "@/components/widgets/kanban-board";

export const metadata = { title: "Widgets · AEC-flow" };

export default async function WidgetsPage() {
  const tr = await getServerT();
  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-fg">{tr("Widgets")}</h2>
        <p className="mt-1 text-sm text-muted">
          {tr("Handy personal tools — punch clock, world clocks, and a quick Kanban board. Saved in your browser.")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PunchClock />
        <WorldClocks />
      </div>

      <KanbanBoard />
    </div>
  );
}
