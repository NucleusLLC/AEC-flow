"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isCurrentUserFounder } from "@/lib/server/founder";

type Result = { ok: true } | { ok: false; error: string };

const PLANS = ["BETA", "STARTER", "PRO", "ENTERPRISE"];

export async function updateCompanyLicense(input: {
  id: string;
  plan: string;
  seatLimit: number;
  expiresAt: string | null; // "YYYY-MM-DD" or null (never expires)
  modules: string[];
}): Promise<Result> {
  if (!(await isCurrentUserFounder())) return { ok: false, error: "Not authorized." };
  if (!PLANS.includes(input.plan)) return { ok: false, error: "Invalid plan." };

  const seatLimit = Number.isFinite(input.seatLimit) ? Math.max(1, Math.floor(input.seatLimit)) : 5;
  const expiresAt = input.expiresAt ? new Date(`${input.expiresAt}T23:59:59`) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { ok: false, error: "Invalid date." };

  try {
    await prisma.company.update({
      where: { id: input.id },
      data: {
        plan: input.plan as "BETA" | "STARTER" | "PRO" | "ENTERPRISE",
        seatLimit,
        expiresAt,
        modules: input.modules,
      },
    });
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update the license." };
  }
}
