import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPROVAL_STAGES,
  APPROVAL_STAGE_LABEL,
  APPROVAL_STATUSES,
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_TONE,
  CORRESPONDENCE_DIRECTIONS,
  CORRESPONDENCE_DIRECTION_LABEL,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  PERMIT_STATUSES,
  PERMIT_STATUS_LABEL,
  PERMIT_STATUS_TONE,
  PERMIT_TYPES,
  PERMIT_TYPE_LABEL,
  SUBMISSION_METHODS,
  SUBMISSION_METHOD_LABEL,
} from "./types";

/**
 * The tripwire promised in the header of types.ts.
 *
 * `lib/building-permits/types.ts` restates the schema's enums as string unions
 * so client components can import them without dragging the Prisma client into
 * the browser bundle. That restatement is a copy, and a copy drifts: adding a
 * value to the schema and forgetting the union produces a select that silently
 * cannot offer the new state, and a status the register renders as blank.
 *
 * This reads the schema as text — no database, no Prisma client — and fails the
 * build the moment the two disagree.
 */
const SCHEMA = readFileSync(resolve(__dirname, "../../prisma/schema.prisma"), "utf8");

function schemaEnum(name: string): string[] {
  const m = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`, "m").exec(SCHEMA);
  if (!m) throw new Error(`enum ${name} is not in prisma/schema.prisma`);
  return m[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => line.length > 0 && /^[A-Z0-9_]+$/.test(line));
}

const CASES: { enumName: string; values: readonly string[] }[] = [
  { enumName: "BuildingPermitType", values: PERMIT_TYPES },
  { enumName: "BuildingPermitStatus", values: PERMIT_STATUSES },
  { enumName: "BuildingPermitSubmissionMethod", values: SUBMISSION_METHODS },
  { enumName: "BuildingPermitCorrespondenceDirection", values: CORRESPONDENCE_DIRECTIONS },
  { enumName: "BuildingPermitApprovalStage", values: APPROVAL_STAGES },
  { enumName: "BuildingPermitApprovalStatus", values: APPROVAL_STATUSES },
  { enumName: "BuildingPermitDocumentCategory", values: DOCUMENT_CATEGORIES },
];

describe("the enum unions match prisma/schema.prisma", () => {
  for (const { enumName, values } of CASES) {
    it(`${enumName}`, () => {
      // Sets, not arrays: the app's display order is deliberately not the
      // schema's (statuses are listed in the order a file is lived).
      expect([...values].sort()).toEqual(schemaEnum(enumName).sort());
    });
  }
});

describe("every value has something to render", () => {
  const LABELLED: { name: string; values: readonly string[]; labels: Record<string, string> }[] = [
    { name: "permit type", values: PERMIT_TYPES, labels: PERMIT_TYPE_LABEL },
    { name: "permit status", values: PERMIT_STATUSES, labels: PERMIT_STATUS_LABEL },
    { name: "submission method", values: SUBMISSION_METHODS, labels: SUBMISSION_METHOD_LABEL },
    {
      name: "correspondence direction",
      values: CORRESPONDENCE_DIRECTIONS,
      labels: CORRESPONDENCE_DIRECTION_LABEL,
    },
    { name: "approval stage", values: APPROVAL_STAGES, labels: APPROVAL_STAGE_LABEL },
    { name: "approval status", values: APPROVAL_STATUSES, labels: APPROVAL_STATUS_LABEL },
    { name: "document category", values: DOCUMENT_CATEGORIES, labels: DOCUMENT_CATEGORY_LABEL },
  ];

  for (const { name, values, labels } of LABELLED) {
    it(`every ${name} has a label`, () => {
      for (const v of values) {
        expect(labels[v], `${name} ${v}`).toBeTruthy();
        // A label that is still the enum value means someone added a value and
        // left the screen shouting SPLIT_PARCEL at the user.
        expect(labels[v]).not.toBe(v);
      }
    });
  }

  it("every permit status has a badge tone", () => {
    for (const s of PERMIT_STATUSES) expect(PERMIT_STATUS_TONE[s]).toBeTruthy();
  });

  it("every approval status has a badge tone", () => {
    for (const s of APPROVAL_STATUSES) expect(APPROVAL_STATUS_TONE[s]).toBeTruthy();
  });
});
