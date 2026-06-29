import Link from "next/link";
import { Plus, FileDown } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { PunchListView } from "@/components/construction-admin/punch-list-view";
import { listPunchItems } from "@/lib/data/ca/punch-list";

export const metadata = { title: "Punch List · AEC-flow" };

export default async function PunchListPage() {
  const items = await listPunchItems();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Punch List</h2>
          <p className="text-sm text-muted">Snagging and close-out defects — track items through completion and verification.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {items.length > 0 ? (
            <Link href="/print/construction-admin/punch-list/all" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2">
              <FileDown className="h-4 w-4" />
              Export PDF
            </Link>
          ) : null}
          <Link href="/construction-admin/punch-list/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
            <Plus className="h-4 w-4" />
            New Item
          </Link>
        </div>
      </div>
      <CaSubNav />
      <PunchListView items={items} />
    </div>
  );
}
