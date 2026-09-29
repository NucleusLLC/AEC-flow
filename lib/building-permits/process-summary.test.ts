import { describe, expect, it } from "vitest";
import { dayDiff, dossier, openActions, processSummary, processTimeline } from "./process-summary";
import type { BuildingPermitDTO } from "./types";

/** Just the fields the summary reads; the rest of the DTO is irrelevant here. */
function permit(over: Partial<BuildingPermitDTO> = {}): BuildingPermitDTO {
  return {
    id: "p1",
    reference: "BP-2026-004",
    permitNumber: null,
    title: "Villa Verde",
    permitType: "NEW_BUILD",
    status: "INFO_REQUESTED",
    authority: "DOW",
    authorityContact: null,
    siteAddress: "Palm Beach 12",
    parcelNumber: "E-123",
    applicantName: "J. Croes",
    submittedAt: "2026-06-01",
    acknowledgedAt: "2026-06-05",
    conceptApprovalAt: null,
    conceptApprovalRef: null,
    decisionAt: null,
    issuedAt: null,
    expiresAt: null,
    targetDecisionAt: "2026-10-30",
    feePaidAt: null,
    notes: null,
    submissions: [
      { id: "s2", submittedAt: "2026-08-20", method: "EMAIL", contents: "Revised fire escape", receiptNumber: null },
      { id: "s1", submittedAt: "2026-06-01", method: "COUNTER", contents: "Full set", receiptNumber: "R-88" },
    ],
    meetings: [
      { id: "m1", heldAt: "2026-07-10", subject: "Review with DOW", decisions: "Move stair", followUp: "Send revised plan" },
    ],
    correspondence: [
      {
        id: "l1",
        direction: "INCOMING",
        letterDate: "2026-07-02",
        receivedAt: null,
        letterRef: "DOW/481",
        party: "DOW",
        subject: "Missing fire escape",
        summary: null,
        requiresResponse: true,
        responseDueAt: "2026-09-20",
        respondedAt: null,
      },
      {
        id: "l2",
        direction: "OUTGOING",
        letterDate: "2026-08-20",
        receivedAt: null,
        letterRef: null,
        party: "DOW",
        subject: "Revised drawings",
        summary: null,
        requiresResponse: false,
        responseDueAt: null,
        respondedAt: null,
      },
    ],
    approvals: [{ id: "a1", stage: "ZONING", status: "PENDING", decidedAt: null, refNumber: null, conditions: null }],
    submissionCount: 2,
    latestSubmissionAt: "2026-08-20",
    ...over,
  } as unknown as BuildingPermitDTO;
}

describe("processTimeline", () => {
  it("puts every dated event in one list, oldest first", () => {
    const kinds = processTimeline(permit()).map((e) => `${e.date} ${e.kind}`);
    expect(kinds).toEqual([
      "2026-06-01 APPLICATION",
      "2026-06-05 MILESTONE",
      "2026-07-02 LETTER_IN",
      "2026-07-10 MEETING",
      "2026-08-20 VERSION",
      "2026-08-20 LETTER_OUT",
    ]);
  });

  it("numbers versions in submission order, whatever order they are stored in", () => {
    const versions = processTimeline(permit()).filter((e) => e.kind === "APPLICATION" || e.kind === "VERSION");
    expect(versions.map((e) => e.vars.n)).toEqual([1, 2]);
    expect(versions[0].vars.method).toBe("At the counter");
  });

  it("falls back to the submitted date when no version is logged", () => {
    const events = processTimeline(permit({ submissions: [] }));
    expect(events[0]).toMatchObject({ date: "2026-06-01", kind: "APPLICATION" });
  });
});

describe("openActions", () => {
  it("lists an unanswered letter as overdue once its reply date has passed", () => {
    const actions = openActions(permit(), "2026-09-28");
    expect(actions[0]).toMatchObject({ dueAt: "2026-09-20", overdue: true });
    expect(actions[0].vars.ref).toBe("DOW/481");
  });

  it("includes pending approvals and meeting follow-ups", () => {
    const whats = openActions(permit(), "2026-09-28").map((a) => a.what);
    expect(whats).toContain("Awaiting {stage} approval");
    expect(whats).toContain("Follow up from meeting {date}: {action}");
  });
});

describe("processSummary", () => {
  it("counts the file", () => {
    const { facts } = processSummary(permit(), "2026-09-28");
    expect(facts).toMatchObject({
      versions: 2,
      meetings: 1,
      lettersIn: 1,
      lettersOut: 1,
      approvalsPending: 1,
      daysInProcess: dayDiff("2026-06-01", "2026-09-28"),
    });
  });
});

describe("dossier", () => {
  it("carries the facts the AI may use, in military dates", () => {
    const text = dossier(permit(), "2026-09-28");
    expect(text).toContain("TODAY: 28 SEP 2026");
    expect(text).toContain("V2 submitted (Email)");
    expect(text).toContain("due 20 SEP 2026 (OVERDUE)");
    expect(text).toContain("follow-up: Send revised plan");
  });
});
