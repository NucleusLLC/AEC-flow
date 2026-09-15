import { describe, expect, it } from "vitest";
import {
  bandPermits,
  daysWithAuthority,
  filterPermits,
  isResponseDueSoon,
  isResponseOverdue,
  lapsedMonths,
  militaryDate,
  monthsBetween,
  nextPermitReference,
  permitVersion,
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
    latestSubmissionAt: null,
    letters: [],
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

describe("militaryDate", () => {
  it("writes day, lettered month and year", () => {
    expect(militaryDate("2026-09-15")).toBe("15 SEP 2026");
    expect(militaryDate("2027-01-03")).toBe("03 JAN 2027");
  });

  it("reads the calendar day off an ISO timestamp without a timezone shift", () => {
    expect(militaryDate("2026-12-31T23:30:00.000Z")).toBe("31 DEC 2026");
  });

  it("renders a dash for nothing and for nonsense", () => {
    expect(militaryDate(null)).toBe("—");
    expect(militaryDate("")).toBe("—");
    expect(militaryDate("2026-13-01")).toBe("—");
    expect(militaryDate("15/09/2026")).toBe("—");
  });
});

describe("monthsBetween", () => {
  it("counts whole calendar months exactly, whatever the month lengths", () => {
    expect(monthsBetween("2026-01-15", "2026-07-15")).toBe(6);
    expect(monthsBetween("2025-09-15", "2026-09-15")).toBe(12);
  });

  it("clamps to the end of a short month", () => {
    expect(monthsBetween("2026-01-31", "2026-02-28")).toBe(1);
  });

  it("gives the remainder as a fraction of the month it falls in", () => {
    // 15 of February's 28 days after 01 FEB.
    expect(monthsBetween("2026-01-01", "2026-02-16")).toBe(1.5);
    expect(monthsBetween("2026-03-01", "2026-03-04")).toBe(0.1);
  });

  it("never goes negative and ignores unparseable dates", () => {
    expect(monthsBetween("2026-05-01", "2026-05-01")).toBe(0);
    expect(monthsBetween("2026-05-10", "2026-05-01")).toBe(0);
    expect(monthsBetween("nope", "2026-05-01")).toBeNull();
  });
});

describe("lapsedMonths", () => {
  it("is null until the file is submitted", () => {
    expect(lapsedMonths(permit(), TODAY)).toBeNull();
  });

  it("runs to today while the permit is not ready", () => {
    expect(lapsedMonths(permit({ submittedAt: "2026-03-03" }), TODAY)).toEqual({
      months: 6,
      running: true,
    });
  });

  it("stops at the permit ready date", () => {
    expect(
      lapsedMonths(permit({ submittedAt: "2026-01-03", issuedAt: "2026-05-03" }), TODAY),
    ).toEqual({ months: 4, running: false });
  });
});

describe("permitVersion", () => {
  it("has no version before anything was submitted", () => {
    expect(permitVersion(permit())).toBeNull();
  });

  it("is V1 when the submitted date was typed but no trip was logged", () => {
    expect(permitVersion(permit({ submittedAt: "2026-02-01" }))).toEqual({
      version: 1,
      submittedAt: "2026-02-01",
    });
  });

  it("counts resubmissions and dates the version by the latest one", () => {
    expect(
      permitVersion(
        permit({ submittedAt: "2026-02-01", submissionCount: 3, latestSubmissionAt: "2026-08-20" }),
      ),
    ).toEqual({ version: 3, submittedAt: "2026-08-20" });
  });
});

describe("filterPermits over letters", () => {
  it("finds a permit by a letter's reference", () => {
    const p = permit({
      letters: [
        { id: "l1", direction: "INCOMING", letterRef: "DOW/2026/481", subject: "Missing sections", letterDate: null, pdf: null },
      ],
    });
    expect(filterPermits([p], { q: "dow/2026/481" })).toHaveLength(1);
  });
});
