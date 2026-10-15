import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), send: vi.fn(), notify: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { betaCode: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "192.0.2.1" }) }));
vi.mock("@/lib/i18n/server", () => ({ getServerT: async () => (s: string) => s }));
vi.mock("@/lib/server/email", () => ({ sendBetaCodeEmail: mocks.send, sendEmail: mocks.notify }));
vi.mock("@/lib/server/rate-limit", () => ({ hitRateLimit: mocks.limit }));
import { requestBetaCode } from "@/app/beta-portal/actions";
import { RATE_LIMITS, tooManyAttemptsMessage } from "./rate-limit-policy";
const code = { id: "code-1", code: "AECFLOW-BETA-TEST-CODE", keyPrefix: "TEST" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BETA_NOTIFY_EMAIL", "");
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.findFirst.mockResolvedValue(null);
  mocks.updateMany.mockResolvedValue({ count: 1 });
});
describe("requestBetaCode", () => {
  it("issues the oldest available code atomically and normalizes email", async () => {
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(code);
    expect(await requestBetaCode({ email: " Tester@Example.com " })).toEqual({ ok: true });
    expect(mocks.findFirst).toHaveBeenLastCalledWith({ where: { status: "available" }, orderBy: { createdAt: "asc" } });
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: code.id, status: "available" }, data: { status: "issued", claimedEmail: "tester@example.com" } });
    expect(mocks.send).toHaveBeenCalledWith({ to: "tester@example.com", code: code.code });
    expect(mocks.limit).toHaveBeenCalledWith(RATE_LIMITS.codeRequestEmail, "tester@example.com");
  });
  it("resends an issued code without consuming another", async () => {
    mocks.findFirst.mockResolvedValueOnce(code);
    expect(await requestBetaCode({ email: "tester@example.com" })).toEqual({ ok: true });
    expect(mocks.findFirst).toHaveBeenCalledOnce();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith({ to: "tester@example.com", code: code.code });
  });
  it("sends waitlist mail when empty and returns the identical response for all three paths", async () => {
    const empty = await requestBetaCode({ email: "tester@example.com" });
    expect(mocks.send).toHaveBeenLastCalledWith({ to: "tester@example.com" });
    mocks.findFirst.mockResolvedValueOnce(code);
    const resend = await requestBetaCode({ email: "tester@example.com" });
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(code);
    const issued = await requestBetaCode({ email: "tester@example.com" });
    expect(empty).toEqual({ ok: true });
    expect(empty).toEqual(resend);
    expect(empty).toEqual(issued);
  });
  it("retries one lost race then treats the pool as empty", async () => {
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValue(code);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect(await requestBetaCode({ email: "tester@example.com" })).toEqual({ ok: true });
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.send).toHaveBeenCalledWith({ to: "tester@example.com" });
  });
  it("rejects invalid email before rate limiting", async () => {
    expect(await requestBetaCode({ email: "invalid" })).toEqual({ ok: false, error: "Please enter a valid email address." });
    expect(mocks.limit).not.toHaveBeenCalled();
  });
  it.each([0, 1])("rejects rate limit %i with the policy message", async (index) => {
    if (index) mocks.limit.mockResolvedValueOnce({ allowed: true });
    mocks.limit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 120 });
    expect(await requestBetaCode({ email: "tester@example.com" })).toEqual({ ok: false, error: tooManyAttemptsMessage("code requests", 120) });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("sends the optional lead notification", async () => {
    vi.stubEnv("BETA_NOTIFY_EMAIL", "founder@example.com");
    mocks.findFirst.mockResolvedValueOnce(code);
    await requestBetaCode({ email: "tester@example.com" });
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ to: "founder@example.com", subject: "Beta code request", text: "tester@example.com — code issued TEST" }));
  });
});
