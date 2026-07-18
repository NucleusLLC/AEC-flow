import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeliverableForm } from "@/components/design/deliverable-form";
import { getDeliverable } from "@/lib/data/design";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Edit Deliverable · AEC-flow" };

export default async function EditDeliverablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [item, projects] = await Promise.all([getDeliverable(id), getProjects()]);
  if (!item) notFound();
  const options = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href={`/design/deliverable/${item.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {item.number}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit {item.number}</h2>
      </div>
      <DeliverableForm projects={options} mode="edit" initial={item} />
    </div>
  );
}
