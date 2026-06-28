"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  if (!(await requireUser())) return { ok: false, error: "Sign in to change the footer." };
  try {
    await saveFooter(footer);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to save the footer.");
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
  if (!(await requireUser())) return { ok: false, error: "Sign in to manage members." };
  try {
    await setMemberRole(id, role);
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e, "Failed to update the member role.");
  }
}

export async function setMemberStatusAction(id: string, status: UserStatus): Promise<ActionResult> {
  if (!(await requireUser())) return { ok: false, error: "Sign in to manage members." };
  try {
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
  if (!(await requireUser())) return { ok: false, error: "Sign in to invite members." };
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
