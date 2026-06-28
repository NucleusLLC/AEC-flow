import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PunchForm } from "@/components/construction-admin/punch-form";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New Punch Item · ZenArch" };

export default async function NewPunchItemPage() {
  const projects = await getProjects();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/construction-admin/punch-list" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Punch List
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New Punch List Item</h2>
        <p className="text-sm text-muted">Log a defect or outstanding item; it is saved through the API and added to the list.</p>
      </div>
      <PunchForm projects={options} />
    </div>
  );
}
