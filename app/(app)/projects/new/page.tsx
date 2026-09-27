import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectForm } from "@/components/projects/project-form";
import { getClients } from "@/lib/data/clients";
import { getTeam } from "@/lib/data/team";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getServerT();
  return { title: `${t("New Project")} · AEC-flow` };
}

export default async function NewProjectPage() {
  const [clients, team] = await Promise.all([getClients(), getTeam()]);
  const t = await getServerT();
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
        {t("Projects")}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">{t("New Project")}</h2>
        <p className="text-sm text-muted">{t("Set up a delivery project and assign a manager and disciplines.")}</p>
      </div>

      <ProjectForm clients={clientNames} managers={managers} />
    </div>
  );
}
