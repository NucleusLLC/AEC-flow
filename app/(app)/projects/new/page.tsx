import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectForm } from "@/components/projects/project-form";
import { getClients } from "@/lib/data/clients";
import { getTeam } from "@/lib/data/team";

export const metadata = { title: "New Project · AEC-flow" };

export default async function NewProjectPage() {
  const [clients, team] = await Promise.all([getClients(), getTeam()]);
  const clientNames = clients.map((c) => c.name);
  const managers = team
    .filter((m) => m.role === "MANAGER" || m.role === "DIRECTOR")
    .map((m) => m.name);

  return (
    <div className="w-full space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Projects
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">New Project</h2>
        <p className="text-sm text-muted">Set up a delivery project and assign a manager and disciplines.</p>
      </div>

      <ProjectForm clients={clientNames} managers={managers} />
    </div>
  );
}
