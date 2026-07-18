import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeliverableForm } from "@/components/design/deliverable-form";
import { getProjects } from "@/lib/data/projects";
import { disciplineFromSlug } from "@/lib/design/types";

export const metadata: Metadata = { title: "New Deliverable · AEC-flow" };

export default async function NewDeliverablePage({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string }>;
}) {
  const [{ discipline }, projects] = await Promise.all([searchParams, getProjects()]);
  const defaultDiscipline = discipline ? disciplineFromSlug(discipline) ?? undefined : undefined;
  const options = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link href="/design" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Design Register
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New Deliverable</h2>
        <p className="text-sm text-muted">Register a drawing or design document. The number must be unique.</p>
      </div>
      <DeliverableForm projects={options} mode="new" defaultDiscipline={defaultDiscipline} />
    </div>
  );
}
