/**
 * Connected-app tokens, as Settings → Integrations manages them. SERVER-ONLY.
 *
 * Called from server actions with a signed-in Admin / Director, so the tenant
 * extension already scopes every query to their practice; each function ALSO
 * names the company in its WHERE (belt and braces, and so the functions are
 * correct even if called from a script with no request).
 *
 * The plaintext token exists only in the return value of `createApiToken` — it
 * is never stored, logged or returned again.
 */
import { prisma } from "@/lib/db";
import { apiTokenPrefix, generateApiToken, hashApiToken } from "@/lib/api-tokens/token";

export type ApiTokenListItem = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export async function listApiTokens(companyId: string): Promise<ApiTokenListItem[]> {
  const rows = await prisma.apiToken.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
  }));
}

/** Create a token; returns the plaintext ONCE, with the list row. */
export async function createApiToken(
  companyId: string,
  name: string,
  createdById: string | null,
): Promise<{ token: string; item: ApiTokenListItem }> {
  const token = generateApiToken();
  const row = await prisma.apiToken.create({
    data: { companyId, name, tokenHash: hashApiToken(token), prefix: apiTokenPrefix(token), createdById },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });
  return {
    token,
    item: {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    },
  };
}

/** Revoke one of this practice's tokens. Idempotent; a token of another practice is not found. */
export async function revokeApiToken(companyId: string, id: string): Promise<boolean> {
  const r = await prisma.apiToken.updateMany({
    where: { id, companyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (r.count > 0) return true;
  // Already revoked counts as done; unknown (or another practice's) does not.
  return (await prisma.apiToken.count({ where: { id, companyId } })) > 0;
}
