"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateProfile, changePassword, type ProfileInput } from "@/lib/data/account";

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

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };
  try {
    await changePassword(userId, currentPassword, newPassword);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not change password." };
  }
}
