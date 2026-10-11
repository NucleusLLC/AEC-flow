"use server";

/**
 * /admin > Sample files. The founder's push of the sample set to a company.
 *
 * One company per call. The panel walks its list and calls this once for each,
 * so a long run can not outlive a serverless request and every company gets
 * its own result line.
 *
 * Founder only, re-checked here on every call. The founder's own company is
 * refused unless the call says, explicitly, that it is meant.
 */
import { revalidatePath } from "next/cache";
import { isCurrentUserFounder } from "@/lib/server/founder";
import { isSampleLang } from "@/lib/samples/build";
import { installSampleSet, planSampleSet, type InstallResult, type PlanResult } from "@/lib/samples/install";
import { isFounderCompany } from "@/lib/samples/admin";

export type SamplePushResult = PlanResult | InstallResult;

export async function sampleSetForCompanyAction(input: {
  companyId: string;
  lang: string;
  /** "dry" reports what would be created and writes nothing. */
  mode: "dry" | "install";
  /** The founder's own company is skipped unless this is true. */
  allowFounderCompany?: boolean;
  /** A real run must carry the word the confirmation step asks for. */
  confirm?: string;
}): Promise<SamplePushResult> {
  if (!(await isCurrentUserFounder())) return { ok: false, error: "Not authorized." };
  if (!input || typeof input.companyId !== "string" || !input.companyId) return { ok: false, error: "No company." };
  if (!isSampleLang(input.lang)) return { ok: false, error: "The sample set comes in English or Spanish." };
  if (input.mode !== "dry" && input.mode !== "install") return { ok: false, error: "Unknown mode." };

  const founderCompany = await isFounderCompany(input.companyId);
  if (founderCompany === null) return { ok: false, error: "This company does not exist." };
  if (founderCompany && input.allowFounderCompany !== true) {
    return { ok: false, error: "The founder company is skipped unless it is installed there on purpose." };
  }

  if (input.mode === "dry") return planSampleSet(input.companyId, input.lang);

  if (input.confirm !== "INSTALL") return { ok: false, error: "A real run needs the confirmation step." };
  const res = await installSampleSet(input.companyId, input.lang);
  revalidatePath("/admin");
  return res;
}
