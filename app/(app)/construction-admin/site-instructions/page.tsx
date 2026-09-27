import Link from "next/link";
import { Plus } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { SiteInstructionLog } from "@/components/construction-admin/site-instruction-log";
import { listSiteInstructions } from "@/lib/data/ca/site-instructions";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Site Instructions · AEC-flow" };

export default async function SiteInstructionsPage() {
  const t = await getServerT();
  const instructions = await listSiteInstructions();
  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Site Instructions")}</h2>
          <p className="text-sm text-muted">{t("Architect/engineer instructions to the contractor — issue, acknowledge and track impact.")}</p>
        </div>
        <Link href="/construction-admin/site-instructions/new" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
          <Plus className="h-4 w-4" />
          {t("New instruction")}
        </Link>
      </div>
      <CaSubNav />
      <SiteInstructionLog instructions={instructions} />
    </div>
  );
}
