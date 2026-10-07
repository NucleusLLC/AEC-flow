/**
 * Office TV access without a login. SERVER-ONLY.
 *
 * The owner asked for /officedash to open with no login page, so the TV can flip
 * between this board and the Sigma board unattended. A secret key in the URL
 * (`/officedash?k=…`) stands in for the sign-in: only its SHA-256 is here, the
 * key itself lives in the TV's bookmark and is passed along by both boards'
 * handover. Without a session and without the right key, the page sends the
 * visitor to /login as before.
 *
 * To rotate: make a new key, replace the hash, give the owner the new link.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

const OFFICEDASH_KEY_SHA256 = "3ca85d7cc48970445d58e91417f88325279b0c3605bbef372f90ebf8126b3b01";

/** True when `key` is the office TV key. Constant-time compare on the hashes. */
export function officeKeyMatches(key: string | undefined | null): boolean {
  if (!key || key.length > 200) return false;
  const got = createHash("sha256").update(key).digest();
  const want = Buffer.from(OFFICEDASH_KEY_SHA256, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

/** The company the key belongs to: `OFFICEDASH_COMPANY_ID`, else the founder practice. */
export async function officeKeyCompanyId(): Promise<string | null> {
  if (process.env.OFFICEDASH_COMPANY_ID) return process.env.OFFICEDASH_COMPANY_ID;
  const founder = await prisma.company.findFirst({ where: { isFounder: true }, select: { id: true } });
  return founder?.id ?? null;
}
