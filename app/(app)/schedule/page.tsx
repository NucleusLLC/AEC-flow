import { ScheduleApp } from "@/components/schedule/schedule-app";
import { getServerT } from "@/lib/i18n/server";
import { getSchedules } from "@/lib/data/schedule-db";
import { getProjectDirectory, getProjects } from "@/lib/data/projects";
import { getClients } from "@/lib/data/clients";

export const metadata = { title: "Schedule · AEC-flow" };

export default async function SchedulePage() {
  const tr = await getServerT();
  // Projects and clients are loaded so "New Schedule" can offer projects that
  // have no programme yet, and create a missing project inline.
  const [schedules, directory, projects, clients] = await Promise.all([
    getSchedules(),
    getProjectDirectory(),
    getProjects(),
    getClients(),
  ]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">{tr("Project Schedule")}</h2>
        <p className="text-sm text-muted">
          {tr("Pick a project to view its programme — phase timelines and dependencies.")}
        </p>
      </div>

      <ScheduleApp
        schedules={schedules}
        directory={directory}
        projects={projects.map((p) => ({
          projectNumber: p.projectNumber,
          projectName: p.name,
          client: p.clientName,
        }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
