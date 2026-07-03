"use server";

import { acceptInvitation } from "@/lib/data/invitations";

export async function acceptInviteAction(token: string, name: string, password: string) {
  return acceptInvitation(token, name, password);
}
