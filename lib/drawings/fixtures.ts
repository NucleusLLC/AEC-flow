/**
 * The accuracy fixture set. This is the evidence behind every number in
 * docs/drawings-intake/01-FEASIBILITY.md — if a claim there is not derived from
 * running `extraction.test.ts` over this file, it does not belong in the doc.
 *
 * HONESTY NOTES, because they change how the numbers should be read:
 *
 *  - The filenames are realistic but SYNTHETIC. They were written to cover the
 *    conventions the brief names plus the ones this codebase already emits
 *    (`lib/data/drawings.ts` ships `A-101`, `ID-501`, `M-401`, `S-301`), and
 *    they deliberately include hard and impossible cases. They are not a sample
 *    of one firm's server, so the measured rate is an upper bound on a firm
 *    with a naming standard and a lower bound on one without.
 *  - The title-block fixtures are hand-authored text in the shape pdf.js emits
 *    for a CAD title block, NOT text extracted from real PDFs — no PDF library
 *    is installed. They therefore measure the INTERPRETER, not the end-to-end
 *    pipeline. The reader is the untested half; see §5 of the doc.
 *  - `expected: null` means "correctly finding nothing". Those cases count
 *    towards accuracy, because a register needs blanks more than it needs
 *    guesses.
 */

import type { SheetDiscipline } from "./types";

export type FilenameFixture = {
  filename: string;
  /** What a competent human would fill in from the filename alone. */
  expected: {
    sheetNumber: string | null;
    discipline: SheetDiscipline | null;
    projectNumber: string | null;
    revision: string | null;
    issueDate: string | null;
    /** Loose match: case- and punctuation-insensitive. */
    title: string | null;
  };
  /** Set when the case is known-unsupported, so the doc can list it. */
  knownLimitation?: string;
};

