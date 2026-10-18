import { afterEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findCode: vi.fn(),
  createCode: vi.fn(),
  createUser: vi.fn(),
  createCompany: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    betaCode: { findUnique: db.findCode, create: db.createCode },
    user: { findUnique: db.findUser, create: db.createUser },
    company: { create: db.createCompany },
  },
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/server/rate-limit", () => ({
  hitRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/server/email-verification", () => ({ issueEmailVerification: vi.fn() }));
vi.mock("@/lib/data/company-seed", () => ({ seedCompany: vi.fn() }));
vi.mock("@/lib/samples/install", () => ({ installSampleSet: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getServerLang: vi.fn() }));

import { registerBetaTester } from "./actions";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("rejects a legacy shared env code without creating any records", async () => {
  vi.stubEnv("BETA_SIGNUP_CODE", "LEGACY-CODE");
  db.findCode.mockResolvedValue(null);

  const result = await registerBetaTester({
    name: "Beta Tester",
    email: "tester@example.com",
    company: "Test Company",
    password: "a long test password",
    code: "LEGACY-CODE",
    agreed: true,
    acceptedTerms: true,
  });

  expect(result).toEqual({ ok: false, error: "That beta access code isn't valid." });
  expect(db.findCode).toHaveBeenCalledWith({
    where: { code: "LEGACY-CODE" },
    select: { id: true, code: true, keyPrefix: true, status: true, claimedEmail: true },
  });
  expect(db.findUser).not.toHaveBeenCalled();
  expect(db.createCode).not.toHaveBeenCalled();
  expect(db.createUser).not.toHaveBeenCalled();
  expect(db.createCompany).not.toHaveBeenCalled();
});
