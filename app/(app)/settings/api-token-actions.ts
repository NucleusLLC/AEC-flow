"use server";

/**
 * Settings → Integrations → Connected apps: create, list and revoke the API
 * tokens desktop add-ins (M.E.P.flow) use for /api/v1.
 *
 * The same gate as every practice-wide setting (canManagePasswords: ADMIN,
 * DIRECTOR or the founder), re-derived from the database here — the card being
 * hidden on screen is presentation only. A token can read the practice's
 * project list and write estimates, so it is a practice-wide credential.
 */
import { revalidatePath } from "next/cache";
import { requireActor, type Actor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { cleanTokenName } from "@/lib/api-tokens/token";
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  type ApiTokenListItem,
} from "@/lib/data/api-tokens";
import { logActivity } from "@/lib/data/activity";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const FORBIDDEN = "Only an Admin or a Director can change the practice's settings.";

async function admin(): Promise<Actor> {
  const actor = await requireActor();
  if (!canManagePasswords(actor.role, actor.isFounder)) throw new Error(FORBIDDEN);
  return actor;
}

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function listApiTokensAction(): Promise<Result<ApiTokenListItem[]>> {
  try {
    const actor = await admin();
    return { ok: true, data: await listApiTokens(actor.companyId) };
  } catch (e) {
    return fail(e, "Could not load the tokens.");
  }
}

/** Create a token. The plaintext is in this answer and nowhere else, ever. */
export async function createApiTokenAction(
  name: string,
): Promise<Result<{ token: string; tokens: ApiTokenListItem[] }>> {
  try {
    const actor = await admin();
    const clean = cleanTokenName(name);
    if (!clean) return { ok: false, error: "Give the token a name." };
    const { token, item } = await createApiToken(actor.companyId, clean, actor.id);
    await logActivity({
      action: "created",
      entityType: "api_token",
      entityId: item.id,
      // Name and display prefix only: the token itself is never written anywhere.
      meta: { name: clean, prefix: item.prefix },
      userId: actor.id,
    });
    revalidatePath("/settings");
    return { ok: true, data: { token, tokens: await listApiTokens(actor.companyId) } };
  } catch (e) {
    return fail(e, "Could not create the token.");
  }
}

export async function revokeApiTokenAction(id: string): Promise<Result<ApiTokenListItem[]>> {
  try {
    const actor = await admin();
    if (typeof id !== "string" || !id) return { ok: false, error: "Could not revoke the token." };
    const found = await revokeApiToken(actor.companyId, id);
    if (!found) return { ok: false, error: "Could not revoke the token." };
    await logActivity({
      action: "revoked",
      entityType: "api_token",
      entityId: id,
      userId: actor.id,
    });
    revalidatePath("/settings");
    return { ok: true, data: await listApiTokens(actor.companyId) };
  } catch (e) {
    return fail(e, "Could not revoke the token.");
  }
}
