import { ScheduleApp } from "@/components/schedule/schedule-app";
import { getServerT } from "@/lib/i18n/server";
import { getSchedules } from "@/lib/data/schedule-db";
import { getProjectDirectory } from "@/lib/data/projects";

export const metadata = { title: "Schedule · AEC-flow" };

export default async function SchedulePage() {
  const tr = await getServerT();
  const [schedules, directory] = await Promise.all([getSchedules(), getProjectDirectory()]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">{tr("Project Schedule")}</h2>
        <p className="text-sm text-muted">
          {tr("Pick a project to view its programme — phase timelines and dependencies.")}
        </p>
      </div>

      <ScheduleApp schedules={schedules} directory={directory} />
    </div>
  );
}
