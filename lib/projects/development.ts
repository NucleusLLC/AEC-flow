/**
 * DEVELOPMENT on a project — the rules, kept free of Prisma so they test and so
 * the `"use client"` project form can import them.
 *
 * ─── WHAT IT IS ───────────────────────────────────────────────────────────────
 * The project form's Disciplines row has a DEVELOPMENT tick box next to
 * Architecture, Structural, … Ticked, the project says what kind of development
 * it is (HOUSING, CONDO / APARTMENT, TOWN HOMES, RESORT, PARCELING) or OTHER with
 * the type typed in by hand. It is stored on the project as two nullable columns
 * (`developmentType`, `developmentTypeOther`; prisma/sql/0028_project_development.sql),
 * not as a value of the shared Discipline enum — phases, team members, proposals
 * and schedules all key off that enum, and a development is not a discipline
 * anyone is assigned to.
 *
 * null type = not a development. The typed text is kept only for OTHER.
 */

export type ProjectDevelopmentType =
  | "HOUSING"
  | "CONDO_APARTMENT"
  | "TOWN_HOMES"
  | "RESORT"
  | "PARCELING"
  | "OTHER";

/** Dropdown order, as the owner listed them. */
export const DEVELOPMENT_TYPES: ProjectDevelopmentType[] = [
  "HOUSING",
  "CONDO_APARTMENT",
  "TOWN_HOMES",
  "RESORT",
  "PARCELING",
  "OTHER",
];

/** The dropdown's options — capitals, like the rest of the DEVELOPMENT panel. */
export const DEVELOPMENT_TYPE_OPTION: Record<ProjectDevelopmentType, string> = {
  HOUSING: "HOUSING",
  CONDO_APARTMENT: "CONDO / APARTMENT",
  TOWN_HOMES: "TOWN HOMES",
  RESORT: "RESORT",
  PARCELING: "PARCELING",
  OTHER: "OTHER",
};

/** How a type reads in a tag next to the discipline tags ("Development · Housing"). */
export const DEVELOPMENT_TYPE_LABEL: Record<ProjectDevelopmentType, string> = {
  HOUSING: "Housing",
  CONDO_APARTMENT: "Condo / Apartment",
  TOWN_HOMES: "Town Homes",
  RESORT: "Resort",
  PARCELING: "Parceling",
  OTHER: "Other",
};

/** The typed type of an OTHER development: at most this many characters. */
export const DEVELOPMENT_OTHER_MAX = 80;

export function isDevelopmentType(v: unknown): v is ProjectDevelopmentType {
  return typeof v === "string" && (DEVELOPMENT_TYPES as string[]).includes(v);
}

/** Trim and collapse runs of whitespace; "" when nothing is left. */
function tidy(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

const identity = (s: string) => s;

/**
 * The tag a development project carries: "Development · Housing", or the typed
 * type for OTHER ("Development · Marina Lofts"). null when it is not a
 * development. `t` translates the two fixed parts; the typed text is shown as
 * typed. OTHER with nothing typed (should not happen — the form refuses it)
 * reads "Development · Other".
 */
export function developmentTag(
  type: ProjectDevelopmentType | null | undefined,
  other: string | null | undefined,
  t: (s: string) => string = identity,
): string | null {
  if (!type || !isDevelopmentType(type)) return null;
  const typed = type === "OTHER" ? tidy(other) : "";
  return `${t("Development")} · ${typed || t(DEVELOPMENT_TYPE_LABEL[type])}`;
}

/** What the form asks for, before it is checked. */
export type DevelopmentInput = {
  /** The DEVELOPMENT tick box. */
  ticked: boolean;
  /** The dropdown's value ("" when nothing is chosen). */
  type: string | null | undefined;
  /** The TYPE OF DEVELOPMENT text box (only read for OTHER). */
  other: string | null | undefined;
};

/** The two columns as they are saved. Both null = not a development. */
export type DevelopmentValue = {
  developmentType: ProjectDevelopmentType | null;
  developmentTypeOther: string | null;
};

/** The English sentences a refusal can carry — each is a t() key. */
export const DEVELOPMENT_ERRORS = {
  type: "Choose the type of development.",
  other: "Type the kind of development.",
  tooLong: "The type of development is 80 characters at most.",
} as const;

export type DevelopmentCheck =
  | ({ ok: true } & DevelopmentValue)
  | { ok: false; error: (typeof DEVELOPMENT_ERRORS)[keyof typeof DEVELOPMENT_ERRORS] };

/**
 * Check the DEVELOPMENT panel and turn it into the two columns.
 *   - not ticked: both null, whatever the dropdown and text box still hold;
 *   - ticked: a type is required;
 *   - OTHER: the typed type is required, at most 80 characters;
 *   - any other type: the typed text is dropped.
 */
export function checkDevelopment(input: DevelopmentInput): DevelopmentCheck {
  if (!input.ticked) return { ok: true, developmentType: null, developmentTypeOther: null };
  const type = (input.type ?? "").trim();
  if (!isDevelopmentType(type)) return { ok: false, error: DEVELOPMENT_ERRORS.type };
  if (type !== "OTHER") return { ok: true, developmentType: type, developmentTypeOther: null };
  const other = tidy(input.other);
  if (!other) return { ok: false, error: DEVELOPMENT_ERRORS.other };
  if (other.length > DEVELOPMENT_OTHER_MAX) return { ok: false, error: DEVELOPMENT_ERRORS.tooLong };
  return { ok: true, developmentType: "OTHER", developmentTypeOther: other };
}

/**
 * Server side: the same rules over what was saved. `type` null/"" = not a
 * development. Throws the English sentence on a refusal (saveProject shows it).
 */
export function cleanDevelopment(
  type: string | null | undefined,
  other: string | null | undefined,
): DevelopmentValue {
  const res = checkDevelopment({ ticked: !!type, type, other });
  if (!res.ok) throw new Error(res.error);
  return { developmentType: res.developmentType, developmentTypeOther: res.developmentTypeOther };
}
