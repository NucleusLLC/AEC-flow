import { getServerSession } from "next-auth";
import { getServerT } from "@/lib/i18n/server";
import { SettingsView } from "@/components/settings/settings-view";
import { rolesFromMembers, type Member } from "@/lib/data/settings";
import { getUserPreferences } from "@/lib/data/preferences";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { listTemplates } from "@/lib/data/proposal-templates";
import { getTeam } from "@/lib/data/team";
import { getAnthropicKeyStatus } from "@/lib/server/ai-config";
import { isFounderEmail } from "@/lib/server/founder";
import { canManagePasswords as canManagePasswordsFor } from "@/lib/password-policy";
import { authOptions } from "@/lib/auth";

export const metadata = { title: "Settings · AEC-flow" };

export default async function SettingsPage() {
  const tr = await getServerT();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const isFounder = isFounderEmail(session?.user?.email);

  const [practice, templates, team, preferences, keyStatus] = await Promise.all([
    getPracticeSettings(),
    listTemplates(),
    getTeam(),
    getUserPreferences(userId),
    getAnthropicKeyStatus(),
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

  // Whether to DRAW the per-member "Set password" control. Derived from the actor's
  // row in the company-scoped team list rather than from the session token, so a
  // demoted user doesn't keep the button on a stale JWT. This is presentation only —
  // `setMemberPasswordAction` re-derives and enforces the same gate server-side.
  const canManagePasswords = canManagePasswordsFor(
    team.find((m) => m.id === userId)?.role,
    isFounder,
  );

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">{tr("Settings")}</h2>
        <p className="text-sm text-muted">
          {tr("Manage your practice profile, proposal templates, members, and preferences.")}
        </p>
      </div>

      <SettingsView
        profile={practice.profile}
        logoDataUrl={practice.logoDataUrl}
        currency={practice.currency}
        footer={practice.footer}
        logoSettings={practice.logo}
        documentFontId={practice.documentFontId}
        templates={templates}
        members={members}
        roles={roles}
        preferences={preferences}
        keyStatus={keyStatus}
        canSave={!!userId}
        isFounder={isFounder}
        canManagePasswords={canManagePasswords}
      />
    </div>
  );
}
