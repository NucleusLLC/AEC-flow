"use server";

/**
 * Settings > Practice > Sample files. Each practice installs or removes its
 * OWN sample set. The company comes from the signed-in actor, never from the
 * caller, and the gate is the one the other practice-wide settings use:
 * ADMIN, DIRECTOR or the founder (canManagePasswords).
 */
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { isSampleLang } from "@/lib/samples/build";
import {
  getSampleSetStatus,
  installSampleSet,
  removeSampleSet,
  type InstallResult,
  type RemoveResult,
  type SampleSetStatus,
} from "@/lib/samples/install";

const FORBIDDEN = "Only an Admin or a Director can install or remove the sample files.";

async function actorCompany(): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  try {
    const actor = await requireActor();
    if (!canManagePasswords(actor.role, actor.isFounder)) return { ok: false, error: FORBIDDEN };
    return { ok: true, companyId: actor.companyId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "You must be signed in." };
  }
}

export async function installOwnSampleSetAction(lang: string): Promise<InstallResult> {
  const who = await actorCompany();
  if (!who.ok) return who;
  if (!isSampleLang(lang)) return { ok: false, error: "The sample set comes in English or Spanish." };
  const res = await installSampleSet(who.companyId, lang);
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

export async function removeOwnSampleSetAction(): Promise<RemoveResult> {
  const who = await actorCompany();
  if (!who.ok) return who;
  const res = await removeSampleSet(who.companyId);
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

export async function getOwnSampleSetStatusAction(): Promise<SampleSetStatus> {
  const who = await actorCompany();
  if (!who.ok) return { installed: false };
  return getSampleSetStatus(who.companyId);
}
