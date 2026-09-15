"use server";

import { revalidatePath } from "next/cache";
import { createInvitation, revokeInvitation } from "@/lib/data/invitations";
import { requireMemberAdmin } from "@/lib/server/actor";
import type { UserRole } from "@prisma/client";

/**
 * Invitations create accounts that CAN sign in, at a role the inviter chooses, so
 * issuing or revoking one is member administration — the same gate as Settings ›
 * Members & Roles. Before this, any signed-in user could invite someone as ADMIN.
 */
export async function createInviteAction(email: string, role: UserRole) {
  let inviterName: string;
  try {
    inviterName = (await requireMemberAdmin()).name;
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Only an administrator or director can invite members." };
  }
  const res = await createInvitation(email, role, inviterName);
  if (res.ok) revalidatePath("/team");
  return res;
}

export async function revokeInviteAction(id: string) {
  try {
    await requireMemberAdmin();
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Only an administrator or director can revoke invites." };
  }
  await revokeInvitation(id);
  revalidatePath("/team");
  return { ok: true as const };
}