export const FILENAME_FIXTURES: readonly FilenameFixture[] = [
  {
    filename: "A-101.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "A101.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "A-101_Rev-B.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: "B", issueDate: null, title: null },
  },
  {
    filename: "A-101 Rev B 2026-08-04.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: "B", issueDate: "2026-08-04", title: null },
  },
  {
    filename: "ZA-2026-121-A-101.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: "ZA-2026-121", revision: null, issueDate: null, title: null },
  },
  {
    filename: "ZA-2026-121_A-101_Ground-Floor-Plan_Rev-C_2026-05-18.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: "ZA-2026-121", revision: "C", issueDate: "2026-05-18", title: "Ground Floor Plan" },
  },
  {
    filename: "S-301 Foundation Layout Rev 02.dwg",
    expected: { sheetNumber: "S-301", discipline: "STRUCTURAL", projectNumber: null, revision: "02", issueDate: null, title: "Foundation Layout" },
  },
  {
    filename: "M-401_HVAC_Layout_Level_1.pdf",
    expected: { sheetNumber: "M-401", discipline: "MECHANICAL", projectNumber: null, revision: null, issueDate: null, title: "HVAC Layout Level 1" },
  },
  {
    filename: "E-501-Lighting-Plan.pdf",
    expected: { sheetNumber: "E-501", discipline: "ELECTRICAL", projectNumber: null, revision: null, issueDate: null, title: "Lighting Plan" },
  },
  {
    filename: "P-201_Rev.A_04-08-2026.pdf",
    expected: { sheetNumber: "P-201", discipline: "PLUMBING", projectNumber: null, revision: "A", issueDate: "2026-08-04", title: null },
  },
  {
    filename: "C-100 Site Grading 04 Aug 2026.pdf",
    expected: { sheetNumber: "C-100", discipline: "CIVIL", projectNumber: null, revision: null, issueDate: "2026-08-04", title: "Site Grading" },
  },
  {
    filename: "L-110_Landscape_Planting_Plan.pdf",
    expected: { sheetNumber: "L-110", discipline: "LANDSCAPE", projectNumber: null, revision: null, issueDate: null, title: "Landscape Planting Plan" },
  },
  {
    filename: "ID-501 Interior Layout and Finishes Rev A.pdf",
    expected: { sheetNumber: "ID-501", discipline: "INTERIORS", projectNumber: null, revision: "A", issueDate: null, title: "Interior Layout and Finishes" },
  },
  {
    filename: "FP-301_Fire_Protection_Riser.pdf",
    expected: { sheetNumber: "FP-301", discipline: "FIRE_PROTECTION", projectNumber: null, revision: null, issueDate: null, title: "Fire Protection Riser" },
  },
  {
    filename: "G-001 Cover Sheet.pdf",
    expected: { sheetNumber: "G-001", discipline: "GENERAL", projectNumber: null, revision: null, issueDate: null, title: "Cover Sheet" },
  },
  {
    filename: "A-201 North and East Elevations REV 3.pdf",
    expected: { sheetNumber: "A-201", discipline: "ARCHITECTURAL", projectNumber: null, revision: "3", issueDate: null, title: "North and East Elevations" },
  },
  {
    filename: "A-1002_Enlarged_Unit_Plans.pdf",
    expected: { sheetNumber: "A-1002", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: "Enlarged Unit Plans" },
  },
  {
    filename: "Downtown Retail Fit-out - ID-102 - Storefront Details - Rev A - 12-02-2026.pdf",
    expected: { sheetNumber: "ID-102", discipline: "INTERIORS", projectNumber: null, revision: "A", issueDate: "2026-02-12", title: "Downtown Retail Fit-out Storefront Details" },
  },
  {
    filename: "20260804_A-301_Wall_Sections.pdf",
    expected: { sheetNumber: "A-301", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: "2026-08-04", title: "Wall Sections" },
  },
  {
    filename: "A-101 (Rev B).pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: "B", issueDate: null, title: null },
  },
  {
    filename: "T-101_Data_Cabling.pdf",
    expected: { sheetNumber: "T-101", discipline: "TELECOM", projectNumber: null, revision: null, issueDate: null, title: "Data Cabling" },
  },
  {
    filename: "Marina Heights Tower Phase 2 A-101 Ground Floor Plan.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: "Marina Heights Tower Phase 2 Ground Floor Plan" },
  },
  {
    filename: "IFC_A-401_Stair_Details_Rev_2.pdf",
    expected: { sheetNumber: "A-401", discipline: "ARCHITECTURAL", projectNumber: null, revision: "2", issueDate: null, title: "IFC Stair Details" },
  },
  {
    filename: "A-101_REVISION_C.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: "C", issueDate: null, title: null },
  },
  {
    filename: "S-201 Rev.B 15-03-2026.dwg",
    expected: { sheetNumber: "S-201", discipline: "STRUCTURAL", projectNumber: null, revision: "B", issueDate: "2026-03-15", title: null },
  },
  {
    filename: "ZA_2026_121_S_301_Foundation_Rev_A.pdf",
    expected: { sheetNumber: "S-301", discipline: "STRUCTURAL", projectNumber: "ZA-2026-121", revision: "A", issueDate: null, title: "Foundation" },
  },
  {
    filename: "A-101 issue 4 2026-01-09.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: "4", issueDate: "2026-01-09", title: null },
  },
  {
    filename: "A-102-Second-Floor-Plan-Aug 4 2026.pdf",
    expected: { sheetNumber: "A-102", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: "2026-08-04", title: "Second Floor Plan" },
  },
  {
    filename: "EL-201_Power_Riser_Diagram.pdf",
    expected: { sheetNumber: "EL-201", discipline: "ELECTRICAL", projectNumber: null, revision: null, issueDate: null, title: "Power Riser Diagram" },
  },
  {
    filename: "A-101.1_Enlarged_Lobby_Plan.pdf",
    expected: { sheetNumber: "A-101.1", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: "Enlarged Lobby Plan" },
  },
  {
    filename: "E-101 and E-102 Combined.pdf",
    expected: { sheetNumber: "E-101", discipline: "ELECTRICAL", projectNumber: null, revision: null, issueDate: null, title: "and Combined" },
    knownLimitation: "Two sheet numbers in one name: the first is taken and a warning is raised.",
  },
  {
    filename: "Untitled.pdf",
    expected: { sheetNumber: null, discipline: null, projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "scan0012.pdf",
    expected: { sheetNumber: null, discipline: null, projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "DSC00123.pdf",
    expected: { sheetNumber: null, discipline: null, projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "A-1.01_Basement_Plan.pdf",
    expected: { sheetNumber: null, discipline: null, projectNumber: null, revision: null, issueDate: null, title: "A 1.01 Basement Plan" },
    knownLimitation:
      "Single-digit-then-dot sheet numbers (`A-1.01`) are not matched: loosening the number pattern that far starts matching version tags such as `v1.2`.",
  },
];

/* ------------------------------------------------------------------ *
 * Adversarial set
 * ------------------------------------------------------------------ */

/**
 * THE HONEST NUMBER LIVES HERE.
 *
 * `FILENAME_FIXTURES` above scores 100%, which is close to meaningless on its
 * own: the same person wrote the fixtures and the rules, so it measures
 * self-consistency, not accuracy. This second set is written the other way
 * round — messy names of the kind that actually accumulate on a project server
 * (Windows copy suffixes, mixed case, lock files, tender wrappers, bare
 * revisions, sheet ranges) — and `expected` is WHAT A COMPETENT HUMAN WOULD
 * TYPE INTO THE FORM, not what the parser happens to do.
 *
 * The rules were NOT adjusted afterwards to make these pass. Where the parser
 * misses, the miss is reported and named as a limitation in
 * docs/drawings-intake/01-FEASIBILITY.md §2.
 */
export const WILD_FILENAME_FIXTURES: readonly FilenameFixture[] = [
  {
    filename: "Copy of A-101 (2).pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "210 - Plans.pdf",
    expected: { sheetNumber: null, discipline: null, projectNumber: null, revision: null, issueDate: null, title: "Plans" },
  },
  {
    filename: "Villa_GF_Plan_final_v3.pdf",
    expected: { sheetNumber: null, discipline: null, projectNumber: null, revision: null, issueDate: null, title: "Villa GF Plan final v3" },
  },
  {
    filename: "A101-A199 Architectural Set.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: "Architectural Set" },
  },
  {
    filename: "2026.08.04 - A-101 - Ground Floor Plan.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: "2026-08-04", title: "Ground Floor Plan" },
  },
  {
    filename: "RFI-023 Response A-101 markup.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: "RFI-023 Response markup" },
  },
  {
    filename: "MEP Coordination Model M-201 Rev B.dwg",
    expected: { sheetNumber: "M-201", discipline: "MECHANICAL", projectNumber: null, revision: "B", issueDate: null, title: "MEP Coordination Model" },
  },
  {
    filename: "S301.dwg",
    expected: { sheetNumber: "S-301", discipline: "STRUCTURAL", projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "A-101-Rev-C-FINAL-FINAL.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: "C", issueDate: null, title: null },
  },
  {
    filename: "Ground floor plan.pdf",
    expected: { sheetNumber: null, discipline: null, projectNumber: null, revision: null, issueDate: null, title: "Ground floor plan" },
  },
  {
    filename: "Tender Issue 2026-06-30 A-201.pdf",
    expected: { sheetNumber: "A-201", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: "2026-06-30", title: "Tender Issue" },
  },
  {
    filename: "A-101_A-102_A-103.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "dwg_a-101_rev_b.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: "B", issueDate: null, title: null },
  },
  {
    filename: "Emirates Hills Villa - Structural GA - S-301 - B - 05.03.2026.pdf",
    expected: { sheetNumber: "S-301", discipline: "STRUCTURAL", projectNumber: null, revision: "B", issueDate: "2026-03-05", title: "Emirates Hills Villa Structural GA" },
  },
  {
    filename: "A-101 REV.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "Ph2_A-101.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: "Ph2" },
  },
  {
    filename: "A-101 Ground Floor Plan REV B 04 August 2026.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: "B", issueDate: "2026-08-04", title: "Ground Floor Plan" },
  },
  {
    filename: "A-101 [SUPERSEDED].pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: null, title: null },
  },
  {
    filename: "Site Plan - Rev 12 - 31-12-2025.pdf",
    expected: { sheetNumber: null, discipline: null, projectNumber: null, revision: "12", issueDate: "2025-12-31", title: "Site Plan" },
  },
  {
    filename: "Approved_A-101_2026-08-04.pdf",
    expected: { sheetNumber: "A-101", discipline: "ARCHITECTURAL", projectNumber: null, revision: null, issueDate: "2026-08-04", title: "Approved" },
  },
];

/* ------------------------------------------------------------------ *
 * Title-block fixtures
 * ------------------------------------------------------------------ */

export type TitleBlockFixture = {
  name: string;
  /** Text in the shape a PDF text layer yields for a title block. */
  text: string;
  expected: {
    sheetNumber: string | null;
    projectNumber: string | null;
    projectName: string | null;
    revision: string | null;
    issueDate: string | null;
    title: string | null;
  };
  note?: string;
};

export const TITLE_BLOCK_FIXTURES: readonly TitleBlockFixture[] = [
  {
    name: "US National CAD Standard, label and value on the same line",
    text: [
      "ZAHA ARCHITECTS",
      "PROJECT: Marina Heights Tower - Phase 2",
      "PROJECT NO: ZA-2026-014",
      "SHEET TITLE: Ground Floor Plan",
      "SHEET NO: A-101",
      "REVISION: C",
      "DATE: 2026-04-08",
      "SCALE: 1:100",
      "DRAWN BY: IM",
    ].join("\n"),
    expected: {
      sheetNumber: "A-101",
      projectNumber: "ZA-2026-014",
      projectName: "Marina Heights Tower - Phase 2",
      revision: "C",
      issueDate: "2026-04-08",
      title: "Ground Floor Plan",
    },
  },
  {
    name: "CAD export, label above value on separate lines",
    text: [
      "PROJECT",
      "Saadiyat Cultural Pavilion",
      "PROJECT NUMBER",
      "ZA-2026-011",
      "DRAWING TITLE",
      "Pavilion Sections",
      "DRAWING NO.",
      "A-205",
      "REV",
      "A",
      "DATE",
      "02.06.2026",
    ].join("\n"),
    expected: {
      sheetNumber: "A-205",
      projectNumber: "ZA-2026-011",
      projectName: "Saadiyat Cultural Pavilion",
      revision: "A",
      issueDate: "2026-06-02",
      title: "Pavilion Sections",
    },
  },
  {
    name: "ISO 7200 style, all caps, DD MMM YYYY",
    text: [
      "PROJECT NAME  EMIRATES HILLS PRIVATE VILLA",
      "JOB NO.  ZA-2026-006",
      "TITLE  STRUCTURAL GENERAL ARRANGEMENT",
      "DRG NO.  S-301",
      "REV NO.  B",
      "ISSUE DATE  12 JUN 2026",
    ].join("\n"),
    expected: {
      sheetNumber: "S-301",
      projectNumber: "ZA-2026-006",
      projectName: "Emirates Hills Private Villa",
      revision: "B",
      issueDate: "2026-06-12",
      title: "Structural General Arrangement",
    },
  },
  {
    name: "Consultant block with a house sheet code the scanners do not recognise",
    text: [
      "PROJECT: Downtown Retail Fit-out",
      "COMMISSION NO: 7734-B",
      "SHEET TITLE: Concourse Layout",
      "SHEET NUMBER: XX-0102",
      "REV: 03",
      "PLOT DATE: 10/01/2026",
    ].join("\n"),
    expected: {
      sheetNumber: "XX-0102",
      projectNumber: "7734-B",
      projectName: "Downtown Retail Fit-out",
      revision: "03",
      issueDate: "2026-01-10",
      title: "Concourse Layout",
    },
    note: "The label vouches for a code the blind scanner would refuse; this is what pass 1 buys.",
  },
  {
    name: "No labels at all — blind scan only",
    text: ["MARINA HEIGHTS TOWER", "A-201", "REV B", "22-05-2026"].join("\n"),
    expected: {
      sheetNumber: "A-201",
      projectNumber: null,
      projectName: null,
      revision: "B",
      issueDate: "2026-05-22",
      title: null,
    },
    note: "Project name is unrecoverable without a label — a line of capitals could be anything.",
  },
  {
    name: "General notes only — nothing to find",
    text: [
      "GENERAL NOTES",
      "1. ALL DIMENSIONS IN MILLIMETRES UNLESS NOTED OTHERWISE.",
      "2. DO NOT SCALE FROM THIS DRAWING.",
      "3. REPORT ALL DISCREPANCIES TO THE ARCHITECT.",
    ].join("\n"),
    expected: {
      sheetNumber: null,
      projectNumber: null,
      projectName: null,
      revision: null,
      issueDate: null,
      title: null,
    },
  },
  {
    name: "Empty text layer (scanned sheet)",
    text: "",
    expected: {
      sheetNumber: null,
      projectNumber: null,
      projectName: null,
      revision: null,
      issueDate: null,
      title: null,
    },
  },
];
