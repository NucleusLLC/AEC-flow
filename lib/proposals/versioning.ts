/**
 * Proposal version numbers — the rule that makes the version move as the document does.
 *
 * It used to be written in exactly one place, at issue time, as `${revision}.0`. So a draft
 * showed nothing however much you edited it, the minor digit was always zero, and a revision
 * stayed blank until it too was issued. The reported symptom: "versions doesn't seem to change
 * with the changes and revisions".
 *
 * The rule now:
 *
 *     created draft   0.1
 *     save an edit    0.2, 0.3, …      every save moves the minor
 *     ISSUE           1.0              rounds up; this is the snapshot's label
 *     new revision    1.1  (draft)     carries on from the issued major
 *     save an edit    1.2
 *     ISSUE           2.0
 *
 * So a whole number always means "a version a client received", and anything with a non-zero
 * minor is work in progress. PURE — no Prisma, no session — so the arithmetic is unit-tested
 * without a database, the same discipline as lib/proposals/engine.
 */

export type Version = { major: number; minor: number };

/** What a brand-new draft starts at, before it has ever been issued. */
export const INITIAL_VERSION = "0.1";

/**
 * Read a stored label. Anything unparseable — including the nulls left by every proposal
 * written before this rule existed — reads as 0.0, so the next save lands on 0.1 and the
 * document simply joins the scheme rather than erroring.
 */
export function parseVersion(label: string | null | undefined): Version {
  if (!label) return { major: 0, minor: 0 };
  const m = /^\s*(\d+)\s*\.\s*(\d+)\s*$/.exec(label);
  if (!m) return { major: 0, minor: 0 };
  return { major: Number(m[1]), minor: Number(m[2]) };
}

export function formatVersion(v: Version): string {
  return `${v.major}.${v.minor}`;
}

/** A saved edit: the minor moves, the major never does. */
export function bumpDraftVersion(label: string | null | undefined): string {
  const v = parseVersion(label);
  return formatVersion({ major: v.major, minor: v.minor + 1 });
}

/**
 * Issuing rounds up to the next whole number, so an issued document never carries a
 * work-in-progress minor. 0.3 → 1.0, 1.2 → 2.0. A label already whole (1.0) still advances
 * (2.0): reaching issue means this is a new thing to send, not the one already sent.
 */
export function issuedVersion(label: string | null | undefined): string {
  const v = parseVersion(label);
  return formatVersion({ major: v.major + 1, minor: 0 });
}

/**
 * The draft that a "new revision" starts on: same major as the issued document it continues,
 * minor back to 1. Issued 1.0 → the revision drafts at 1.1 and will issue as 2.0.
 */
export function revisionStartVersion(issuedLabel: string | null | undefined): string {
  const v = parseVersion(issuedLabel);
  return formatVersion({ major: v.major, minor: 1 });
}

/**
 * The version a NEW REVISION starts on, whatever the document it continues.
 *
 * `revisionStartVersion` above answers this only for a document that has been
 * ISSUED, and it was being used for every source. Revising twice was therefore
 * a no-op on the label, and revising a draft moved it backwards:
 *
 *     issued   1.0  ->  1.1   correct
 *     draft    1.1  ->  1.1   NO CHANGE — two revisions, one label
 *     draft    0.3  ->  0.1   BACKWARDS
 *
 * Reported as "it adds one Decimal automatically" not happening. So the rule
 * now depends on what it is revising: an issued whole number starts its
 * revision at `.1`, and anything already in progress simply moves one decimal,
 * which is what `bumpDraftVersion` means for a save and means here too.
 *
 * The major is never touched — reaching a new whole number is what ISSUING
 * does, and a revision is a draft until it is issued.
 */
export function nextRevisionVersion(label: string | null | undefined): string {
  return isIssuedVersion(label) ? revisionStartVersion(label) : bumpDraftVersion(label);
}

/** True when this label is one a client received — a whole number above zero. */
export function isIssuedVersion(label: string | null | undefined): boolean {
  const v = parseVersion(label);
  return v.major > 0 && v.minor === 0;
}

/** For display: "1.2" → "v1.2". Never invents a version for a document that has none. */
export function versionDisplay(label: string | null | undefined): string | null {
  if (!label) return null;
  return `v${label}`;
}
