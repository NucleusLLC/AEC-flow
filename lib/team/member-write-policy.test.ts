import { describe, it, expect } from "vitest";
import {
  canChangeMemberAccess,
  changedAccessFields,
  checkMemberWrite,
  type MemberAccessSnapshot,
  type MemberWriteActor,
} from "./member-write-policy";

const staff: MemberWriteActor = { id: "u-staff", role: "STAFF", isFounder: false };
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
  it("lets anyone edit ordinary fields (no access field changes)", () => {
    expect(checkMemberWrite(staff, colleague, { role: "STAFF", status: "ACTIVE", email: "col@firm.com" })).toEqual({ ok: true });
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

  it("still lets anyone edit the founder's ordinary fields", () => {
    expect(checkMemberWrite(staff, founderRow, { role: "DIRECTOR", status: "ACTIVE", email: "GREG@zenarch.net" })).toEqual({ ok: true });
  });
});

describe("checkMemberWrite — new members", () => {
  it("lets anyone add a directory entry at a non-administrative role", () => {
    for (const role of ["STAFF", "MANAGER", "VIEWER"]) {
      expect(checkMemberWrite(staff, null, { role, status: "ACTIVE" }), role).toEqual({ ok: true });
    }
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
