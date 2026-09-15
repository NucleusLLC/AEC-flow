/**
 * Who may change what on a member record.
 *
 * PURE + CLIENT-SAFE: no Prisma, no session. Server actions call it to ENFORCE;
 * the member form calls `canChangeMemberAccess` only to decide what to draw.
 *
 * THE RULE. A member record carries three fields that decide what its owner can
 * do in the app — `role` (which gates are open), `status` (whether they can sign
 * in) and `email` (the login identity, and where a password-reset link goes).
 * Those three are ACCESS fields and only a member administrator (ADMIN, DIRECTOR
 * or the founder — the one set defined by `canManagePasswords`) may change them.
 * Everything else on the record (name, phone, department, capacity…) stays
 * editable by any colleague, per the beta's permissive-editing decision.
 *
 * Before this, `/team/[id]/edit` let any signed-in user rewrite all three for
 * anyone in their company: promote themselves to ADMIN, or point the director's
 * email at their own inbox and take the account over through "Forgot password".
 *
 * The founder's own access fields are changeable only by the founder: the
 * founder account is the platform super-admin, so an ADMIN who could demote or
 * re-address it could lift themselves past every other check.
 */
import { canManagePasswords } from "@/lib/password-policy";

/** Roles that open the member-administration gate. Adding someone AT one is administration. */
export const MEMBER_ADMIN_ROLES = ["ADMIN", "DIRECTOR"] as const;

export type MemberWriteActor = { id: string; role: string; isFounder: boolean };

/** The target as it is in the database now. `null` when creating a new member. */
export type MemberAccessSnapshot = { id: string; role: string; status: string; email: string; isFounder: boolean };

/** What the write asks for. Absent (undefined/null) means "leave as is". */
export type MemberAccessRequest = { role?: string | null; status?: string | null; email?: string | null };

export type MemberWriteDecision = { ok: true } | { ok: false; error: string };

/** May this actor change role, status or email on member records at all? */
export function canChangeMemberAccess(actor: Pick<MemberWriteActor, "role" | "isFounder">): boolean {
  return canManagePasswords(actor.role, actor.isFounder);
}

function normEmail(v: string): string {
  return v.trim().toLowerCase();
}

/** The access fields this request would actually change on `target`. */
export function changedAccessFields(target: MemberAccessSnapshot, req: MemberAccessRequest): ("role" | "status" | "email")[] {
  const changed: ("role" | "status" | "email")[] = [];
  if (req.role != null && req.role !== target.role) changed.push("role");
  if (req.status != null && req.status !== target.status) changed.push("status");
  if (req.email != null && normEmail(req.email) !== normEmail(target.email)) changed.push("email");
  return changed;
}

export function checkMemberWrite(
  actor: MemberWriteActor,
  target: MemberAccessSnapshot | null,
  req: MemberAccessRequest,
): MemberWriteDecision {
  const admin = canChangeMemberAccess(actor);

  if (target === null) {
    // Creating a directory entry is open to everyone (it has no password, so it
    // cannot sign in). Creating it at an administrative role is administration.
    if (!admin && req.role != null && (MEMBER_ADMIN_ROLES as readonly string[]).includes(req.role)) {
      return { ok: false, error: "Only an administrator or director can add someone as an Admin or Director." };
    }
    if (!admin && req.status != null && req.status !== "ACTIVE") {
      return { ok: false, error: "Only an administrator or director can set a member's status." };
    }
    return { ok: true };
  }

  const changed = changedAccessFields(target, req);
  if (changed.length === 0) return { ok: true };

  if (target.isFounder && !actor.isFounder) {
    return { ok: false, error: "Only the founder can change the founder's role, status or email." };
  }
  if (!admin) {
    return { ok: false, error: "Only an administrator or director can change a member's role, status or email." };
  }
  return { ok: true };
}
