/**
 * ARCHITECTURE TYPE on a project — the rules, kept free of Prisma so they test
 * and so the `"use client"` project form can import them.
 *
 * ─── WHAT IT IS ───────────────────────────────────────────────────────────────
 * ARCHITECTURE is one of the project's disciplines (a value of the shared
 * Discipline enum, ticked in the form's Disciplines row). When it is ticked the
 * project also says what kind of architecture project it is (SINGLE FAMILY
 * HOME, MANSION, COMMERCIAL BUILDING, RETAIL BUILDING, APARTMENT / CONDO
 * BUILDING, APARTMENT, SCHOOL, RESORT) or OTHER with the type typed in by hand.
 * Stored on the project as two nullable columns (`architectureType`,
 * `architectureTypeOther`; prisma/sql/0029_project_architecture_type.sql) — the
 * same design as DEVELOPMENT (lib/projects/development.ts).
 *
 * null type = no type chosen. Projects that had ARCHITECTURE ticked before this
 * existed have no type: they still read and render fine (the tag is plain
 * "Architecture"); the form asks for the type the next time they are saved.
 * The typed text is kept only for OTHER, exactly as typed (ends trimmed).
 */

export type ProjectArchitectureType =
  | "SINGLE_FAMILY_HOME"
  | "MANSION"
  | "COMMERCIAL_BUILDING"
  | "RETAIL_BUILDING"
  | "APARTMENT_CONDO_BUILDING"
  | "APARTMENT"
  | "SCHOOL"
  | "RESORT"
  | "OTHER";

/** Dropdown order, as the owner listed them. */
export const ARCHITECTURE_TYPES: ProjectArchitectureType[] = [
  "SINGLE_FAMILY_HOME",
  "MANSION",
  "COMMERCIAL_BUILDING",
  "RETAIL_BUILDING",
  "APARTMENT_CONDO_BUILDING",
  "APARTMENT",
  "SCHOOL",
  "RESORT",
  "OTHER",
];

/** The dropdown's options — capitals, like the rest of the olive panel. */
export const ARCHITECTURE_TYPE_OPTION: Record<ProjectArchitectureType, string> = {
  SINGLE_FAMILY_HOME: "SINGLE FAMILY HOME",
  MANSION: "MANSION",
  COMMERCIAL_BUILDING: "COMMERCIAL BUILDING",
  RETAIL_BUILDING: "RETAIL BUILDING",
  APARTMENT_CONDO_BUILDING: "APARTMENT / CONDO BUILDING",
  APARTMENT: "APARTMENT",
  SCHOOL: "SCHOOL",
  RESORT: "RESORT",
  OTHER: "OTHER",
};

/** How a type reads in the discipline tag ("Architecture · Single Family Home"). */
export const ARCHITECTURE_TYPE_LABEL: Record<ProjectArchitectureType, string> = {
  SINGLE_FAMILY_HOME: "Single Family Home",
  MANSION: "Mansion",
  COMMERCIAL_BUILDING: "Commercial Building",
  RETAIL_BUILDING: "Retail Building",
  APARTMENT_CONDO_BUILDING: "Apartment / Condo Building",
  APARTMENT: "Apartment",
  SCHOOL: "School",
  RESORT: "Resort",
  OTHER: "Other",
};

/** The typed type of an OTHER architecture project: at most this many characters. */
export const ARCHITECTURE_OTHER_MAX = 80;

/** The Discipline enum value the ARCHITECTURE tick box stands for. */
export const ARCHITECTURE_DISCIPLINE = "ARCHITECTURE";

export function isArchitectureType(v: unknown): v is ProjectArchitectureType {
  return typeof v === "string" && (ARCHITECTURE_TYPES as string[]).includes(v);
}

const identity = (s: string) => s;

