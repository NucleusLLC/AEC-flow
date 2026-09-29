"use server";

/**
 * Write the AI synopsis for a permit's Process Summary.
 *
 * Reads the case file through the tenant-scoped data layer (so another
 * practice's permit id reads as not found), and writes in the viewer's UI
 * language. Returns a result rather than throwing, as every permit action does.
 */
import { getBuildingPermit } from "@/lib/data/building-permits";
import { ymd } from "@/lib/building-permits/register";
import type { PermitSynopsis } from "@/lib/building-permits/synopsis";
import { getServerLang } from "@/lib/i18n/server";
import { PermitAiError, writePermitSynopsis } from "@/lib/server/permit-ai";

export type PermitSynopsisResult = { ok: true; synopsis: PermitSynopsis } | { ok: false; error: string };

export async function permitSynopsisAction(permitId: string): Promise<PermitSynopsisResult> {
  try {
    const permit = await getBuildingPermit(permitId);
    if (!permit) return { ok: false, error: "That permit file no longer exists." };
    const synopsis = await writePermitSynopsis(permit, await getServerLang(), ymd(new Date()));
    return { ok: true, synopsis };
  } catch (e) {
    if (e instanceof PermitAiError) return { ok: false, error: e.message };
    console.error("permit synopsis failed", e);
    return { ok: false, error: "The summary could not be written." };
  }
}
