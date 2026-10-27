/**
 * Who is calling /api/v1? A connected app proves it with `Authorization: Bearer
 * aecf_…`; this resolves the token to its practice.
 *
 * THE LOOKUP IS NOT TENANT-SCOPED, ON PURPOSE. It runs before any company is
 * known (a desktop add-in has no session), so it cannot go through the Prisma
 * tenant extension, which would scope it to "no company" and find nothing. It is
 * raw SQL by hash, exactly like the Stripe webhook's invoice lookup
 * (lib/data/pay-now.ts findInvoiceForPayment). Everything AFTER it must run
 * inside `runAsCompany(auth.companyId, …)` so the extension scopes every query
 * to the practice the token proved.
 *
 * SERVER-ONLY (Prisma).
 */
import { prisma } from "@/lib/db";
import { bearerToken, hashApiToken } from "@/lib/api-tokens/token";
import { isLicenseExpired } from "@/lib/server/tenant";

export type ApiAuth = {
  ok: true;
  companyId: string;
  companyName: string;
  tokenId: string;
  tokenName: string;
};

export type ApiAuthFailure =
  | { ok: false; status: 401; error: "invalid_token" }
  | { ok: false; status: 403; error: "license_expired" };

const INVALID: ApiAuthFailure = { ok: false, status: 401, error: "invalid_token" };
const EXPIRED: ApiAuthFailure = { ok: false, status: 403, error: "license_expired" };

type TokenRow = {
  tokenId: string;
  tokenName: string;
  companyId: string;
  companyName: string;
  expiresAt: Date | null;
  isFounder: boolean;
};

/**
 * Authenticate one request. A missing, malformed, unknown or revoked token is
 * `invalid_token` (401) — the four are indistinguishable to the caller on
 * purpose. A good token whose practice's licence has lapsed is
 * `license_expired` (403). On success `lastUsedAt` is stamped.
 */
export async function authenticateApiToken(req: Pick<Request, "headers">): Promise<ApiAuth | ApiAuthFailure> {
  const token = bearerToken(req.headers.get("authorization"));
  if (!token) return INVALID;

  const hash = hashApiToken(token);
  const rows = await prisma.$queryRaw<TokenRow[]>`
    SELECT t."id" AS "tokenId", t."name" AS "tokenName", t."companyId",
           c."name" AS "companyName", c."expiresAt", c."isFounder"
    FROM "api_tokens" t
    JOIN "companies" c ON c."id" = t."companyId"
    WHERE t."tokenHash" = ${hash} AND t."revokedAt" IS NULL
    LIMIT 1`;
  const row = rows[0];
  if (!row) return INVALID;

  if (isLicenseExpired({ expiresAt: row.expiresAt, isFounder: row.isFounder })) return EXPIRED;

  // Bookkeeping only: a failed stamp must not refuse a good token.
  try {
    await prisma.$executeRaw`UPDATE "api_tokens" SET "lastUsedAt" = ${new Date()} WHERE "id" = ${row.tokenId}`;
  } catch (e) {
    console.warn("[api-token] could not stamp lastUsedAt", e instanceof Error ? e.message : e);
  }

  return {
    ok: true,
    companyId: row.companyId,
    companyName: row.companyName,
    tokenId: row.tokenId,
    tokenName: row.tokenName,
  };
}
