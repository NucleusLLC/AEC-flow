import Link from "next/link";
import { Plus } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { SubmittalLog } from "@/components/construction-admin/submittal-log";
import { listSubmittals } from "@/lib/data/ca/submittals";

export const metadata = { title: "Submittals · AEC-flow" };

export default async function SubmittalsPage() {
  const submittals = await listSubmittals();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Submittal Log</h2>
          <p className="text-sm text-muted">Shop drawings, product data and samples — track each through submission and review.</p>
        </div>
        <Link href="/construction-admin/submittals/new" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
          <Plus className="h-4 w-4" />
          New submittal
        </Link>
      </div>
      <CaSubNav />
      <SubmittalLog submittals={submittals} />
    </div>
  );
}
