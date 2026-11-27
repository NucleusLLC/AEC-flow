import { describe, it, expect } from "vitest";
import { READ_ONLY_REFUSAL } from "@/lib/permissions/role-gates";
import {
  ADD_MEMBER_ADMIN_ONLY,
  ALLOWANCE_ADMIN_ONLY,
  EDIT_COLLEAGUE_ADMIN_ONLY,
  canChangeMemberAccess,
  changedAccessFields,
  checkMemberWrite,
  type MemberAccessSnapshot,
  type MemberWriteActor,
} from "./member-write-policy";

const staff: MemberWriteActor = { id: "u-staff", role: "STAFF", isFounder: false };
const manager: MemberWriteActor = { id: "u-mgr", role: "MANAGER", isFounder: false };
const viewer: MemberWriteActor = { id: "u-viewer", role: "VIEWER", isFounder: false };
const admin: MemberWriteActor = { id: "u-admin", role: "ADMIN", isFounder: false };
const director: MemberWriteActor = { id: "u-dir", role: "DIRECTOR", isFounder: false };
const founder: MemberWriteActor = { id: "u-founder", role: "DIRECTOR", isFounder: true };

const colleague: MemberAccessSnapshot = { id: "u-col", role: "STAFF", status: "ACTIVE", email: "col@firm.com", isFounder: false };
const founderRow: MemberAccessSnapshot = { id: "u-founder", role: "DIRECTOR", status: "ACTIVE", email: "greg@zenarch.net", isFounder: true };
const selfRow: MemberAccessSnapshot = { id: "u-staff", role: "STAFF", status: "ACTIVE", email: "me@firm.com", isFounder: false };

const denied = (d: { ok: boolean }) => d.ok === false;

describe("canChangeMemberAccess", () => {
  it("is the member-admin set: ADMIN, DIRECTOR, founder", () => {
    expect(canChangeMemberAccess(admin)).toBe(true);
    expect(canChangeMemberAccess(director)).toBe(true);
    expect(canChangeMemberAccess({ role: "VIEWER", isFounder: true })).toBe(true);
    for (const role of ["STAFF", "MANAGER", "VIEWER", ""]) {
      expect(canChangeMemberAccess({ role, isFounder: false }), role).toBe(false);
    }
  });
});

describe("changedAccessFields", () => {
  it("treats absent fields as unchanged and compares email case-insensitively", () => {
    expect(changedAccessFields(colleague, {})).toEqual([]);
    expect(changedAccessFields(colleague, { role: "STAFF", status: "ACTIVE", email: " COL@firm.com " })).toEqual([]);
    expect(changedAccessFields(colleague, { role: "ADMIN", status: "INACTIVE", email: "x@y.com" })).toEqual(["role", "status", "email"]);
  });
});

