import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteInstructionForm } from "@/components/construction-admin/site-instruction-form";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New Site Instruction · AEC-flow" };

export default async function NewSiteInstructionPage() {
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="w-full space-y-6">
      <Link href="/construction-admin/site-instructions" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Site Instructions
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New Site Instruction</h2>
        <p className="text-sm text-muted">Issue an instruction to the contractor; it is saved through the API and added to the register.</p>
      </div>
      <SiteInstructionForm projects={options} />
    </div>
  );
}
