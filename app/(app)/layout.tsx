import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { CommandPalette } from "@/components/shell/command-palette";
import { BetaReportWidget } from "@/components/beta-report/beta-report-widget";
import { SystemCurrencyInit } from "@/components/shell/system-currency-init";
import { FirmIdentityInit } from "@/components/shell/firm-identity-init";
import { getNotificationsForCurrentUser } from "@/lib/data/notifications";
import { getSystemCurrency } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { getCurrentCompany, isLicenseExpired } from "@/lib/server/tenant";
import { checkCompanyLicense } from "@/lib/server/license";
import { isCurrentUserFounder } from "@/lib/server/founder";
import { setSystemCurrency } from "@/lib/format";
import { appVersionLabel } from "@/lib/version";
import { MODULE_COOKIE } from "@/lib/modules";

// Every route in this group is auth-gated and reads per-request data (the
// session, project/DB-backed lists), so it must render on-demand. Forcing the
// segment dynamic stops `next build` from statically prerendering these pages —
// which otherwise fails when the database is unreachable (e.g. paused Supabase).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // License gate: a company whose access window has lapsed is bounced to the
  // renewal page (founder companies never expire).
  const company = await getCurrentCompany();
  if (isLicenseExpired(company)) redirect("/expired");

  // Nucleus licence check — OBSERVE-ONLY. It records the outcome against the company (at most
  // once an hour) so the Nucleus beta board shows real activity, but `denied` is hard-wired to
  // false until NUCLEUS_ENFORCE=true, so this cannot lock anyone out today. The redirect is
  // wired now so switching on enforcement is one env var, not a code change.
  // Awaited deliberately: it must forward the tester's real IP from this request (see the
  // x-client-ip contract in lib/server/license.ts), and it fails soft on every path.
  if (company) {
    const hdrs = await headers();
    const clientIp =
      hdrs.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const licence = await checkCompanyLicense({
      companyId: company.id,
      clientIp,
      userAgent: hdrs.get("user-agent"),
    });
    if (licence.denied) redirect("/expired");
  }

  const [notifications, systemCurrency, isFounder, cookieStore, firm] = await Promise.all([
    getNotificationsForCurrentUser(),
    getSystemCurrency(),
    isCurrentUserFounder(),
    cookies(),
    getFirmIdentity(),
  ]);
  // Seed the System Currency for server-rendered formatting this request…
  setSystemCurrency(systemCurrency);
  // Active module persisted client-side; drives the sidebar nav on first paint.
  const initialModule = cookieStore.get(MODULE_COOKIE)?.value;
  return (
    <>
      {/* …and on the client, before anything formats money. */}
      <SystemCurrencyInit currency={systemCurrency} />
      {/* Seeds the practice's own name/location for in-app document previews, so a
       * preview shows the same firm identity the printed document will carry. */}
      <FirmIdentityInit name={firm.name} location={firm.location} />
      {/* Shell owns the collapsible "full screen" sidebar state (sidebar + topbar). */}
      <AppShell notifications={notifications} version={appVersionLabel()} isFounder={isFounder} initialModule={initialModule}>
        {children}
      </AppShell>
      {/* Global ⌘K / Ctrl+K command palette (renders null until opened). */}
      <CommandPalette />
      {/* Floating BETA-Report widget — Bug/Wish feedback with optional screenshot. */}
      <BetaReportWidget />
    </>
  );
}
