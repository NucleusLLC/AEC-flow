"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isCurrentUserFounder } from "@/lib/server/founder";
import {
  getAnthropicApiKey,
  getAnthropicKeyStatus,
  setAnthropicApiKey,
  type AnthropicKeyStatus,
} from "@/lib/server/ai-config";
import { saveUserPreferences } from "@/lib/data/preferences";
import {
  savePracticeProfile,
  saveLogo,
  removeLogo,
  saveSystemCurrency,
  saveFooter,
  saveLogoSettings,
  saveDocumentFontId,
  type FooterSettings,
  type LogoSettings,
} from "@/lib/server/practice-config";
import {
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  type TemplateInput,
} from "@/lib/data/proposal-templates";
import { setMemberRole, setMemberStatus, createTeamMember } from "@/lib/data/team";
import { setMemberPassword } from "@/lib/server/password";
import { requireMemberAdmin } from "@/lib/server/actor";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { Preferences, PracticeProfile, ProposalTemplate } from "@/lib/data/settings";
import type { UserRole, UserStatus, Department } from "@/lib/data/team.types";

/** Standard result shape for the settings mutations below. */
export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/** All org-wide settings require a signed-in user (mirrors preferences gating). */
async function requireUser(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export type KeyActionResult =
  | { ok: true; status: AnthropicKeyStatus }
  | { ok: false; error: string };

export type PrefActionResult = { ok: true } | { ok: false; error: string };

/** Persist the signed-in user's preferences to their User.preferences blob. */
export async function savePreferencesAction(prefs: Preferences): Promise<PrefActionResult> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in to save your preferences." };
  try {
    await saveUserPreferences(userId, prefs);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save preferences." };
  }
}

/* ------------------------------------------------------------------ */
/* Practice profile + logo                                            */
/* ------------------------------------------------------------------ */

export async function savePracticeProfileAction(profile: PracticeProfile): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to save the practice profile." };
  try {
    await savePracticeProfile(profile);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to save the practice profile.");
  }
}

export async function saveLogoAction(dataUrl: string): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to upload a logo." };
  try {
    await saveLogo(dataUrl);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to upload the logo.");
  }
}

export async function removeLogoAction(): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to manage the logo." };
  try {
    await removeLogo();
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to remove the logo.");
  }
}

export async function saveLogoSettingsAction(logo: LogoSettings): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to change the logo settings." };
  try {
    await saveLogoSettings(logo);
    revalidatePath("/", "layout"); // every document reads the logo placement
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to save the logo settings.");
  }
}

export async function saveSystemCurrencyAction(currency: string): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to change the system currency." };
  try {
    await saveSystemCurrency(currency);
    revalidatePath("/", "layout"); // every module reads the system currency
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to save the system currency.");
  }
}

export async function saveFooterAction(footer: FooterSettings): Promise<ActionResult> {
  // The footer is app-level advertising — only the founder may change it.
  if (!(await isCurrentUserFounder())) {
    return { ok: false, error: "Only the AEC-flow founder can change the footer." };
  }
  try {
    await saveFooter(footer);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to save the footer.");
  }
}

/* ------------------------------------------------------------------ */
/* Document Control                                                   */
/* ------------------------------------------------------------------ */

/**
 * Document typeface. Unlike the footer (founder-only, app-level advertising),
 * this is the company's own document branding, so any signed-in user who may
 * save settings can change it. `saveDocumentFontId` validates against the font
 * catalog and throws on anything unselectable, which is what stops an
 * unlicensed or renderer-unsupported face from ever being stored.
 */
export async function saveDocumentFontAction(fontId: string): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to change the document font." };
  try {
    await saveDocumentFontId(fontId);
    // Documents render outside this route, so revalidate the whole tree — the
    // print surfaces must pick the new face up immediately, not on next deploy.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to save the document font.");
  }
}

/* ------------------------------------------------------------------ */
/* Proposal templates                                                 */
/* ------------------------------------------------------------------ */

export async function createTemplateAction(input: TemplateInput): Promise<ActionResult<ProposalTemplate>> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to manage templates." };
  try {
    const data = await createTemplate(input);
    revalidatePath("/settings");
    return { ok: true, data };
  } catch (e) {
    return fail(e, "Failed to create the template.");
  }
}

export async function updateTemplateAction(id: string, input: TemplateInput): Promise<ActionResult<ProposalTemplate>> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to manage templates." };
  try {
    const data = await updateTemplate(id, input);
    revalidatePath("/settings");
    return { ok: true, data };
  } catch (e) {
    return fail(e, "Failed to update the template.");
  }
}

