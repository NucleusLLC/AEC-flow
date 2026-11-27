import { describe, expect, it } from "vitest";
import { canManagePasswords, canManagePractice, isReadOnlyRole } from "@/lib/password-policy";
import {
  DIRECTOR_ADMIN_ACTIONS,
  DIRECTOR_ADMIN_ONLY,
  OWN_LEAVE_REFUSAL,
  READ_ONLY_REFUSAL,
  canApproveFinance,
  canDo,
  canWrite,
  certificationWriteIsDecision,
  changeOrderWriteIsDecision,
  checkLeaveWrite,
  deniedFor,
  developmentResourceAction,
  isLeaveDecision,
  readOnlyWriteRefusal,
  type GatedAction,
  type IdentifiedActor,
  type LeaveSnapshot,
} from "./role-gates";

const ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "STAFF", "VIEWER"] as const;
const ALLOWED = new Set<string>(["ADMIN", "DIRECTOR"]);

/** Every D-6 action, written out so adding or dropping one is a visible change here. */
const EVERY_ACTION: GatedAction[] = [
  "invoice.issue",
  "invoice.send",
  "invoice.recordPayment",
  "invoice.void",
  "invoice.reissue",
  "invoice.reversePayment",
  "invoice.deleteDraft",
  "creditNote.issue",
  "creditNote.void",
  "contract.issue",
  "contract.void",
  "contract.delete",
  "contractTemplate.archive",
  "generalDocument.issue",
  "generalDocument.void",
  "generalDocument.supersede",
  "generalDocument.delete",
  "estimate.lock",
  "priceBook.replace",
  "normSet.replace",
  "generalConditions.replace",
  "estimateTemplates.replace",
  "wiki.replace",
  "email.send",
  "proposalTemplate.manage",
  "purchaseOrder.delete",
  "purchaseOrder.receive",
  "changeOrder.decide",
  "changeOrder.delete",
  "certification.decide",
  "development.finance",
  "team.manage",
  "leave.decide",
];

describe("the D-6 action list", () => {
  it("is exactly the actions this test names", () => {
    expect([...DIRECTOR_ADMIN_ACTIONS].sort()).toEqual([...EVERY_ACTION].sort());
  });
});

describe("canDo — each role x each action (Director/Admin only)", () => {
  for (const action of EVERY_ACTION) {
    for (const role of ROLES) {
      const expected = ALLOWED.has(role);
      it(`${role} ${expected ? "may" : "may not"} ${action}`, () => {
        expect(canDo(action, { role, isFounder: false })).toBe(expected);
        expect(deniedFor(action, { role, isFounder: false })).toBe(
          expected ? null : role === "VIEWER" ? READ_ONLY_REFUSAL : DIRECTOR_ADMIN_ONLY,
        );
      });
    }
    it(`the founder may ${action}, whatever the role on the row`, () => {
      for (const role of [...ROLES, null, undefined, ""]) {
        expect(canDo(action, { role, isFounder: true })).toBe(true);
        expect(deniedFor(action, { role, isFounder: true })).toBeNull();
      }
    });
    it(`no role at all may not ${action}`, () => {
      expect(canDo(action, { role: null, isFounder: false })).toBe(false);
      expect(canDo(action, { role: undefined, isFounder: false })).toBe(false);
      expect(canDo(action, { role: "", isFounder: false })).toBe(false);
    });
  }
});

describe("canWrite — VIEWER is read-only everywhere", () => {
  it("lets every role but VIEWER write", () => {
    for (const role of ROLES) {
      expect(canWrite({ role, isFounder: false }), role).toBe(role !== "VIEWER");
      expect(deniedFor("write", { role, isFounder: false }), role).toBe(role === "VIEWER" ? READ_ONLY_REFUSAL : null);
    }
  });

  it("never makes the founder read-only", () => {
    expect(canWrite({ role: "VIEWER", isFounder: true })).toBe(true);
    expect(isReadOnlyRole("VIEWER", true)).toBe(false);
  });
});

