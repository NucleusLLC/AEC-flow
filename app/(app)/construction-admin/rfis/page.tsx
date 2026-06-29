import Link from "next/link";
import { Plus } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { RfiLog } from "@/components/construction-admin/rfi-log";
import { listRfis } from "@/lib/data/ca/rfis";

export const metadata = { title: "RFIs · AEC-flow" };

export default async function RfisPage() {
  const rfis = await listRfis();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">RFI Log</h2>
          <p className="text-sm text-muted">Requests for Information — raise queries and track formal responses.</p>
        </div>
        <Link href="/construction-admin/rfis/new" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
          <Plus className="h-4 w-4" />
          New RFI
        </Link>
      </div>
      <CaSubNav />
      <RfiLog rfis={rfis} />
    </div>
  );
}
