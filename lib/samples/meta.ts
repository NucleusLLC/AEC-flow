/**
 * The small, dependency-free facts about the sample set: its version, its two
 * languages, how a sample is marked, and the module list the screens show.
 *
 * Kept apart from build.ts on purpose. build.ts imports the proposal engine and
 * the calculators to produce the rows; the Settings card and the founder panel
 * are client components and only need these constants, so they import this
 * file and none of that reaches the browser.
 */

/** Bump when the content changes in a way worth re-installing for. */
export const SAMPLE_SET_VERSION = 1;

export type SampleLang = "en" | "es";
export const SAMPLE_LANGS: readonly SampleLang[] = ["en", "es"];
export const isSampleLang = (v: unknown): v is SampleLang => v === "en" || v === "es";

/** The word every sample name starts with. */
export const SAMPLE_WORD: Record<SampleLang, string> = { en: "SAMPLE", es: "EJEMPLO" };
/** The prefix of every sample number. */
export const SAMPLE_NUMBER_PREFIX = "SMP-";

/**
 * What the founder panel and the Settings card call each group of rows.
 * `models` are Prisma delegate names; only the top-level record of each module
 * is listed, so a count is what a person would count on the screen.
 * The labels are the navigation's own, so they are already translated.
 */
export const SAMPLE_MODULES: { key: string; label: string; models: string[] }[] = [
  { key: "clients", label: "Clients", models: ["client"] },
  { key: "projects", label: "Projects", models: ["project"] },
  { key: "serviceProposals", label: "Service Proposals", models: ["serviceProposal"] },
  { key: "estimates", label: "Estimates", models: ["costEstimate"] },
  { key: "schedule", label: "Schedule", models: ["projectSchedule"] },
  { key: "tasks", label: "Tasks", models: ["task"] },
  { key: "meetings", label: "Meeting Minutes", models: ["meetingMinute"] },
  { key: "permits", label: "Building Permits", models: ["buildingPermit"] },
  {
    key: "constructionAdmin",
    label: "Construction Admin",
    models: [
      "caReport",
      "changeOrder",
      "rfiLog",
      "siteInstruction",
      "submittalLog",
      "delayNotice",
      "progressCertification",
      "punchListItem",
    ],
  },
  { key: "procurement", label: "Procurement", models: ["purchaseOrder"] },
  { key: "materials", label: "Material Selection", models: ["materialSelection"] },
  { key: "deliverables", label: "Deliverables", models: ["designDeliverable"] },
  { key: "generalDocuments", label: "General Documents", models: ["generalDocument"] },
  { key: "contracts", label: "Contracts", models: ["constructionContract"] },
  { key: "invoices", label: "Invoices", models: ["invoice"] },
  { key: "time", label: "Time", models: ["timeEntry"] },
  { key: "expenses", label: "Expenses", models: ["expense"] },
];

export type SampleCounts = Record<string, number>;
