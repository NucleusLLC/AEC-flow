import Link from "next/link";
import { Plus } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { DelayNoticeLog } from "@/components/construction-admin/delay-notice-log";
import { listDelayNotices } from "@/lib/data/ca/delay-notices";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Delay Notices · AEC-flow" };

export default async function DelayNoticesPage() {
  const t = await getServerT();
  const notices = await listDelayNotices();
  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Delay Notices")}</h2>
          <p className="text-sm text-muted">{t("Notices of delay and extension-of-time claims — log, review and certify approved days.")}</p>
        </div>
        <Link href="/construction-admin/delay-notices/new" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
          <Plus className="h-4 w-4" />
          {t("New delay notice")}
        </Link>
      </div>
      <CaSubNav />
      <DelayNoticeLog notices={notices} />
    </div>
  );
}
