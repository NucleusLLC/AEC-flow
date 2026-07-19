/**
 * Nucleus LicenseOps bridge (SERVER-ONLY).
 *
 * AEC-Flow is a licensed CLIENT of Nucleus: all entitlement lives there, this app just asks.
 * Mirrors CAD-Flow's backend bridge (CAD-flow/backend/supabase/functions/_shared/license.ts) so
 * the two products present identically to Nucleus.
 *
 * ── Observe-only ──────────────────────────────────────────────────────────────
 * Right now every validation is RECORDED and nothing is BLOCKED. `checkCompanyLicense` never
 * denies access; it writes the outcome to the company row so the Nucleus board fills with real
 * data. Flipping to enforcement is a deliberate, separate change — see ENFORCE below.
 *
 * ── The x-client-ip contract (important) ──────────────────────────────────────
 * This call is server-to-server: Vercel → Nucleus. So the IP Nucleus sees is VERCEL'S EGRESS,
 * not the tester's. CAD-Flow hit exactly this and accumulated 480 phantom "user" IPs on one
 * licence before it was caught. Nucleus therefore honours an `x-client-ip` header, but ONLY from
 * an authenticated product_app key (NucleusLicenseOps/functions/_shared/ip.ts). We are such a
 * caller, so we forward the real end-user IP and Nucleus records `ip_source: "forwarded"`.
 * Never drop that header, and never send an IP you didn't get from the actual request.
 *
 * Env:
 *   NUCLEUS_VALIDATE_URL — e.g. https://api.nucleus-apps.com/functions/v1/license-validate
 *   NUCLEUS_APP_KEY      — the AEC-Flow product_app key (secret; server-side only, never NEXT_PUBLIC_)
 *   NUCLEUS_PRODUCT_KEY  — defaults to "aec_flow"
 *   NUCLEUS_ENFORCE      — "true" flips observe-only off. Leave unset until the data looks right.
 */
import "server-only";
import { prisma } from "@/lib/db";

const PRODUCT = process.env.NUCLEUS_PRODUCT_KEY ?? "aec_flow";
/** Observe-only until this is explicitly "true". Absent/misconfigured env = observe-only. */
export const ENFORCE = process.env.NUCLEUS_ENFORCE === "true";
/** Don't call Nucleus on every page render — once per this window per company is plenty. */
const RECHECK_MS = 60 * 60 * 1000; // 1 hour

export type LicenseResult = {
  ok: boolean; // the HTTP call to Nucleus succeeded
  valid: boolean; // the licence is valid/active/in-grace
  reason?: string;
  message?: string;
  licenseStatus?: string;
  plan?: string | null;
  modules?: string[];
  features?: string[];
  limits?: Record<string, unknown>;
  token?: string | null;
  decisionId?: string;
};

/**
 * Ask Nucleus about one licence key. Never throws — a licensing outage must not take down
 * aec-flow.com, so every failure comes back as a tagged result (the house pattern, cf. email.ts).
 */
