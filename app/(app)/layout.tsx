import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { BetaReportWidget } from "@/components/beta-report/beta-report-widget";
import { SystemCurrencyInit } from "@/components/shell/system-currency-init";
import { getNotificationsForCurrentUser } from "@/lib/data/notifications";
import { getSystemCurrency } from "@/lib/server/practice-config";
import { setSystemCurrency } from "@/lib/format";
import { appVersionLabel } from "@/lib/version";

// Every route in this group is auth-gated and reads per-request data (the
// session, project/DB-backed lists), so it must render on-demand. Forcing the
// segment dynamic stops `next build` from statically prerendering these pages —
// which otherwise fails when the database is unreachable (e.g. paused Supabase).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [notifications, systemCurrency] = await Promise.all([
    getNotificationsForCurrentUser(),
    getSystemCurrency(),
  ]);
  // Seed the System Currency for server-rendered formatting this request…
  setSystemCurrency(systemCurrency);
  return (
    <div className="flex h-full">
      {/* …and on the client, before anything formats money. */}
      <SystemCurrencyInit currency={systemCurrency} />
      <Sidebar version={appVersionLabel()} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar reads useSearchParams (search prefill) — needs a Suspense
            boundary so static prerendering doesn't bail the build. */}
        <Suspense fallback={<div className="h-16 shrink-0 border-b border-border bg-surface" />}>
          <Topbar notifications={notifications} />
        </Suspense>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
      {/* Global ⌘K / Ctrl+K command palette (renders null until opened). */}
      <CommandPalette />
      {/* Floating BETA-Report widget — Bug/Wish feedback with optional screenshot. */}
      <BetaReportWidget />
    </div>
  );
}
