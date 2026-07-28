/**
 * Document type vocabulary.
 *
 * Deliberately narrow: it names the document types this application actually
 * produces today, plus the four the directive prioritises for build-out
 * (letter, memo, field report, custom). The full ~40-type list in directive §1
 * is NOT enumerated here — naming a type that has no template, no route and no
 * data model behind it would misrepresent what exists. Types get added here as
 * they are built. See docs/document-system/01-AUDIT.md §F4.
 */
export type DocumentType =
  // — existing, in production —
  | "proposal"
  | "serviceProposal"
  | "estimate"
  | "schedule"
  | "changeOrder"
  | "certification"
  | "rfi"
  | "caReport"
  | "punchList"
  | "meetingMinutes"
  | "order"
  | "purchaseOrder"
  | "materialsSchedule"
  | "transmittal"
  | "developmentReport"
  | "factSheet"
  | "register"
  | "invoice"
  // — prioritised for build-out (directive §42 Phase 5) —
  | "letter"
  | "memo"
  | "fieldReport"
  | "custom";

export type DocumentStatus = "draft" | "issued" | "superseded" | "void";
