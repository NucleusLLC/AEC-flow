import { ScheduleApp } from "@/components/schedule/schedule-app";
import { getSchedules } from "@/lib/data/schedule-db";
import { getProjectDirectory, getProjects } from "@/lib/data/projects";
import { getClients } from "@/lib/data/clients";

export const metadata = { title: "Schedule · AEC-flow" };

export default async function SchedulePage() {
  // Projects and clients are loaded so "New Schedule" can offer projects that
  // have no programme yet, and create a missing project inline.
  const [schedules, directory, projects, clients] = await Promise.all([
    getSchedules(),
    getProjectDirectory(),
    getProjects(),
    getClients(),
  ]);

  return (
    // PROTECTED SYSTEM — layout/chrome change, approved 2026-08-04.
    //
    // The page-level "Project Schedule" heading and its subtitle are gone: the
    // topbar already says "Schedule" one line above, so the heading was the same
    // word twice and the subtitle explained a picker the user is looking at. The
    // programme itself now starts at the top of the stage. `space-y-6` went with
    // them — with a single child it only preserved the gap the heading used to
    // occupy. Nothing below `ScheduleApp` changed.
    <div className="w-full">
      <ScheduleApp
        schedules={schedules}
        directory={directory}
        projects={projects.map((p) => ({
          id: p.id,
          projectNumber: p.projectNumber,
          projectName: p.name,
          client: p.clientName,
        }))}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
