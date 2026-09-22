import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { needsVerification } from "@/lib/account-security/verification-token";
import { VerifyEmailBanner } from "@/components/account/verify-email-banner";
import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import { AppBackdrop } from "@/components/shell/app-backdrop";
import { getUserPreferences } from "@/lib/data/preferences";
import { pickDashboardBackgroundIndex } from "@/lib/dashboard/backgrounds";
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

  const [notifications, systemCurrency, isFounder, cookieStore, firm, session] = await Promise.all([
    getNotificationsForCurrentUser(),
    getSystemCurrency(),
    isCurrentUserFounder(),
    cookies(),
    getFirmIdentity(),
    getServerSession(authOptions),
  ]);

  // Photo background, opt-in per user. It lives HERE rather than on the dashboard
  // page because the dashboard is not where most people are: with module 1, 2 or 3
  // active the sidebar has no /dashboard link at all, so a feature wired only to
  // that route is invisible to anyone but a Complete-AEC user. Off (the default)
  // means `children` is returned untouched — no wrapper, no attribute, no rotation.
  const { dashboardBackground, dashboardBackgroundIntervalSeconds, dashboardCardOpacityPercent } =
    await getUserPreferences(session?.user?.id);
  const content = dashboardBackground ? (
    <AppBackdrop
      initialIndex={pickDashboardBackgroundIndex(session?.user?.id)}
      intervalSeconds={dashboardBackgroundIntervalSeconds}
      cardOpacityPercent={dashboardCardOpacityPercent}
    >
      {children}
    </AppBackdrop>
  ) : (
    children
  );
  // Who still has to confirm their address. One small query, and only when there
  // is a session to ask about.
  const me = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, emailVerifiedAt: true, status: true },
      })
    : null;
  const unverifiedEmail = me && needsVerification(me) ? me.email : null;

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
      <FirmIdentityInit name={firm.name} location={firm.location} logo={firm.logo} />
      {/* Shell owns the collapsible "full screen" sidebar state (sidebar + topbar). */}
      <AppShell notifications={notifications} version={appVersionLabel()} isFounder={isFounder} initialModule={initialModule}>
        {/* Asks the signed-in user to confirm their address, and stops rendering
         * the moment they have. Every account that existed before verification
         * shipped was backfilled as confirmed, so this is only ever seen by
         * someone who signed up after it. */}
        {unverifiedEmail ? <VerifyEmailBanner email={unverifiedEmail} /> : null}
        {content}
      </AppShell>
      {/* Global ⌘K / Ctrl+K command palette (renders null until opened). */}
      <CommandPalette />
      {/* Floating BETA-Report widget — Bug/Wish feedback with optional screenshot. */}
      <BetaReportWidget />
    </>
  );
}