export async function duplicateTemplateAction(id: string): Promise<ActionResult<ProposalTemplate>> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to manage templates." };
  try {
    const data = await duplicateTemplate(id);
    revalidatePath("/settings");
    return { ok: true, data };
  } catch (e) {
    return fail(e, "Failed to duplicate the template.");
  }
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to manage templates." };
  try {
    await deleteTemplate(id);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to delete the template.");
  }
}

export async function setDefaultTemplateAction(id: string): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to manage templates." };
  try {
    await setDefaultTemplate(id);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to set the default template.");
  }
}

/* ------------------------------------------------------------------ */
/* Members & roles                                                    */
/* ------------------------------------------------------------------ */

export async function setMemberRoleAction(id: string, role: UserRole): Promise<ActionResult> {
  try {
    // Was `requireUser()` — i.e. "is anyone signed in". That let any account,
    // a VIEWER included, promote itself to ADMIN, which made every other
    // administrative gate (including password reset) reachable in two steps.
    await requireMemberAdmin();
    await setMemberRole(id, role);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to update the member role.");
  }
}

export async function setMemberStatusAction(id: string, status: UserStatus): Promise<ActionResult> {
  try {
    // Deactivating a colleague is an administrative act; same gate as the rest.
    await requireMemberAdmin();
    await setMemberStatus(id, status);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to update the member status.");
  }
}

export type InviteMemberInput = {
  name: string;
  email: string;
  role: UserRole;
  department: Department | null;
};

export async function inviteMemberAction(input: InviteMemberInput): Promise<ActionResult<{ id: string }>> {
  // Gated because this creates a user AT A CHOSEN ROLE — ungated it is the same
  // escalation as setMemberRoleAction, just via a new account instead of your own.
  try {
    await requireMemberAdmin();
  } catch (e) {
    return fail(e, "Only an administrator or director can invite members.");
  }
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A valid email is required." };
  try {
    const id = await createTeamMember({
      name,
      email,
      phone: null,
      role: input.role,
      discipline: null,
      department: input.department ?? "ADMIN",
      status: "ACTIVE",
      officeLocation: null,
      capacity: 100,
    });
    revalidatePath("/settings");
    return { ok: true, data: { id } };
  } catch (e) {
    // Most likely a unique-email collision.
    return fail(e, "Failed to invite the member — the email may already be in use.");
  }
}

/* ------------------------------------------------------------------ */
/* Member passwords                                                    */
/* ------------------------------------------------------------------ */

/**
 * Set a new password for another member of the caller's own company — the answer
 * to "somebody forgot their password", and the only way an invited user who has no
 * password yet ever gets one.
 *
 * The role gate (ADMIN / DIRECTOR / founder) and the company scope are BOTH
 * enforced inside `setMemberPassword`, against the actor's database row — not by
 * the `canManagePasswords` prop that hides the button in the UI. Returns ok/error
 * only: no hash and no password ever crosses back to the client.
 */
export async function setMemberPasswordAction(
  memberId: string,
  newPassword: string,
): Promise<ActionResult> {
  try {
    const target = await setMemberPassword(memberId, newPassword);
    const actorId = await getActivityActorId();
    if (actorId) {
      // Audit: which administrator reset which member's password, and when. The
      // value is never recorded — `label` is the member's name, nothing more.
      await logActivity({
        userId: actorId,
        action: "set the password for",
        entityType: "user",
        entityId: target.id,
        meta: { label: target.name },
      });
    }
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to set the member's password.");
  }
}

/** Save (or, with an empty string, clear) the Anthropic API key. */
export async function saveAnthropicApiKeyAction(key: string): Promise<KeyActionResult> {
  try {
    await setAnthropicApiKey(key);
    revalidatePath("/settings");
    return { ok: true, status: await getAnthropicKeyStatus() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save the key." };
  }
}

export async function clearAnthropicApiKeyAction(): Promise<KeyActionResult> {
  return saveAnthropicApiKeyAction("");
}

/** Make a tiny live call to confirm the active key authenticates. */
export async function testAnthropicKeyAction(): Promise<{ ok: boolean; message: string }> {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) return { ok: false, message: "No API key configured yet." };
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8,
      messages: [{ role: "user", content: "ping" }],
    });
    return { ok: true, message: "Key works — Claude responded." };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, message: "Authentication failed — the key was rejected." };
    const msg = e instanceof Anthropic.APIError ? `Request failed (${e.status ?? "?"}): ${e.message}` : e instanceof Error ? e.message : "Test failed.";
    return { ok: false, message: msg };
  }
}
