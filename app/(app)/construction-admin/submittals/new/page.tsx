import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SubmittalForm } from "@/components/construction-admin/submittal-form";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New Submittal · ZenArch" };

export default async function NewSubmittalPage() {
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/construction-admin/submittals" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Submittals
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New Submittal</h2>
        <p className="text-sm text-muted">Log a submittal; it is saved through the API and added to the register.</p>
      </div>
      <SubmittalForm projects={options} />
    </div>
  );
}
