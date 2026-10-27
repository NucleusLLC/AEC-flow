import { getServerSession } from "next-auth";
import { getServerLang, getServerT } from "@/lib/i18n/server";
import { SettingsView } from "@/components/settings/settings-view";
import { rolesFromMembers, type Member } from "@/lib/data/settings";
import { getUserPreferences } from "@/lib/data/preferences";
import { getInvoiceSettings, getPracticeSettings } from "@/lib/server/practice-config";
import { listTemplates } from "@/lib/data/proposal-templates";
import { getTeam } from "@/lib/data/team";
import { getAnthropicKeyStatus } from "@/lib/server/ai-config";
import { getNarrationStatus } from "@/lib/server/guide-narration";
import { isFounderEmail } from "@/lib/server/founder";
import { canManagePasswords as canManagePasswordsFor } from "@/lib/password-policy";
import { authOptions } from "@/lib/auth";
import { getOnlinePaymentsStatus, type OnlinePaymentsStatus } from "@/lib/data/pay-now";
import { stripeConfig } from "@/lib/payments/stripe";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { isBillingConfigured } from "@/lib/billing/config";
import { getOwnSampleSetStatusAction } from "@/app/(app)/settings/sample-actions";
import { listApiTokens, type ApiTokenListItem } from "@/lib/data/api-tokens";

export async function generateMetadata() {
  const tr = await getServerT();
  return { title: `${tr("Settings")} · AEC-flow` };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stripe?: string }>;
}) {
  const q = await searchParams;
  const tr = await getServerT();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const isFounder = isFounderEmail(session?.user?.email);

  const [practice, templates, team, preferences, keyStatus, narrationStatus, invoiceSettings] = await Promise.all([
    getPracticeSettings(),
    listTemplates(),
    getTeam(),
    getUserPreferences(userId),
    getAnthropicKeyStatus(),
    // Guide narration is a platform setting: only the founder is shown it.
    isFounder ? getNarrationStatus() : Promise.resolve(null),
    getInvoiceSettings(),
  ]);

  // Real User rows projected to the settings Member shape; roles derived from them.
  const members: Member[] = team.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    department: m.department,
    status: m.status,
  }));
  const roles = rolesFromMembers(members);

  // Sample files: this practice's own set (the action takes the company from the
  // session and answers "not installed" for anyone who may not manage it).
  const sampleStatus = await getOwnSampleSetStatusAction();
  const sampleLang = (await getServerLang()) === "es" ? "es" : "en";

  // Whether to DRAW the per-member "Set password" control. Derived from the actor's
  // row in the company-scoped team list rather than from the session token, so a
  // demoted user doesn't keep the button on a stale JWT. This is presentation only —
  // `setMemberPasswordAction` re-derives and enforces the same gate server-side.
  const canManagePasswords = canManagePasswordsFor(
    team.find((m) => m.id === userId)?.role,
    isFounder,
  );

  // Online payments: the practice's Stripe Connect state, from its Company row.
  const companyId = session?.user?.companyId ?? null;
  const onlinePayments: OnlinePaymentsStatus = companyId
    ? await getOnlinePaymentsStatus(companyId)
    : {
        configured: stripeConfig() !== null,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        statusAt: null,
      };

  // Connected-app tokens: only those who may manage them see the list at all.
  const apiTokens: ApiTokenListItem[] =
    canManagePasswords && companyId ? await listApiTokens(companyId) : [];

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">{tr("Settings")}</h2>
          <p className="text-sm text-muted">
            {tr("Manage your practice profile, proposal templates, members, and preferences.")}
          </p>
        </div>
        {/* AEC-flow subscription (D-5). Only once Stripe is configured, only for those who may pay. */}
        {canManagePasswords && isBillingConfigured() ? (
          <Link
            href="/settings/billing"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-fg hover:border-brand"
          >
            <CreditCard className="h-4 w-4 text-brand" aria-hidden="true" /> {tr("Billing")}
          </Link>
        ) : null}
      </div>

      <SettingsView
        profile={practice.profile}
        logoDataUrl={practice.logoDataUrl}
        currency={practice.currency}
        footer={practice.footer}
        logoSettings={practice.logo}
        documentFontId={practice.documentFontId}
        invoiceSettings={invoiceSettings}
        templates={templates}
        members={members}
        roles={roles}
        preferences={preferences}
        keyStatus={keyStatus}
        narrationStatus={narrationStatus}
        canSave={!!userId}
        isFounder={isFounder}
        canManagePasswords={canManagePasswords}
        onlinePayments={onlinePayments}
        apiTokens={apiTokens}
        initialTab={q.tab}
        stripeNotice={q.stripe === "returned" || q.stripe === "error" ? q.stripe : null}
        sampleStatus={sampleStatus}
        sampleLang={sampleLang}
      />
    </div>
  );
}
