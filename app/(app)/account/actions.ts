"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateProfile, type ProfileInput } from "@/lib/data/account";
import { changeOwnPassword } from "@/lib/server/password";
import { logActivity } from "@/lib/data/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };
  if (!input.name?.trim()) return { ok: false, error: "Name is required." };
  try {
    await updateProfile(userId, input);
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update profile." };
  }
}

/**
 * Change the signed-in user's own password.
 *
 * Every check that matters happens in `changeOwnPassword` (server): the current
 * password is verified there with `bcrypt.compare`, and the policy is re-applied
 * there. This action takes no "verified" flag from the client and returns nothing
 * but ok/error — never a hash, never the password.
 */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  try {
    const self = await changeOwnPassword(currentPassword, newPassword);
    // Audit: who, whose, when. The value is never recorded.
    await logActivity({
      userId: self.id,
      action: "changed their own password",
      entityType: "user",
      entityId: self.id,
      meta: { label: self.name },
    });
    revalidatePath("/account");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not change password." };
  }
}
