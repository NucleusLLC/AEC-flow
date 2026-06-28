import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import { DevTabBar } from "@/components/development/dev-tab-bar";
import { DevStatusBadge } from "@/components/development/badges";
import { DevProjectActions } from "@/components/development/project-actions";
import { getDevelopmentProject } from "@/lib/data/development";

type Props = { params: Promise<{ id: string }>; children: React.ReactNode };

export default async function DevelopmentWorkspaceLayout({ params, children }: Props) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link href="/development" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Land Development
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{project.projectNumber}</span>
            <DevStatusBadge status={project.status} />
          </div>
          <h1 className="mt-1 text-xl font-semibold text-fg">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            {project.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{project.location}</span> : null}
            {project.developer ? <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{project.developer}</span> : null}
          </div>
        </div>
        <DevProjectActions projectId={project.id} status={project.status} />
      </div>

      <DevTabBar projectId={project.id} />
      {children}
    </div>
  );
}
