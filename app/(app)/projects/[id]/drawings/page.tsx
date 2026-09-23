import Link from "next/link";
import { notFound } from "next/navigation";
import { FileStack, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ProjectDrawingSet } from "@/components/drawings/project-drawing-set";
import { getProject } from "@/lib/data/projects";
import { getProjectDrawings } from "@/lib/data/drawings";

/**
 * The project's own drawing set.
 *
 * WAS A PLACEHOLDER. This tab used to be a card reading "Open Drawings" that
 * sent the user to the global register to find their way back to the project
 * they were already looking at. The register has always been project-keyed;
 * there was never a reason for the round trip.
 */
export default async function ProjectDrawingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const drawings = await getProjectDrawings(id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-fg">Drawings</h3>
          <p className="text-sm text-muted">
            Every sheet issued on this job, by discipline and revision. Open one to mark it up.
          </p>
        </div>
        <Link
          href={`/drawings/intake?project=${id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Upload className="h-4 w-4" /> Add drawings
        </Link>
      </div>

      {drawings.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <FileStack className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-fg">No sheets on this job yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Drop a set and the system reads each sheet&apos;s number, title, plot size and what
              kind of drawing it is before you confirm anything.
            </p>
            <Link
              href={`/drawings/intake?project=${id}`}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Upload className="h-4 w-4" /> Add the first drawings
            </Link>
          </CardBody>
        </Card>
      ) : (
        <ProjectDrawingSet drawings={drawings} />
      )}
    </div>
  );
}
