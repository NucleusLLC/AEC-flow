import { AppShell } from "@/components/shell/app-shell";
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
    <>
      {/* …and on the client, before anything formats money. */}
      <SystemCurrencyInit currency={systemCurrency} />
      {/* Shell owns the collapsible "full screen" sidebar state (sidebar + topbar). */}
      <AppShell notifications={notifications} version={appVersionLabel()}>
        {children}
      </AppShell>
      {/* Global ⌘K / Ctrl+K command palette (renders null until opened). */}
      <CommandPalette />
      {/* Floating BETA-Report widget — Bug/Wish feedback with optional screenshot. */}
      <BetaReportWidget />
    </>
  );
}