/**
 * The ARCHITECTURE discipline tag with its type: "Architecture · Mansion", or
 * the typed type for OTHER ("Architecture · Beach Pavilion"). null when no type
 * is set — the caller then shows the plain discipline tag ("Architecture").
 * `t` translates the fixed parts; the typed text is shown as typed. OTHER with
 * nothing typed (the form refuses it) reads "Architecture · Other".
 */
export function architectureTag(
  type: ProjectArchitectureType | null | undefined,
  other: string | null | undefined,
  t: (s: string) => string = identity,
): string | null {
  if (!type || !isArchitectureType(type)) return null;
  const typed = type === "OTHER" ? (other ?? "").trim() : "";
  return `${t("Architecture")} · ${typed || t(ARCHITECTURE_TYPE_LABEL[type])}`;
}

/** What the form asks for, before it is checked. */
export type ArchitectureInput = {
  /** The ARCHITECTURE discipline tick box. */
  ticked: boolean;
  /** The dropdown's value ("" when nothing is chosen). */
  type: string | null | undefined;
  /** The TYPE OF ARCHITECTURE PROJECT text box (only read for OTHER). */
  other: string | null | undefined;
};

/** The two columns as they are saved. Both null = no type. */
export type ArchitectureValue = {
  architectureType: ProjectArchitectureType | null;
  architectureTypeOther: string | null;
};

/** The English sentences a refusal can carry — each is a t() key. */
export const ARCHITECTURE_ERRORS = {
  type: "Choose the type of architecture project.",
  other: "Type the kind of architecture project.",
  tooLong: "The type of architecture project is 80 characters at most.",
} as const;

export type ArchitectureCheck =
  | ({ ok: true } & ArchitectureValue)
  | { ok: false; error: (typeof ARCHITECTURE_ERRORS)[keyof typeof ARCHITECTURE_ERRORS] };

/**
 * Check the ARCHITECTURE panel and turn it into the two columns.
 *   - not ticked: both null, whatever the dropdown and text box still hold;
 *   - ticked: a type is required;
 *   - OTHER: the typed type is required, at most 80 characters, kept as typed
 *     (only the ends are trimmed);
 *   - any other type: the typed text is dropped.
 */
export function checkArchitecture(input: ArchitectureInput): ArchitectureCheck {
  if (!input.ticked) return { ok: true, architectureType: null, architectureTypeOther: null };
  const type = (input.type ?? "").trim();
  if (!isArchitectureType(type)) return { ok: false, error: ARCHITECTURE_ERRORS.type };
  if (type !== "OTHER") return { ok: true, architectureType: type, architectureTypeOther: null };
  const other = (input.other ?? "").trim();
  if (!other) return { ok: false, error: ARCHITECTURE_ERRORS.other };
  if (other.length > ARCHITECTURE_OTHER_MAX) return { ok: false, error: ARCHITECTURE_ERRORS.tooLong };
  return { ok: true, architectureType: "OTHER", architectureTypeOther: other };
}

/**
 * Server side: the same rules over what is being saved. `disciplines` is what
 * the project will hold; ARCHITECTURE among them = the box is ticked.
 *   - ARCHITECTURE not among them: both columns cleared;
 *   - ticked, and `type` absent (undefined) on an UPDATE: null = leave what is
 *     saved alone (a caller that does not know about the type cannot wipe it);
 *   - otherwise checkArchitecture's rules; throws the English sentence on a
 *     refusal (saveProject shows it).
 */
export function cleanArchitecture(
  disciplines: readonly string[] | null | undefined,
  type: string | null | undefined,
  other: string | null | undefined,
  mode: "create" | "update",
): ArchitectureValue | null {
  const ticked = (disciplines ?? []).includes(ARCHITECTURE_DISCIPLINE);
  if (ticked && type === undefined && mode === "update") return null;
  const res = checkArchitecture({ ticked, type, other });
  if (!res.ok) throw new Error(res.error);
  return { architectureType: res.architectureType, architectureTypeOther: res.architectureTypeOther };
}