export async function validateLicense(opts: {
  licenseKey: string;
  clientIp?: string | null;
  userAgent?: string | null;
  featureKey?: string;
}): Promise<LicenseResult> {
  const url = process.env.NUCLEUS_VALIDATE_URL;
  const appKey = process.env.NUCLEUS_APP_KEY;
  if (!url || !appKey) {
    return {
      ok: false,
      valid: false,
      reason: "licensing_unconfigured",
      message: "NUCLEUS_VALIDATE_URL / NUCLEUS_APP_KEY are not set.",
    };
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(6000), // a slow licensing call must not hang a page render
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${appKey}`,
        // See the x-client-ip contract in this file's header. Omitted rather than faked when unknown.
        ...(opts.clientIp ? { "x-client-ip": opts.clientIp } : {}),
      },
      body: JSON.stringify({
        product_key: PRODUCT,
        license_key: opts.licenseKey,
        app_version: process.env.APP_BUILD ?? undefined,
        feature_key: opts.featureKey,
        // AEC-Flow is a web app: the "device" is a browser, not a workstation. Sending a
        // fingerprint here would bind a device row per browser and blow the device cap, so
        // we deliberately send none. Seats are governed by Company.seatLimit instead.
      }),
    });
  } catch (e) {
    return {
      ok: false,
      valid: false,
      reason: "licensing_unreachable",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await resp.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON body */
  }
  if (!resp.ok) {
    return {
      ok: false,
      valid: false,
      reason: (data.error as string) ?? "licensing_error",
      message: (data.message as string) ?? `Nucleus returned HTTP ${resp.status}.`,
    };
  }
  // A denied licence is HTTP 200 with valid:false — not an error. Distinguishing "Nucleus said no"
  // from "Nucleus didn't answer" is the whole point of the ok/valid split.
  return {
    ok: true,
    valid: !!data.valid,
    reason: data.reason as string | undefined,
    message: data.message as string | undefined,
    licenseStatus: data.license_status as string | undefined,
    plan: (data.plan as string | null) ?? null,
    modules: (data.modules as string[] | undefined) ?? undefined,
    features: (data.features as string[] | undefined) ?? undefined,
    limits: data.limits as Record<string, unknown> | undefined,
    token: (data.signed_entitlement_token as string | null) ?? null,
    decisionId: data.decision_id as string | undefined,
  };
}

/**
 * Validate the signed-in company's licence, at most once per RECHECK_MS, and record the outcome.
 *
 * Returns whether access SHOULD be denied. While observe-only (the default) this is always
 * `false` — callers can wire the redirect now and it stays dormant until NUCLEUS_ENFORCE=true.
 * Never throws.
 */
export async function checkCompanyLicense(opts: {
  companyId: string;
  clientIp?: string | null;
  userAgent?: string | null;
}): Promise<{ denied: boolean; reason?: string; observedOnly: boolean }> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: opts.companyId },
      select: { licenseKey: true, licenseCheckedAt: true, licenseStatus: true, isFounder: true },
    });
    // No key yet (pre-backfill tester, or the founder's own company) — nothing to validate.
    if (!company || company.isFounder || !company.licenseKey) {
      return { denied: false, observedOnly: !ENFORCE };
    }

    const fresh =
      company.licenseCheckedAt != null &&
      Date.now() - company.licenseCheckedAt.getTime() < RECHECK_MS;
    if (fresh) {
      const deniedNow = ENFORCE && company.licenseStatus != null && company.licenseStatus !== "valid";
      return { denied: deniedNow, reason: company.licenseStatus ?? undefined, observedOnly: !ENFORCE };
    }

    const res = await validateLicense({
      licenseKey: company.licenseKey,
      clientIp: opts.clientIp,
      userAgent: opts.userAgent,
    });

    // Record what happened. An unreachable Nucleus is NOT written as a denial — otherwise a
    // licensing outage would poison every company row and, once enforcement is on, lock the
    // whole beta out. Only a definitive answer from Nucleus updates licenseStatus.
    if (res.ok) {
      await prisma.company.update({
        where: { id: opts.companyId },
        data: {
          licenseStatus: res.valid ? "valid" : (res.reason ?? "invalid"),
          licenseCheckedAt: new Date(),
          licenseEntitlements: {
            plan: res.plan ?? null,
            modules: res.modules ?? [],
            features: res.features ?? [],
            limits: res.limits ?? {},
            licenseStatus: res.licenseStatus ?? null,
            decisionId: res.decisionId ?? null,
          },
        },
      });
    } else {
      // Stamp the attempt so a hard-down Nucleus doesn't get re-hit on every single page render.
      await prisma.company.update({
        where: { id: opts.companyId },
        data: { licenseCheckedAt: new Date() },
      });
    }

    const denied = ENFORCE && res.ok && !res.valid;
    return { denied, reason: res.reason, observedOnly: !ENFORCE };
  } catch {
    // Licensing must never break the app. Swallow and allow.
    return { denied: false, observedOnly: !ENFORCE };
  }
}
