"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createInvitation, revokeInvitation } from "@/lib/data/invitations";
import type { UserRole } from "@prisma/client";

export async function createInviteAction(email: string, role: UserRole) {
  const session = await getServerSession(authOptions);
  const res = await createInvitation(email, role, session?.user?.name ?? undefined);
  if (res.ok) revalidatePath("/team");
  return res;
}

export async function revokeInviteAction(id: string) {
  await revokeInvitation(id);
  revalidatePath("/team");
  return { ok: true as const };
}
