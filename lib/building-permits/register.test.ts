import { describe, expect, it } from "vitest";
import {
  bandPermits,
  daysWithAuthority,
  filterPermits,
  isResponseDueSoon,
  isResponseOverdue,
  nextPermitReference,
  registerTotals,
  sortPermits,
  ymd,
} from "./register";
import { PERMIT_STATUS_LABEL, type BuildingPermitSummaryDTO } from "./types";

const TODAY = "2026-09-03";

function permit(over: Partial<BuildingPermitSummaryDTO> = {}): BuildingPermitSummaryDTO {
  return {
    id: over.reference ?? "id-1",
    reference: "BP-2026-001",
    permitNumber: null,
    title: "Villa Verde",
    permitType: "NEW_BUILD",
    status: "SUBMITTED",
    projectId: null,
    projectName: null,
    clientName: null,
    applicantName: null,
    siteAddress: null,
    parcelNumber: null,
    authority: null,
    submittedAt: null,
    conceptApprovalAt: null,
    decisionAt: null,
    issuedAt: null,
    expiresAt: null,
    targetDecisionAt: null,
    responsibleName: null,
    submissionCount: 0,
    meetingCount: 0,
    correspondenceCount: 0,
    documentCount: 0,
    openResponseDueAt: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("nextPermitReference", () => {
  it("starts the year's series at 001", () => {
    expect(nextPermitReference([], 2026)).toBe("BP-2026-001");
  });

  it("takes the highest trailing number, not the count", () => {
    // The count would say 003 here, and would collide with the file the office
    // already has on paper.
    expect(nextPermitReference(["BP-2026-001", "BP-2026-007"], 2026)).toBe("BP-2026-008");
  });

  it("keeps counting past a hand-typed reference in another shape", () => {
    expect(nextPermitReference(["DOW/2026/0042"], 2026)).toBe("BP-2026-043");
  });

  it("ignores references with no number at all", () => {
    expect(nextPermitReference(["legacy file"], 2026)).toBe("BP-2026-001");
  });
});

describe("response deadlines", () => {
  it("is overdue only once the date has passed", () => {
    expect(isResponseOverdue({ openResponseDueAt: "2026-09-02" }, TODAY)).toBe(true);
    expect(isResponseOverdue({ openResponseDueAt: TODAY }, TODAY)).toBe(false);
    expect(isResponseOverdue({ openResponseDueAt: null }, TODAY)).toBe(false);
  });

  it("is due soon inside the window, and not once it is already late", () => {
    expect(isResponseDueSoon({ openResponseDueAt: "2026-09-08" }, TODAY)).toBe(true);
    expect(isResponseDueSoon({ openResponseDueAt: "2026-09-30" }, TODAY)).toBe(false);
    expect(isResponseDueSoon({ openResponseDueAt: "2026-09-01" }, TODAY)).toBe(false);
  });
});

describe("daysWithAuthority", () => {
  it("is null before the file was submitted", () => {
    expect(daysWithAuthority({ submittedAt: null, decisionAt: null, issuedAt: null }, TODAY)).toBe(
      null,
    );
  });

  it("counts to today while the file is still open", () => {
    expect(
      daysWithAuthority({ submittedAt: "2026-08-24", decisionAt: null, issuedAt: null }, TODAY),
    ).toBe(10);
  });

  it("stops counting at the decision, not at today", () => {
    expect(
      daysWithAuthority(
        { submittedAt: "2026-08-24", decisionAt: "2026-08-31", issuedAt: null },
        TODAY,
      ),
    ).toBe(7);
  });

  it("prefers the issue date over the decision date", () => {
    expect(
      daysWithAuthority(
        { submittedAt: "2026-08-24", decisionAt: "2026-08-31", issuedAt: "2026-09-01" },
        TODAY,
      ),
    ).toBe(8);
  });
});

describe("filterPermits", () => {
  const rows = [
    permit({ reference: "BP-2026-001", status: "SUBMITTED", authority: "DOW" }),
    permit({ reference: "BP-2026-002", status: "ISSUED", authority: "DOW" }),
    permit({
      reference: "BP-2026-003",
      status: "DRAFT",
      permitType: "POOL",
      siteAddress: "Sasakiweg 12",
    }),
  ];

  it("matches everything when nothing is asked", () => {
    expect(filterPermits(rows, {}).length).toBe(3);
  });

  it("OPEN excludes the finished files", () => {
    const open = filterPermits(rows, { status: "OPEN" }).map((p) => p.reference);
    expect(open).toEqual(["BP-2026-001", "BP-2026-003"]);
  });

  it("searches the address and the parcel, not only the title", () => {
    expect(filterPermits(rows, { q: "sasakiweg" }).map((p) => p.reference)).toEqual([
      "BP-2026-003",
    ]);
  });

  it("combines filters rather than replacing them", () => {
    expect(filterPermits(rows, { status: "OPEN", authority: "DOW" }).map((p) => p.reference)).toEqual(
      ["BP-2026-001"],
    );
  });
});

describe("sortPermits", () => {
  const rows = [
    permit({ reference: "BP-2026-001", submittedAt: null }),
    permit({ reference: "BP-2026-002", submittedAt: "2026-07-01" }),
    permit({ reference: "BP-2026-003", submittedAt: "2026-08-01" }),
  ];

  it("sinks the empty column to the bottom ascending", () => {
    expect(sortPermits(rows, "submitted", "asc").map((p) => p.reference)).toEqual([
      "BP-2026-002",
      "BP-2026-003",
      "BP-2026-001",
    ]);
  });

  it("keeps it at the bottom descending too — a null is not the epoch", () => {
    expect(sortPermits(rows, "submitted", "desc").map((p) => p.reference)).toEqual([
      "BP-2026-003",
      "BP-2026-002",
      "BP-2026-001",
    ]);
  });

  it("does not mutate its input", () => {
    const before = rows.map((p) => p.reference);
    sortPermits(rows, "submitted", "desc");
    expect(rows.map((p) => p.reference)).toEqual(before);
  });
});

describe("bandPermits", () => {
  const label = (s: keyof typeof PERMIT_STATUS_LABEL) => PERMIT_STATUS_LABEL[s];

  it("keeps one band when banding is off", () => {
    const bands = bandPermits([permit(), permit({ reference: "BP-2026-002" })], "none", label);
    expect(bands).toHaveLength(1);
    expect(bands[0].permits).toHaveLength(2);
  });

  it("names a missing authority rather than showing an empty band header", () => {
    const bands = bandPermits([permit({ authority: null })], "authority", label);
    expect(bands[0].label).toBe("No authority recorded");
  });

  it("loses no rows", () => {
    const rows = [
      permit({ reference: "a", status: "DRAFT" }),
      permit({ reference: "b", status: "ISSUED" }),
      permit({ reference: "c", status: "DRAFT" }),
    ];
    const bands = bandPermits(rows, "status", label);
    expect(bands.flatMap((b) => b.permits)).toHaveLength(3);
  });
});

describe("registerTotals", () => {
  it("counts open, waiting, approved, issued and overdue independently", () => {
    const totals = registerTotals(
      [
        permit({ reference: "a", status: "SUBMITTED", openResponseDueAt: "2026-08-01" }),
        permit({ reference: "b", status: "CONCEPT_APPROVED", conceptApprovalAt: "2026-08-10" }),
        permit({ reference: "c", status: "ISSUED", issuedAt: "2026-08-20" }),
      ],
      TODAY,
    );
    expect(totals).toEqual({
      total: 3,
      open: 2,
      awaitingAuthority: 1,
      conceptApproved: 1,
      issued: 1,
      overdueResponses: 1,
    });
  });
});

describe("ymd", () => {
  it("formats a local date without drifting a day", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
