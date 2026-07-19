import Link from "next/link";
import { Plus, Boxes, CircleCheck, Clock, CircleDollarSign, Printer, PackagePlus } from "lucide-react";
import { listMaterialSelections, materialsSummary } from "@/lib/data/materials";
import { MaterialList } from "@/components/materials/material-list";
import { ProjectFilterBanner } from "@/components/projects/project-filter-banner";
import { getProject } from "@/lib/data/projects";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Material Selection · AEC-flow" };

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const proj = project ? await getProject(project) : null;
  const items = await listMaterialSelections(proj ? project : undefined);
  const summary = proj ? null : await materialsSummary();
  const money = (n: number) => formatCurrency(n, summary?.currency ?? "USD", { maximumFractionDigits: 0 });
  const orderable = items.filter((m) => m.status === "APPROVED" && !m.purchaseOrderId).length;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Material Selection</h2>
          <p className="text-sm text-muted">The finish &amp; product schedule — track selections from proposal to install.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {orderable > 0 ? (
            <Link
              href="/procurement/from-selections"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              <PackagePlus className="h-4 w-4" /> Create PO from approved ({orderable})
            </Link>
          ) : null}
          {items.length > 0 ? (
            <Link
              href="/print/materials"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              <Printer className="h-4 w-4" /> Print schedule
            </Link>
          ) : null}
          <Link
            href="/materials/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            Add selection
          </Link>
        </div>
      </div>

      {proj ? (
        <ProjectFilterBanner projectName={proj.name} clearHref="/materials" />
      ) : summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={Boxes} label="Selections" value={String(summary.total)} />
          <Tile icon={Clock} label="Pending" value={String(summary.pending)} />
          <Tile icon={CircleCheck} label="Approved+" value={String(summary.approved)} />
          <Tile icon={CircleDollarSign} label="Selected value" value={money(summary.selectedValue)} />
        </div>
      ) : null}

      <MaterialList items={items} />
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}