describe("the aliases are the same set as canManagePasswords", () => {
  it("canManagePractice and canApproveFinance agree with canManagePasswords for every role", () => {
    for (const role of [...ROLES, null, undefined, "", "MEMBER"]) {
      for (const isFounder of [true, false]) {
        const base = canManagePasswords(role, isFounder);
        expect(canManagePractice(role, isFounder)).toBe(base);
        expect(canApproveFinance(role, isFounder)).toBe(base);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Leave                                                               */
/* ------------------------------------------------------------------ */

const pending: LeaveSnapshot = {
  userId: "u-staff",
  status: "PENDING",
  type: "ANNUAL",
  startDate: "2026-12-01",
  endDate: "2026-12-05",
  days: 5,
};
const approved: LeaveSnapshot = { ...pending, status: "APPROVED" };

const actorOf = (role: string, id = `u-${role.toLowerCase()}`, isFounder = false): IdentifiedActor => ({
  id,
  role,
  isFounder,
});

describe("isLeaveDecision", () => {
  it("filing or editing a pending request is not a decision", () => {
    expect(isLeaveDecision(null, pending)).toBe(false);
    expect(isLeaveDecision(pending, { ...pending, days: 4, endDate: "2026-12-04" })).toBe(false);
    expect(isLeaveDecision(pending, { ...pending, status: "CANCELLED" })).toBe(false);
  });

  it("approving, rejecting, filing pre-approved, or re-opening a decided request is a decision", () => {
    expect(isLeaveDecision(pending, approved)).toBe(true);
    expect(isLeaveDecision(pending, { ...pending, status: "REJECTED" })).toBe(true);
    expect(isLeaveDecision(null, approved)).toBe(true);
    expect(isLeaveDecision(approved, pending)).toBe(true);
  });

  it("changing the terms of approved leave is a decision; leaving them is not", () => {
    expect(isLeaveDecision(approved, { ...approved, endDate: "2026-12-12", days: 10 })).toBe(true);
    expect(isLeaveDecision(approved, { ...approved, userId: "u-other" })).toBe(true);
    expect(isLeaveDecision(approved, { ...approved })).toBe(false);
  });
});

describe("checkLeaveWrite — each role", () => {
  for (const role of ROLES) {
    it(`${role}: filing a pending request for themselves`, () => {
      const me = actorOf(role);
      const res = checkLeaveWrite(me, null, { ...pending, userId: me.id });
      expect(res.ok).toBe(role !== "VIEWER");
      if (!res.ok) expect(res.error).toBe(READ_ONLY_REFUSAL);
    });

    it(`${role}: approving a colleague's request`, () => {
      const res = checkLeaveWrite(actorOf(role), pending, approved);
      expect(res.ok).toBe(ALLOWED.has(role));
      if (!res.ok) expect(res.error).toBe(role === "VIEWER" ? READ_ONLY_REFUSAL : DIRECTOR_ADMIN_ONLY);
    });

    it(`${role}: approving their OWN request is refused`, () => {
      const me = actorOf(role);
      const mine = { ...pending, userId: me.id };
      const res = checkLeaveWrite(me, mine, { ...mine, status: "APPROVED" });
      expect(res.ok).toBe(false);
    });
  }

  it("refuses a Director approving their own leave with the own-leave sentence", () => {
    const director = actorOf("DIRECTOR");
    const mine = { ...pending, userId: director.id };
    expect(checkLeaveWrite(director, mine, { ...mine, status: "APPROVED" })).toEqual({ ok: false, error: OWN_LEAVE_REFUSAL });
    expect(checkLeaveWrite(director, mine, { ...mine, status: "REJECTED" })).toEqual({ ok: false, error: OWN_LEAVE_REFUSAL });
    expect(checkLeaveWrite(director, null, { ...mine, status: "APPROVED" })).toEqual({ ok: false, error: OWN_LEAVE_REFUSAL });
  });

  it("refuses the founder approving their own leave too", () => {
    const founder = actorOf("DIRECTOR", "u-founder", true);
    const mine = { ...pending, userId: founder.id };
    expect(checkLeaveWrite(founder, mine, { ...mine, status: "APPROVED" })).toEqual({ ok: false, error: OWN_LEAVE_REFUSAL });
  });

  it("refuses an Admin extending their own approved leave", () => {
    const admin = actorOf("ADMIN");
    const mine = { ...approved, userId: admin.id };
    expect(checkLeaveWrite(admin, mine, { ...mine, endDate: "2026-12-19", days: 15 }).ok).toBe(false);
  });

  it("refuses moving someone's request onto oneself or off oneself while deciding it", () => {
    const director = actorOf("DIRECTOR");
    expect(checkLeaveWrite(director, pending, { ...approved, userId: director.id }).ok).toBe(false);
    const mine = { ...pending, userId: director.id };
    expect(checkLeaveWrite(director, mine, { ...approved, userId: "u-colleague" }).ok).toBe(false);
  });

  it("lets a STAFF member edit the reason-free terms of their own pending request", () => {
    const staff = actorOf("STAFF");
    const mine = { ...pending, userId: staff.id };
    expect(checkLeaveWrite(staff, mine, { ...mine, endDate: "2026-12-03", days: 3 })).toEqual({ ok: true });
  });

  it("lets a Director approve a colleague's request", () => {
    expect(checkLeaveWrite(actorOf("DIRECTOR"), pending, approved)).toEqual({ ok: true });
  });
});

/* ------------------------------------------------------------------ */
/* Construction administration and development                         */
/* ------------------------------------------------------------------ */

describe("changeOrderWriteIsDecision", () => {
  it("drafting and submitting are not decisions", () => {
    expect(changeOrderWriteIsDecision(null, undefined)).toBe(false);
    expect(changeOrderWriteIsDecision(null, "SUBMITTED")).toBe(false);
    expect(changeOrderWriteIsDecision("DRAFT", "UNDER_REVIEW")).toBe(false);
    expect(changeOrderWriteIsDecision("SUBMITTED", undefined)).toBe(false);
  });

  it("approving, rejecting, voiding — or touching one that is — are", () => {
    for (const s of ["APPROVED", "REJECTED", "VOID"]) {
      expect(changeOrderWriteIsDecision(null, s), s).toBe(true);
      expect(changeOrderWriteIsDecision("SUBMITTED", s), s).toBe(true);
      expect(changeOrderWriteIsDecision(s, undefined), s).toBe(true);
      expect(changeOrderWriteIsDecision(s, "DRAFT"), s).toBe(true);
    }
  });
});

describe("certificationWriteIsDecision", () => {
  it("a draft is not a decision; issuing and approving are", () => {
    expect(certificationWriteIsDecision(null, undefined)).toBe(false);
    expect(certificationWriteIsDecision("DRAFT", "DRAFT")).toBe(false);
    expect(certificationWriteIsDecision("DRAFT", "ARCHIVED")).toBe(false);
    for (const s of ["ISSUED", "APPROVED"]) {
      expect(certificationWriteIsDecision(null, s), s).toBe(true);
      expect(certificationWriteIsDecision("DRAFT", s), s).toBe(true);
      expect(certificationWriteIsDecision(s, undefined), s).toBe(true);
    }
  });
});

describe("developmentResourceAction", () => {
  it("money and commitments are Director/Admin; the rest is an ordinary write", () => {
    for (const r of ["payments", "invoices", "contracts", "sales-contracts", "reservations"]) {
      expect(developmentResourceAction(r), r).toBe("development.finance");
    }
    for (const r of ["budget", "cash-flow", "documents", "land", "lots", "permits", "units", "vendors", ""]) {
      expect(developmentResourceAction(r), r).toBe("write");
    }
  });
});

/* ------------------------------------------------------------------ */
/* The database backstop                                               */
/* ------------------------------------------------------------------ */

describe("readOnlyWriteRefusal", () => {
  const base = { isFounder: false, inServerAction: true, explicitCompany: false };

  it("refuses a VIEWER writing from a server action", () => {
    expect(readOnlyWriteRefusal({ ...base, role: "VIEWER" })).toBe(READ_ONLY_REFUSAL);
  });

  it("lets every other role write", () => {
    for (const role of ["ADMIN", "DIRECTOR", "MANAGER", "STAFF"]) {
      expect(readOnlyWriteRefusal({ ...base, role }), role).toBeNull();
    }
  });

  it("leaves page renders, session-less proven-company callers, nobody signed in and the founder alone", () => {
    expect(readOnlyWriteRefusal({ ...base, role: "VIEWER", inServerAction: false })).toBeNull();
    expect(readOnlyWriteRefusal({ ...base, role: "VIEWER", explicitCompany: true })).toBeNull();
    expect(readOnlyWriteRefusal({ ...base, role: null })).toBeNull();
    expect(readOnlyWriteRefusal({ ...base, role: "VIEWER", isFounder: true })).toBeNull();
  });
});
