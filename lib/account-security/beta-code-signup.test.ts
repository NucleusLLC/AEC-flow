import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(),
  userFind: vi.fn(), userCreate: vi.fn(), companyCreate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {
  betaCode: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, update: mocks.update },
  user: { findUnique: mocks.userFind, create: mocks.userCreate },
  company: { create: mocks.companyCreate },
} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("bcryptjs", () => ({ default: { hash: async () => "hash" } }));
vi.mock("@/lib/server/rate-limit", () => ({ hitRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/server/email", () => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/server/email-verification", () => ({ issueEmailVerification: vi.fn() }));
vi.mock("@/lib/data/company-seed", () => ({ seedCompany: vi.fn() }));
vi.mock("@/lib/samples/install", () => ({ installSampleSet: async () => ({ ok: true }) }));
vi.mock("@/lib/i18n/server", () => ({ getServerLang: async () => "en" }));
import { registerBetaTester } from "@/app/signup/actions";

const input = { name: "Tester", email: "tester@example.com", password: "StrongPassword123!", code: "AECFLOW-BETA-TEST-CODE", agreed: true, acceptedTerms: true };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue({ id: "code-1", code: input.code, keyPrefix: "TEST", status: "issued", claimedEmail: input.email });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.userFind.mockResolvedValue(null);
  mocks.userCreate.mockResolvedValue({ id: "user-1" });
  mocks.companyCreate.mockResolvedValue({ id: "company-1" });
});

describe("registerBetaTester pool resolution", () => {
  it("accepts and claims an issued code", async () => {
    expect(await registerBetaTester(input)).toEqual({ ok: true });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "code-1", status: { in: ["available", "issued"] } },
      data: { status: "claimed", claimedEmail: input.email, claimedAt: expect.any(Date) },
    });
    expect(mocks.userCreate).toHaveBeenCalledOnce();
  });
  it("rejects a claimed code with the already-used message", async () => {
    mocks.findUnique.mockResolvedValue({ id: "code-1", code: input.code, keyPrefix: "TEST", status: "claimed" });
    expect(await registerBetaTester(input)).toEqual({ ok: false, error: "That beta access code has already been used." });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.companyCreate).not.toHaveBeenCalled();
  });
  it("restores issued status and its holder if signup fails after reservation", async () => {
    mocks.companyCreate.mockRejectedValue(new Error("creation failed"));
    expect(await registerBetaTester(input)).toEqual({ ok: false, error: "creation failed" });
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: { id: "code-1", status: "claimed" },
      data: { status: "issued", claimedEmail: input.email, claimedAt: null, companyId: null },
    });
  });
});
