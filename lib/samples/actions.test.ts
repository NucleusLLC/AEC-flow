/**
 * Who may install, remove or push the sample set.
 *
 * The two action files are exercised with their collaborators faked, so what
 * is tested is the gate itself: a non-admin never reaches the installer from
 * Settings, a non-founder never reaches it from /admin, the company always
 * comes from the session in Settings, and the founder company is skipped
 * unless it is asked for by name.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  actor: null as null | { id: string; role: string; companyId: string; isFounder: boolean },
  founder: false,
  founderCompany: false as boolean | null,
  install: vi.fn(),
  remove: vi.fn(),
  plan: vi.fn(),
  status: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/actor", () => ({
  requireActor: vi.fn(async () => {
    if (!h.actor) throw new Error("You must be signed in.");
    return h.actor;
  }),
}));
vi.mock("@/lib/server/founder", () => ({ isCurrentUserFounder: vi.fn(async () => h.founder) }));
vi.mock("@/lib/samples/install", () => ({
  installSampleSet: h.install,
  removeSampleSet: h.remove,
  planSampleSet: h.plan,
  getSampleSetStatus: h.status,
}));
vi.mock("@/lib/samples/admin", () => ({ isFounderCompany: vi.fn(async () => h.founderCompany) }));

import {
  getOwnSampleSetStatusAction,
  installOwnSampleSetAction,
  removeOwnSampleSetAction,
} from "@/app/(app)/settings/sample-actions";
import { sampleSetForCompanyAction } from "@/app/(app)/admin/sample-actions";

const INSTALLED = { ok: true, status: "installed", counts: {}, total: 141, lang: "en" };

beforeEach(() => {
  h.actor = null;
  h.founder = false;
  h.founderCompany = false;
  for (const f of [h.install, h.remove, h.plan, h.status]) f.mockReset();
  h.install.mockResolvedValue(INSTALLED);
  h.remove.mockResolvedValue({ ok: true, status: "removed", removed: 141, kept: [] });
  h.plan.mockResolvedValue({ ok: true, status: "would-install", counts: {}, total: 141, lang: "en" });
  h.status.mockResolvedValue({ installed: false });
});

describe("Settings > Sample files", () => {
  it("refuses a visitor who is not signed in", async () => {
    expect(await installOwnSampleSetAction("en")).toEqual({ ok: false, error: "You must be signed in." });
    expect(await removeOwnSampleSetAction()).toEqual({ ok: false, error: "You must be signed in." });
    expect(h.install).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it.each(["STAFF", "MANAGER", "VIEWER"])("refuses a %s", async (role) => {
    h.actor = { id: "u", role, companyId: "co-1", isFounder: false };
    const a = await installOwnSampleSetAction("en");
    const b = await removeOwnSampleSetAction();
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(h.install).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
    expect(await getOwnSampleSetStatusAction()).toEqual({ installed: false });
    expect(h.status).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "DIRECTOR"])("lets a %s install and remove, for their own company only", async (role) => {
    h.actor = { id: "u", role, companyId: "co-1", isFounder: false };
    expect(await installOwnSampleSetAction("es")).toEqual(INSTALLED);
    expect(h.install).toHaveBeenCalledWith("co-1", "es");
    await removeOwnSampleSetAction();
    expect(h.remove).toHaveBeenCalledWith("co-1");
  });

  it("takes no company from the caller: the only argument is the language", () => {
    expect(installOwnSampleSetAction.length).toBe(1);
    expect(removeOwnSampleSetAction.length).toBe(0);
  });

  it("refuses a language the set does not come in", async () => {
    h.actor = { id: "u", role: "ADMIN", companyId: "co-1", isFounder: false };
    const res = await installOwnSampleSetAction("nl");
    expect(res.ok).toBe(false);
    expect(h.install).not.toHaveBeenCalled();
  });
});

describe("/admin > Sample files (founder push)", () => {
  const input = { companyId: "co-2", lang: "en", mode: "install" as const, confirm: "INSTALL" };

  it("refuses everyone who is not the founder, whatever their role", async () => {
    h.actor = { id: "u", role: "ADMIN", companyId: "co-1", isFounder: false };
    expect(await sampleSetForCompanyAction(input)).toEqual({ ok: false, error: "Not authorized." });
    expect(await sampleSetForCompanyAction({ ...input, mode: "dry" })).toEqual({ ok: false, error: "Not authorized." });
    expect(h.install).not.toHaveBeenCalled();
    expect(h.plan).not.toHaveBeenCalled();
  });

  it("a dry run plans and never installs", async () => {
    h.founder = true;
    const res = await sampleSetForCompanyAction({ companyId: "co-2", lang: "es", mode: "dry" });
    expect(res.ok).toBe(true);
    expect(h.plan).toHaveBeenCalledWith("co-2", "es");
    expect(h.install).not.toHaveBeenCalled();
  });

  it("a real run needs the confirmation word", async () => {
    h.founder = true;
    const res = await sampleSetForCompanyAction({ companyId: "co-2", lang: "en", mode: "install" });
    expect(res.ok).toBe(false);
    expect(h.install).not.toHaveBeenCalled();
    expect((await sampleSetForCompanyAction(input)).ok).toBe(true);
    expect(h.install).toHaveBeenCalledWith("co-2", "en");
  });

  it("skips the founder company unless it is asked for on purpose", async () => {
    h.founder = true;
    h.founderCompany = true;
    expect((await sampleSetForCompanyAction(input)).ok).toBe(false);
    expect((await sampleSetForCompanyAction({ ...input, mode: "dry" })).ok).toBe(false);
    expect(h.install).not.toHaveBeenCalled();
    expect(h.plan).not.toHaveBeenCalled();
    expect((await sampleSetForCompanyAction({ ...input, allowFounderCompany: true })).ok).toBe(true);
    expect(h.install).toHaveBeenCalledWith("co-2", "en");
  });

  it("refuses an unknown company, an unknown language and an unknown mode", async () => {
    h.founder = true;
    h.founderCompany = null;
    expect((await sampleSetForCompanyAction(input)).ok).toBe(false);
    h.founderCompany = false;
    expect((await sampleSetForCompanyAction({ ...input, lang: "de" })).ok).toBe(false);
    expect((await sampleSetForCompanyAction({ ...input, mode: "wipe" as unknown as "dry" })).ok).toBe(false);
    expect((await sampleSetForCompanyAction({ ...input, companyId: "" })).ok).toBe(false);
    expect(h.install).not.toHaveBeenCalled();
  });
});
