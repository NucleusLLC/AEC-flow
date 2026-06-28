import Link from "next/link";
import { Plus } from "lucide-react";
import { CaSubNav } from "@/components/construction-admin/sub-nav";
import { DelayNoticeLog } from "@/components/construction-admin/delay-notice-log";
import { listDelayNotices } from "@/lib/data/ca/delay-notices";

export const metadata = { title: "Delay Notices · ZenArch" };

export default async function DelayNoticesPage() {
  const notices = await listDelayNotices();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Delay Notices</h2>
          <p className="text-sm text-muted">Notices of delay and extension-of-time claims — log, review and certify approved days.</p>
        </div>
        <Link href="/construction-admin/delay-notices/new" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90">
          <Plus className="h-4 w-4" />
          New delay notice
        </Link>
      </div>
      <CaSubNav />
      <DelayNoticeLog notices={notices} />
    </div>
  );
}
