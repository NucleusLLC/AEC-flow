import { describe, it, expect } from "vitest";
import { can, assertCan, allowedActions, ProposalPermissionError } from "./permissions";
import type { ProposalAction } from "./permissions";

describe("role grants", () => {
  it("VIEWER can only view", () => {
    expect(can({ role: "VIEWER" }, "view")).toBe(true);
    expect(can({ role: "VIEWER" }, "create")).toBe(false);
    expect(can({ role: "VIEWER" }, "edit")).toBe(false);
    expect(can({ role: "VIEWER" }, "approve")).toBe(false);
  });

  it("STAFF (the beta default) gets the full day-to-day workflow", () => {
    // The A3 decision: beta testers are STAFF and must not be locked out.
    for (const a of ["view", "create", "edit", "editFees", "delete", "issue", "accept"] as ProposalAction[]) {
      expect(can({ role: "STAFF" }, a), `STAFF should be able to ${a}`).toBe(true);
    }
  });

  it("STAFF cannot approve, convert or configure", () => {
    expect(can({ role: "STAFF" }, "approve")).toBe(false);
    expect(can({ role: "STAFF" }, "convert")).toBe(false);
    expect(can({ role: "STAFF" }, "configure")).toBe(false);
  });

  it("MANAGER adds conversion but not approval or configuration", () => {
    expect(can({ role: "MANAGER" }, "convert")).toBe(true);
    expect(can({ role: "MANAGER" }, "approve")).toBe(false);
    expect(can({ role: "MANAGER" }, "configure")).toBe(false);
  });

  it("DIRECTOR and ADMIN can do everything", () => {
    const every: ProposalAction[] = [
      "view", "create", "edit", "editFees", "delete", "issue", "approve", "accept", "convert", "configure",
    ];
    for (const a of every) {
      expect(can({ role: "DIRECTOR" }, a)).toBe(true);
      expect(can({ role: "ADMIN" }, a)).toBe(true);
    }
  });
});

describe("status-driven restrictions apply regardless of role", () => {
  it("a locked (accepted) proposal cannot be edited or deleted even by an admin", () => {
    const accepted = { status: "ACCEPTED" as const };
    expect(can({ role: "ADMIN" }, "edit", accepted)).toBe(false);
    expect(can({ role: "ADMIN" }, "editFees", accepted)).toBe(false);
    expect(can({ role: "ADMIN" }, "delete", accepted)).toBe(false);
    // Non-mutating actions are still allowed.
    expect(can({ role: "ADMIN" }, "view", accepted)).toBe(true);
    expect(can({ role: "ADMIN" }, "convert", accepted)).toBe(true);
  });

  it("a converted or superseded proposal is likewise locked", () => {
    expect(can({ role: "ADMIN" }, "edit", { status: "CONVERTED" })).toBe(false);
    expect(can({ role: "ADMIN" }, "edit", { status: "SUPERSEDED" })).toBe(false);
  });

  it("an open draft is freely editable by an author role", () => {
    const draft = { status: "DRAFT" as const };
    expect(can({ role: "STAFF" }, "edit", draft)).toBe(true);
    expect(can({ role: "STAFF" }, "delete", draft)).toBe(true);
  });

  it("a sent (not yet accepted) proposal is still editable — locking is on acceptance", () => {
    // Editing a sent proposal is a role/workflow question, not a hard lock; only
    // accepted/converted/superseded are hard-locked here.
    expect(can({ role: "STAFF" }, "edit", { status: "SENT" })).toBe(true);
  });
});

describe("assertCan", () => {
  it("throws for a denied action", () => {
    expect(() => assertCan({ role: "VIEWER" }, "create")).toThrow(ProposalPermissionError);
    expect(() => assertCan({ role: "ADMIN" }, "edit", { status: "ACCEPTED" })).toThrow(
      ProposalPermissionError,
    );
  });

  it("passes for an allowed action", () => {
    expect(() => assertCan({ role: "STAFF" }, "create")).not.toThrow();
  });
});

describe("allowedActions", () => {
  it("returns the full grant for a role", () => {
    expect(allowedActions("VIEWER")).toEqual(["view"]);
    expect(allowedActions("STAFF")).toContain("create");
    expect(allowedActions("STAFF")).not.toContain("approve");
  });
});
