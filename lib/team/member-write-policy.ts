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
 *
 * SECURITY AUDIT D-6 (owner's ruling, 27 Nov 2026: "Director/Admin only") ended
 * the beta's permissive editing. Adding a member (it uses a seat) and editing a
 * COLLEAGUE's record are now member administration too. A non-administrator may
 * edit only their own record, and not its leave balance or capacity (granting
 * yourself leave days is approving your own leave). A VIEWER is read-only and
 * edits nothing, not even their own record.
 *
 * Before this, `/team/[id]/edit` let any signed-in user rewrite all three for
 * anyone in their company: promote themselves to ADMIN, or point the director's
 * email at their own inbox and take the account over through "Forgot password".
 *
 * The founder's own access fields are changeable only by the founder: the
 * founder account is the platform super-admin, so an ADMIN who could demote or
 * re-address it could lift themselves past every other check.
 */
import { canManagePasswords, isReadOnlyRole } from "@/lib/password-policy";
import { READ_ONLY_REFUSAL } from "@/lib/permissions/role-gates";

/** Roles that open the member-administration gate. Adding someone AT one is administration. */
export const MEMBER_ADMIN_ROLES = ["ADMIN", "DIRECTOR"] as const;

export type MemberWriteActor = { id: string; role: string; isFounder: boolean };

/** The figures only an administrator may change, even on one's own record (D-6). */
export type MemberAllowanceFields = {
  capacity?: number | null;
  annualLeaveTotal?: number | null;
  annualLeaveTaken?: number | null;
};

/** The target as it is in the database now. `null` when creating a new member. */
export type MemberAccessSnapshot = {
  id: string;
  role: string;
  status: string;
  email: string;
  isFounder: boolean;
} & MemberAllowanceFields;

/** What the write asks for. Absent (undefined/null) means "leave as is". */
export type MemberAccessRequest = {
  role?: string | null;
  status?: string | null;
  email?: string | null;
} & MemberAllowanceFields;

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

/** The allowance fields this request would actually change. Absent, or unknown on the row, counts as unchanged. */
export function changedAllowanceFields(
  target: MemberAccessSnapshot,
  req: MemberAccessRequest,
): (keyof MemberAllowanceFields)[] {
  const changed: (keyof MemberAllowanceFields)[] = [];
  for (const k of ["capacity", "annualLeaveTotal", "annualLeaveTaken"] as const) {
    const want = req[k];
    const have = target[k];
    if (want != null && have != null && Number(want) !== Number(have)) changed.push(k);
  }
  return changed;
}

export const ADD_MEMBER_ADMIN_ONLY = "Only an administrator or director can add members.";
export const EDIT_COLLEAGUE_ADMIN_ONLY = "Only an administrator or director can edit a colleague's record.";
export const ALLOWANCE_ADMIN_ONLY = "Only an administrator or director can change a leave balance or capacity.";

export function checkMemberWrite(
  actor: MemberWriteActor,
  target: MemberAccessSnapshot | null,
  req: MemberAccessRequest,
): MemberWriteDecision {
  const admin = canChangeMemberAccess(actor);

  // A VIEWER is read-only everywhere (D-6). The founder never is.
  if (!admin && isReadOnlyRole(actor.role, actor.isFounder)) return { ok: false, error: READ_ONLY_REFUSAL };

  if (target === null) {
    // Adding a member takes a seat, at any role and status: member
    // administration (D-6). Before, anyone could add a directory entry and only
    // an Admin / Director role or a non-ACTIVE status was reserved.
    return admin ? { ok: true } : { ok: false, error: ADD_MEMBER_ADMIN_ONLY };
  }

  // A non-administrator edits only their own record, and not its allowances (D-6).
  if (!admin && target.id !== actor.id) return { ok: false, error: EDIT_COLLEAGUE_ADMIN_ONLY };
  if (!admin && changedAllowanceFields(target, req).length > 0) return { ok: false, error: ALLOWANCE_ADMIN_ONLY };

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
