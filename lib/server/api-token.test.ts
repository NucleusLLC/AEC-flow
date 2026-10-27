/**
 * authenticateApiToken: every outcome a connected app can get, against a faked
 * Prisma. The lookup is raw SQL by hash (it runs before any company is known),
 * so the fake answers $queryRaw and records $executeRaw.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ queryRaw: vi.fn(), executeRaw: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: db.queryRaw, $executeRaw: db.executeRaw },
}));
// lib/server/tenant imports the session machinery; only its pure licence rule is used here.
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { authenticateApiToken } from "./api-token";
import { generateApiToken, hashApiToken } from "@/lib/api-tokens/token";

const TOKEN = generateApiToken();
const req = (authorization?: string) =>
  ({ headers: new Headers(authorization === undefined ? {} : { authorization }) }) as Pick<Request, "headers">;

const ROW = {
  tokenId: "tok_1",
  tokenName: "M.E.P.flow — drafting PC",
  companyId: "co_A",
  companyName: "ZenArch",
  expiresAt: null as Date | null,
  isFounder: false,
};

/** The values bound into the tagged-template SQL (strings first, then values). */
const boundValues = (call: unknown[]) => call.slice(1);
const sqlText = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");

beforeEach(() => {
  vi.clearAllMocks();
  db.queryRaw.mockResolvedValue([ROW]);
  db.executeRaw.mockResolvedValue(1);
});

describe("authenticateApiToken", () => {
  it("resolves a good token to its company, by hash, and stamps lastUsedAt", async () => {
    const r = await authenticateApiToken(req(`Bearer ${TOKEN}`));
    expect(r).toEqual({
      ok: true,
      companyId: "co_A",
      companyName: "ZenArch",
      tokenId: "tok_1",
      tokenName: "M.E.P.flow — drafting PC",
    });
    // Searched by the hash, never by the token itself.
    const call = db.queryRaw.mock.calls[0];
    expect(boundValues(call)).toEqual([hashApiToken(TOKEN)]);
    expect(boundValues(call)).not.toContain(TOKEN);
    expect(sqlText(call)).toMatch(/"revokedAt" IS NULL/);
    expect(db.executeRaw).toHaveBeenCalledTimes(1);
    const stamp = db.executeRaw.mock.calls[0];
    expect(sqlText(stamp)).toMatch(/UPDATE "api_tokens" SET "lastUsedAt"/);
    expect(boundValues(stamp)[1]).toBe("tok_1");
  });

  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a Basic header", `Basic ${TOKEN}`],
    ["a malformed token", "Bearer aecf_short"],
  ])("refuses %s without touching the database", async (_l, header) => {
    expect(await authenticateApiToken(req(header))).toEqual({ ok: false, status: 401, error: "invalid_token" });
    expect(db.queryRaw).not.toHaveBeenCalled();
  });

  it("refuses an unknown or revoked token (the query finds no row) as invalid_token", async () => {
    db.queryRaw.mockResolvedValue([]);
    expect(await authenticateApiToken(req(`Bearer ${TOKEN}`))).toEqual({
      ok: false,
      status: 401,
      error: "invalid_token",
    });
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it("refuses a company whose licence has expired with license_expired", async () => {
    db.queryRaw.mockResolvedValue([{ ...ROW, expiresAt: new Date(Date.now() - 86_400_000) }]);
    expect(await authenticateApiToken(req(`Bearer ${TOKEN}`))).toEqual({
      ok: false,
      status: 403,
      error: "license_expired",
    });
    expect(db.executeRaw).not.toHaveBeenCalled();
  });

  it("lets a licence that has not expired yet, and the founder practice, through", async () => {
    db.queryRaw.mockResolvedValue([{ ...ROW, expiresAt: new Date(Date.now() + 86_400_000) }]);
    expect((await authenticateApiToken(req(`Bearer ${TOKEN}`))).ok).toBe(true);
    db.queryRaw.mockResolvedValue([{ ...ROW, expiresAt: new Date(0), isFounder: true }]);
    expect((await authenticateApiToken(req(`Bearer ${TOKEN}`))).ok).toBe(true);
  });

  it("still authenticates when the lastUsedAt stamp fails", async () => {
    db.executeRaw.mockRejectedValue(new Error("db busy"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await authenticateApiToken(req(`Bearer ${TOKEN}`))).ok).toBe(true);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
    warn.mockRestore();
  });
});
