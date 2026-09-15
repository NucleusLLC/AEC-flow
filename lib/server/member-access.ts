/**
 * Load a member's access fields for `checkMemberWrite` (lib/team/member-write-policy.ts).
 *
 * SERVER-ONLY (Prisma). `User` is not tenant-scoped by the query extension, so the
 * company is part of the WHERE: an id from another firm simply does not match,
 * and the caller reports "not in your company" rather than acting on it.
 */
import { prisma } from "@/lib/db";
import { isFounderEmail } from "@/lib/server/founder";
import type { MemberAccessSnapshot } from "@/lib/team/member-write-policy";

export async function getMemberAccessSnapshot(companyId: string, id: string): Promise<MemberAccessSnapshot | null> {
  const row = await prisma.user.findFirst({
    where: { id, companyId },
    select: { id: true, role: true, status: true, email: true },
  });
  if (!row) return null;
  return { id: row.id, role: row.role, status: row.status, email: row.email, isFounder: isFounderEmail(row.email) };
}
