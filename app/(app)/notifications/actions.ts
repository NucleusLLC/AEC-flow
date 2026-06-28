"use server";

import { markAllNotificationsRead } from "@/lib/data/notifications";

export async function markAllReadAction(): Promise<{ ok: boolean }> {
  try {
    await markAllNotificationsRead();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
