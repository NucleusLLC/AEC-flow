import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProjectForm, type ProjectFormValues } from "@/components/projects/project-form";
import { getProject } from "@/lib/data/projects";
import { getClients } from "@/lib/data/clients";
import { getTeam } from "@/lib/data/team";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(id);
  return {
    title: project ? `Edit ${project.name} · AEC-flow` : "Edit Project · AEC-flow",
  };
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const [project, clients, team] = await Promise.all([getProject(id), getClients(), getTeam()]);
  if (!project) notFound();

  // Build the select option lists, ensuring the project's current client and
  // manager are always present (so the prefilled value resolves even if the
  // current manager sits outside the MANAGER/DIRECTOR filter).
  const clientNames = Array.from(new Set([project.clientName, ...clients.map((c) => c.name)]));
  const managers = Array.from(
    new Set([
      project.manager,
      ...team.filter((m) => m.role === "MANAGER" || m.role === "DIRECTOR").map((m) => m.name),
    ]),
  );

  const initial: ProjectFormValues = {
    name: project.name,
    clientName: project.clientName,
    manager: project.manager,
    status: project.status,
    priority: project.priority,
    disciplines: project.disciplines,
    startDate: project.startDate ?? "",
    targetEndDate: project.targetEndDate ?? "",
    value: project.value,
    siteAddress: project.siteAddress ?? "",
    description: project.description ?? "",
    currency: project.currency,
  };

  const backHref = `/projects/${project.id}`;

  return (
    <div className="w-full space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {project.name}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">Edit project</h2>
        <p className="text-sm text-muted">
          <span className="font-mono text-fg">{project.projectNumber}</span> · {project.name}
        </p>
      </div>

      <ProjectForm
        mode="edit"
        projectId={project.id}
        initial={initial}
        clients={clientNames}
        managers={managers}
        backHref={backHref}
      />
    </div>
  );
}