describe("checkMemberWrite — edits", () => {
  it("lets a non-admin edit the ordinary fields of their OWN record", () => {
    expect(checkMemberWrite(staff, selfRow, { role: "STAFF", status: "ACTIVE", email: "me@firm.com" })).toEqual({ ok: true });
  });

  it("stops a non-admin editing a colleague's record at all (D-6)", () => {
    for (const actor of [staff, manager]) {
      const d = checkMemberWrite(actor, colleague, { role: "STAFF", status: "ACTIVE", email: "col@firm.com" });
      expect(d).toEqual({ ok: false, error: EDIT_COLLEAGUE_ADMIN_ONLY });
    }
  });

  it("stops a non-admin changing their own leave balance or capacity (D-6)", () => {
    const me = { ...selfRow, capacity: 100, annualLeaveTotal: 22, annualLeaveTaken: 3 };
    expect(checkMemberWrite(staff, me, { annualLeaveTotal: 40 })).toEqual({ ok: false, error: ALLOWANCE_ADMIN_ONLY });
    expect(checkMemberWrite(staff, me, { annualLeaveTaken: 0 })).toEqual({ ok: false, error: ALLOWANCE_ADMIN_ONLY });
    expect(checkMemberWrite(staff, me, { capacity: 50 })).toEqual({ ok: false, error: ALLOWANCE_ADMIN_ONLY });
    expect(checkMemberWrite(staff, me, { capacity: 100, annualLeaveTotal: 22, annualLeaveTaken: 3 })).toEqual({ ok: true });
    expect(checkMemberWrite(admin, { ...colleague, annualLeaveTotal: 22 }, { annualLeaveTotal: 25 })).toEqual({ ok: true });
  });

  it("refuses a VIEWER every edit, their own record included (D-6)", () => {
    const viewerRow = { ...selfRow, id: "u-viewer", role: "VIEWER" };
    expect(checkMemberWrite(viewer, viewerRow, {})).toEqual({ ok: false, error: READ_ONLY_REFUSAL });
    expect(checkMemberWrite(viewer, colleague, {})).toEqual({ ok: false, error: READ_ONLY_REFUSAL });
  });

  it("stops a non-admin promoting themselves", () => {
    expect(denied(checkMemberWrite(staff, selfRow, { role: "ADMIN" }))).toBe(true);
  });

  it("stops a non-admin re-addressing a colleague (account takeover via reset)", () => {
    expect(denied(checkMemberWrite(staff, colleague, { email: "attacker@evil.com" }))).toBe(true);
  });

  it("stops a non-admin deactivating a colleague", () => {
    expect(denied(checkMemberWrite(staff, colleague, { status: "INACTIVE" }))).toBe(true);
  });

  it("lets an admin or director change access fields", () => {
    expect(checkMemberWrite(admin, colleague, { role: "MANAGER", email: "new@firm.com" })).toEqual({ ok: true });
    expect(checkMemberWrite(director, colleague, { status: "INACTIVE" })).toEqual({ ok: true });
  });

  it("protects the founder's access fields from everyone but the founder", () => {
    expect(denied(checkMemberWrite(admin, founderRow, { role: "STAFF" }))).toBe(true);
    expect(denied(checkMemberWrite(director, founderRow, { email: "someone@else.com" }))).toBe(true);
    expect(checkMemberWrite(founder, founderRow, { email: "greg@zenarch.net" })).toEqual({ ok: true });
    expect(checkMemberWrite(founder, colleague, { role: "ADMIN" })).toEqual({ ok: true });
  });

  it("lets an admin and the founder edit the founder's ordinary fields, but not a non-admin (D-6)", () => {
    const ordinary = { role: "DIRECTOR", status: "ACTIVE", email: "GREG@zenarch.net" };
    expect(checkMemberWrite(admin, founderRow, ordinary)).toEqual({ ok: true });
    expect(checkMemberWrite(founder, founderRow, ordinary)).toEqual({ ok: true });
    expect(denied(checkMemberWrite(staff, founderRow, ordinary))).toBe(true);
  });
});

describe("checkMemberWrite — new members", () => {
  it("reserves adding any member for administrators (D-6: it takes a seat)", () => {
    for (const role of ["STAFF", "MANAGER", "VIEWER"]) {
      expect(checkMemberWrite(staff, null, { role, status: "ACTIVE" }), role).toEqual({ ok: false, error: ADD_MEMBER_ADMIN_ONLY });
      expect(checkMemberWrite(manager, null, { role, status: "ACTIVE" }), role).toEqual({ ok: false, error: ADD_MEMBER_ADMIN_ONLY });
      expect(checkMemberWrite(admin, null, { role, status: "ACTIVE" }), role).toEqual({ ok: true });
      expect(checkMemberWrite(director, null, { role, status: "ACTIVE" }), role).toEqual({ ok: true });
      expect(checkMemberWrite(founder, null, { role, status: "ACTIVE" }), role).toEqual({ ok: true });
    }
    expect(checkMemberWrite(viewer, null, { role: "STAFF" })).toEqual({ ok: false, error: READ_ONLY_REFUSAL });
  });

  it("reserves adding Admins and Directors for administrators", () => {
    expect(denied(checkMemberWrite(staff, null, { role: "ADMIN" }))).toBe(true);
    expect(denied(checkMemberWrite(staff, null, { role: "DIRECTOR" }))).toBe(true);
    expect(checkMemberWrite(admin, null, { role: "DIRECTOR" })).toEqual({ ok: true });
  });

  it("does not let a non-admin create an inactive member", () => {
    expect(denied(checkMemberWrite(staff, null, { role: "STAFF", status: "INACTIVE" }))).toBe(true);
  });
});
