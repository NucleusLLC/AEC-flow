import { describe, it, expect } from "vitest";
import {
  allowedTransitions,
  canTransition,
  assertTransition,
  isLocked,
  isIssued,
  isOpen,
  InvalidTransitionError,
  STATUS_LABEL,
  type ServiceProposalStatus,
} from "./status";

describe("status transitions", () => {
  it("allows the normal happy path end to end", () => {
    const path: ServiceProposalStatus[] = [
      "DRAFT",
      "INTERNAL_REVIEW",
      "APPROVED_FOR_ISSUE",
      "SENT",
      "UNDER_CLIENT_REVIEW",
      "ACCEPTED",
      "CONVERTED",
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("allows the revision loop", () => {
    expect(canTransition("SENT", "REVISION_REQUESTED")).toBe(true);
    expect(canTransition("REVISION_REQUESTED", "REVISED")).toBe(true);
    expect(canTransition("REVISED", "SENT")).toBe(true);
  });

  it("rejects jumps that would break the audit trail", () => {
    // Nothing can be accepted without ever having been issued.
    expect(canTransition("DRAFT", "ACCEPTED")).toBe(false);
    expect(canTransition("DRAFT", "SENT")).toBe(false);
    expect(canTransition("INTERNAL_REVIEW", "ACCEPTED")).toBe(false);
    expect(canTransition("REJECTED", "ACCEPTED")).toBe(false);
  });

  it("treats withdrawn, superseded and converted as terminal", () => {
    expect(allowedTransitions("WITHDRAWN")).toEqual([]);
    expect(allowedTransitions("SUPERSEDED")).toEqual([]);
    expect(allowedTransitions("CONVERTED")).toEqual([]);
  });

  it("throws a descriptive error from the service-layer guard", () => {
    expect(() => assertTransition("DRAFT", "ACCEPTED")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("DRAFT", "ACCEPTED")).toThrow(/Draft.*Accepted/);
    expect(() => assertTransition("DRAFT", "INTERNAL_REVIEW")).not.toThrow();
  });

  it("never lists a transition to itself", () => {
    for (const s of Object.keys(STATUS_LABEL) as ServiceProposalStatus[]) {
      expect(allowedTransitions(s)).not.toContain(s);
    }
  });

  it("labels every status", () => {
    for (const s of Object.keys(STATUS_LABEL) as ServiceProposalStatus[]) {
      expect(STATUS_LABEL[s]).toBeTruthy();
    }
  });
});

describe("status predicates", () => {
  it("locks accepted and converted proposals against edits", () => {
    expect(isLocked("ACCEPTED")).toBe(true);
    expect(isLocked("PARTIALLY_ACCEPTED")).toBe(true);
    expect(isLocked("CONVERTED")).toBe(true);
    expect(isLocked("SUPERSEDED")).toBe(true);
    expect(isLocked("DRAFT")).toBe(false);
    expect(isLocked("SENT")).toBe(false);
  });

  it("treats anything the client has seen as issued", () => {
    expect(isIssued("SENT")).toBe(true);
    expect(isIssued("ACCEPTED")).toBe(true);
    expect(isIssued("DRAFT")).toBe(false);
    expect(isIssued("INTERNAL_REVIEW")).toBe(false);
  });

  it("counts pre-decision statuses as open pipeline", () => {
    expect(isOpen("DRAFT")).toBe(true);
    expect(isOpen("SENT")).toBe(true);
    expect(isOpen("ACCEPTED")).toBe(false);
    expect(isOpen("REJECTED")).toBe(false);
    expect(isOpen("EXPIRED")).toBe(false);
  });

  it("keeps locked and open mutually exclusive", () => {
    for (const s of Object.keys(STATUS_LABEL) as ServiceProposalStatus[]) {
      expect(isLocked(s) && isOpen(s)).toBe(false);
    }
  });
});
