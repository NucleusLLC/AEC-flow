import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RfiForm } from "@/components/construction-admin/rfi-form";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New RFI · AEC-flow" };

export default async function NewRfiPage() {
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/construction-admin/rfis" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        RFIs
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New RFI</h2>
        <p className="text-sm text-muted">Raise a request for information; it is saved through the API and added to the log.</p>
      </div>
      <RfiForm projects={options} />
    </div>
  );
}
