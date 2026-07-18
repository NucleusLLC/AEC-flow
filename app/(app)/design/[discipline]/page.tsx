import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Printer } from "lucide-react";
import { listDeliverables } from "@/lib/data/design";
import { DeliverableList } from "@/components/design/deliverable-list";
import { DISCIPLINE_LABEL, DISCIPLINE_SLUG, disciplineFromSlug } from "@/lib/design/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ discipline: string }>;
}): Promise<Metadata> {
  const { discipline } = await params;
  const d = disciplineFromSlug(discipline);
  return { title: d ? `${DISCIPLINE_LABEL[d]} · AEC-flow` : "Design · AEC-flow" };
}

export default async function DisciplineRegisterPage({
  params,
}: {
  params: Promise<{ discipline: string }>;
}) {
  const { discipline: slug } = await params;
  const discipline = disciplineFromSlug(slug);
  if (!discipline) notFound();

  const items = await listDeliverables({ discipline });

  return (
    <div className="w-full space-y-6">
      <Link href="/design" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Design Register
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">{DISCIPLINE_LABEL[discipline]}</h2>
          <p className="text-sm text-muted">Drawings &amp; documents for this discipline.</p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <Link
              href={`/print/design/transmittal?discipline=${DISCIPLINE_SLUG[discipline]}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              <Printer className="h-4 w-4" /> Transmittal
            </Link>
          ) : null}
          <Link
            href={`/design/new?discipline=${DISCIPLINE_SLUG[discipline]}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" /> Add deliverable
          </Link>
        </div>
      </div>

      <DeliverableList items={items} />
    </div>
  );
}
