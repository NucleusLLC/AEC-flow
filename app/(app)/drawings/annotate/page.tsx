import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnnotationStudio } from "@/components/drawings/annotation-studio";

export const metadata = { title: "Annotate · AEC-flow" };

export default function AnnotatePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Annotate drawing</h2>
          <p className="text-sm text-muted">
            Mark up a drawing with pen, shapes and text — then print or save to PDF at A1–A4.
          </p>
        </div>
        <Link
          href="/drawings"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> Back to drawings
        </Link>
      </div>
      <AnnotationStudio />
    </div>
  );
}
