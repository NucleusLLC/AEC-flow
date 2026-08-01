import { describe, it, expect } from "vitest";
import {
  DUPLICATE_COPIED_CHILDREN,
  DUPLICATE_EXCLUDED_CHILDREN,
  DUPLICATE_RESET_FIELDS,
  duplicateResetData,
  duplicateTitle,
  isProposalNumberTaken,
  normalizeProposalNumber,
  suggestDuplicateNumber,
} from "./duplicate";
import { nextProposalNumber } from "./persist";
import { INITIAL_VERSION, isIssuedVersion } from "./versioning";
import { serviceProposalInputSchema } from "./schema/proposal";

describe("suggestDuplicateNumber", () => {
  it("is the practice's own sequence helper, not a second scheme", () => {
    const existing = ["SP-2026-001", "SP-2026-002", "SP-2026-003"];
    expect(suggestDuplicateNumber(existing, 2026)).toBe(nextProposalNumber(existing, 2026));
  });

  it("adds one to the highest number the practice has used", () => {
    expect(suggestDuplicateNumber(["SP-2026-001"], 2026)).toBe("SP-2026-002");
    expect(suggestDuplicateNumber(["SP-2026-005", "SP-2026-002"], 2026)).toBe("SP-2026-006");
  });

  it("does not reuse the gap left by a deleted proposal", () => {
    // 002 is soft-deleted but its number is still in the list, so the copy gets 004.
    expect(suggestDuplicateNumber(["SP-2026-001", "SP-2026-003"], 2026)).toBe("SP-2026-004");
  });

  it("starts a practice with no proposals at 001", () => {
    expect(suggestDuplicateNumber([], 2026)).toBe("SP-2026-001");
  });

  it("never suggests a number that is already taken", () => {
    const existing = ["SP-2026-001", "SP-2026-002", "SP-2026-009"];
    const next = suggestDuplicateNumber(existing, 2026);
    expect(isProposalNumberTaken(existing, next)).toBe(false);
  });
});

describe("normalizeProposalNumber", () => {
  it("treats blank and whitespace as 'let the sequence decide'", () => {
    expect(normalizeProposalNumber("")).toBeNull();
    expect(normalizeProposalNumber("   ")).toBeNull();
    expect(normalizeProposalNumber(null)).toBeNull();
    expect(normalizeProposalNumber(undefined)).toBeNull();
  });

  it("trims a typed number", () => {
    expect(normalizeProposalNumber("  SP-2026-007 ")).toBe("SP-2026-007");
  });
});

describe("isProposalNumberTaken", () => {
  const existing = ["SP-2026-001", "SP-2026-002"];

  it("rejects an exact clash", () => {
    expect(isProposalNumberTaken(existing, "SP-2026-002")).toBe(true);
  });

  it("rejects a clash that differs only in case, which Postgres would allow", () => {
    expect(isProposalNumberTaken(existing, "sp-2026-002")).toBe(true);
  });

  it("rejects a clash that differs only in surrounding whitespace", () => {
    expect(isProposalNumberTaken(existing, " SP-2026-001 ")).toBe(true);
  });

  it("allows a free number", () => {
    expect(isProposalNumberTaken(existing, "SP-2026-003")).toBe(false);
  });

  it("says nothing about a blank candidate", () => {
    expect(isProposalNumberTaken(existing, "")).toBe(false);
  });
});

describe("duplicateResetData — what a copy must NOT inherit", () => {
  const reset = duplicateResetData();

  it("is a fresh draft at revision 1", () => {
    expect(reset.status).toBe("DRAFT");
    expect(reset.revision).toBe(1);
  });

  it("has never been issued or locked, and restarts the version scheme", () => {
    expect(reset.issuedAt).toBeNull();
    expect(reset.lockedAt).toBeNull();
    // A copy is a fresh draft, so it begins at 0.1 like any other new proposal — it must not
    // inherit the source's issued label, which would read as a version a client received.
    expect(reset.versionLabel).toBe(INITIAL_VERSION);
    expect(isIssuedVersion(reset.versionLabel)).toBe(false);
  });

  it("is live even when the source was soft-deleted", () => {
    expect(reset.deletedAt).toBeNull();
  });

  it("carries no one else's preparation, review, approval or ownership", () => {
    expect(reset.preparedById).toBeNull();
    expect(reset.reviewedById).toBeNull();
    expect(reset.approvedById).toBeNull();
    expect(reset.ownerId).toBeNull();
  });

  it("resets every field the documented list claims it does", () => {
    // `number` is in the list but is assigned by the sequence rather than reset to a literal,
    // so it is the one entry that is not a key of this object.
    for (const f of DUPLICATE_RESET_FIELDS) {
      if (f === "number") continue;
      expect(Object.keys(reset)).toContain(f);
    }
  });
});

describe("duplicate child-table rules", () => {
  it("copies the content children", () => {
    expect([...DUPLICATE_COPIED_CHILDREN]).toEqual([
      "disciplines",
      "phases",
      "feeComponents",
      "developmentCostItems",
      "paymentMilestones",
      "reimbursables",
      "discounts",
      "taxes",
    ]);
  });

  it("excludes the audit trail and shared files", () => {
    expect([...DUPLICATE_EXCLUDED_CHILDREN]).toEqual(["statusHistory", "versions", "attachments"]);
  });

  it("accounts for every child collection exactly once", () => {
    const all = [...DUPLICATE_COPIED_CHILDREN, ...DUPLICATE_EXCLUDED_CHILDREN];
    expect(new Set(all).size).toBe(all.length);
    // The 11 child collections of ServiceProposal in prisma/schema.prisma.
    expect(all.length).toBe(11);
  });
});

describe("duplicateTitle", () => {
  it("marks a copy", () => {
    expect(duplicateTitle("Palm Beach Residence")).toBe("Palm Beach Residence (copy)");
  });

  it("counts up instead of stacking suffixes", () => {
    expect(duplicateTitle("Palm Beach Residence (copy)")).toBe("Palm Beach Residence (copy 2)");
    expect(duplicateTitle("Palm Beach Residence (copy 2)")).toBe("Palm Beach Residence (copy 3)");
  });

  it("trims and copes with an empty title", () => {
    expect(duplicateTitle("  Villa  ")).toBe("Villa (copy)");
    expect(duplicateTitle("")).toBe("(copy)");
  });
});

describe("the number field on the proposal payload", () => {
  const base = { title: "Design services", currency: "USD" };

  it("accepts a blank number as 'assign it for me'", () => {
    expect(serviceProposalInputSchema.parse({ ...base, number: "" }).number).toBe("");
    expect(serviceProposalInputSchema.parse({ ...base, number: null }).number).toBeNull();
    expect(serviceProposalInputSchema.parse(base).number).toBeUndefined();
  });

  it("trims a typed number", () => {
    expect(serviceProposalInputSchema.parse({ ...base, number: "  SP-2026-007  " }).number).toBe("SP-2026-007");
  });

  it("rejects a number that is too short or absurdly long", () => {
    expect(serviceProposalInputSchema.safeParse({ ...base, number: "A" }).success).toBe(false);
    expect(serviceProposalInputSchema.safeParse({ ...base, number: "X".repeat(41) }).success).toBe(false);
  });

  it("reports a bad number on the `number` path so the form can highlight that input", () => {
    const r = serviceProposalInputSchema.safeParse({ ...base, number: "A" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["number"]);
  });
});
