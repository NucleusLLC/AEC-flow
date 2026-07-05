import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, Plus, FileSpreadsheet, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getProject } from "@/lib/data/projects";
import { getEstimateById } from "@/lib/data/estimates";

export const dynamic = "force-dynamic";

export default async function ProjectEstimatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  // A project's estimate is keyed by the project id (see the estimates workspace).
  const estimate = await getEstimateById(id);
  const hasEstimate = !!estimate;

  return (
    <Card className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-faint">
        <Calculator className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-fg">Estimate</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        {hasEstimate
          ? "This project has a cost estimate. Open it to edit the bill of quantities, autosave, and print or export to PDF."
          : "No estimate yet for this project. Create one to start the bill of quantities — it opens with the project's details filled in."}
      </p>
      <Link
        href={`/estimates?project=${id}`}
        className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
      >
        {hasEstimate ? (
          <>
            <FileSpreadsheet className="h-4 w-4" /> Open estimate
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" /> Create estimate
          </>
        )}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
