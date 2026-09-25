/**
 * Contract revisions: how they are numbered, and what changed. PURE.
 *
 * ─── A REVISION KEEPS THE CONTRACT'S NUMBER ─────────────────────────────────
 * `CC-2026-004` becomes `CC-2026-004 Rev B`, not `CC-2026-005`. The number on a
 * construction contract is quoted in correspondence, in payment applications
 * and in the employer's own ledger for years; issuing a replacement under a new
 * number means two live numbers for one agreement, and somebody eventually pays
 * against the wrong one. The base number is the agreement, the revision letter
 * is which version of it. It is also how every drawing in the same project is
 * numbered, so nobody has to be taught a second convention.
 *
 * The first issue carries no letter — the original is not "Rev A" until there
 * is a Rev B, and retrospectively renumbering an executed document is the one
 * thing a revision scheme must never do. So the sequence is: no letter, Rev B,
 * Rev C. This looks like an off-by-one and is deliberate; the note here exists
 * because it will be "corrected" otherwise.
 *
 * ─── THE DIFF EXISTS BECAUSE NOBODY READS BOTH ──────────────────────────────
 * A revised contract is thirty pages of which four sentences moved. Asking a
 * reviewer to compare two PDFs is asking them to approve it unread. So the
 * revision is issued with a list of what actually changed.
 *
 * ARTICLES ARE MATCHED BY HEADING, NOT BY NUMBER. Inserting one clause at the
 * top renumbers everything below it, and a number-matched diff then reports
 * thirty rewritten articles and hides the one that matters. Matching on the
 * heading survives renumbering, and the renumbering is itself reported — once,
 * as what it is.
 */
import type { ContractArticle, ContractBody, ContractFacts, ContractPhase } from "./types";

/* ------------------------------------------------------------------ *
 * Numbering
 * ------------------------------------------------------------------ */

const REV_RE = /^(.*?)(?:\s+Rev\s+([A-Z]+))?$/;

/** `CC-2026-004 Rev C` → `CC-2026-004`. */
export function baseNumber(number: string): string {
  const m = REV_RE.exec(number.trim());
  return (m?.[1] ?? number).trim();
}

/** `CC-2026-004 Rev C` → `C`; the original issue → `null`. */
export function revisionLetter(number: string): string | null {
  const m = REV_RE.exec(number.trim());
  return m?.[2] ?? null;
}

/** "Rev C", or "Original issue" for the first one. */
export function revisionLabel(number: string): string {
  const letter = revisionLetter(number);
  return letter ? `Rev ${letter}` : "Original issue";
}

/**
 * A → B → … → Z → AA. Spreadsheet-column order, because everyone already
 * knows it and it never runs out.
 */
export function nextLetter(letter: string | null): string {
  if (!letter) return "B"; // the original carries no letter; see the note above
  const chars = letter.toUpperCase().split("");
  let i = chars.length - 1;
  for (;;) {
    if (chars[i] !== "Z") {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
    chars[i] = "A";
    if (i === 0) return `A${chars.join("")}`;
    i -= 1;
  }
}

/**
 * The number for the next revision of `number`, given every contract number the
 * practice already holds.
 *
 * It looks at the whole family rather than just the one being revised, because
 * revising Rev B while Rev C exists — two people working at once, or a revision
 * of a superseded version — must not mint a second Rev C.
 */
export function nextRevisionNumber(number: string, existing: readonly string[]): string {
  const base = baseNumber(number);
  const family = existing.map((n) => n.trim()).filter((n) => baseNumber(n) === base);

  let highest: string | null = null;
  for (const n of family) {
    const letter = revisionLetter(n);
    if (!letter) continue;
    if (highest === null || compareLetters(letter, highest) > 0) highest = letter;
  }
  return `${base} Rev ${nextLetter(highest)}`;
}

/** Spreadsheet-column order: shorter is always lower, so `Z` < `AA`. */
export function compareLetters(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a.localeCompare(b);
}

/** Every version of one contract, oldest first. */
export function sortFamily<T extends { number: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((x, y) => {
    const a = revisionLetter(x.number);
    const b = revisionLetter(y.number);
    if (a === null && b === null) return x.number.localeCompare(y.number);
    if (a === null) return -1;
    if (b === null) return 1;
    return compareLetters(a, b);
  });
}

/* ------------------------------------------------------------------ *
 * The diff
 * ------------------------------------------------------------------ */

export type FieldChange = { label: string; from: string; to: string };

export type ArticleChange =
  | { kind: "added"; number: string; heading: string }
  | { kind: "removed"; number: string; heading: string }
  | { kind: "renumbered"; heading: string; from: string; to: string }
  | {
      kind: "reworded";
      number: string;
      heading: string;
      /** Also carries a renumber when both happened, so it is reported once. */
      renumberedFrom: string | null;
      paragraphs: { from: string; to: string }[];
    };

export type ContractDiff = {
  facts: FieldChange[];
  schedule: FieldChange[];
  articles: ArticleChange[];
  /** Articles that came through untouched — the reassuring number. */
  unchanged: number;
  /** True when nothing at all differs. */
  identical: boolean;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const key = (s: string) => norm(s).toLowerCase();

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fieldChanges(a: ContractFacts, b: ContractFacts): FieldChange[] {
  const out: FieldChange[] = [];
  const text = (label: string, from: string, to: string) => {
    if (norm(from) !== norm(to)) out.push({ label, from: norm(from) || "—", to: norm(to) || "—" });
  };
  const number = (label: string, from: number | null, to: number | null, suffix = "") => {
    if ((from ?? null) === (to ?? null)) return;
    out.push({
      label,
      from: from === null ? "—" : `${from}${suffix}`,
      to: to === null ? "—" : `${to}${suffix}`,
    });
  };

  // The contract sum first: it is the change everyone is looking for, and a
  // list that buries it under an address correction has failed at its job.
  if (a.contractSum !== b.contractSum || a.currency !== b.currency) {
    out.push({
      label: "Contract sum",
      from: money(a.contractSum, a.currency),
      to: money(b.contractSum, b.currency),
    });
  }

  text("Employer", a.employerName, b.employerName);
  text("Contractor", a.contractorName, b.contractorName);
  text("Contract administrator", a.administratorName, b.administratorName);
  text("Project", a.projectName, b.projectName);
  text("Site", a.siteAddress, b.siteAddress);
  text("Scope", a.scopeSummary, b.scopeSummary);
  text("Commencement", a.commencementDate, b.commencementDate);
  text("Completion", a.completionDate, b.completionDate);
  number("Contract period", a.contractPeriodDays, b.contractPeriodDays, " days");
  number("Defects liability", a.defectsLiabilityMonths, b.defectsLiabilityMonths, " months");
  number("Retention", a.retentionPercent, b.retentionPercent, "%");
  if ((a.liquidatedDamagesPerDay ?? null) !== (b.liquidatedDamagesPerDay ?? null)) {
    out.push({
      label: "Liquidated damages",
      from: a.liquidatedDamagesPerDay === null ? "—" : `${money(a.liquidatedDamagesPerDay, a.currency)} per day`,
      to: b.liquidatedDamagesPerDay === null ? "—" : `${money(b.liquidatedDamagesPerDay, b.currency)} per day`,
    });
  }
  if (a.exchangeRate !== b.exchangeRate) {
    out.push({ label: "Exchange rate", from: `${a.exchangeRate}`, to: `${b.exchangeRate}` });
  }

  text("Employer address", a.employerAddress, b.employerAddress);
  text("Contractor address", a.contractorAddress, b.contractorAddress);
  return out;
}

function scheduleChanges(a: ContractPhase[], b: ContractPhase[], currency: string): FieldChange[] {
  const out: FieldChange[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const from = a[i];
    const to = b[i];
    const label = `Instalment ${to?.phase ?? from?.phase ?? i + 1}`;
    if (!from) {
      out.push({ label, from: "—", to: `${norm(to.description)} · ${to.percent}% · ${money(to.amountAwg, currency)}` });
      continue;
    }
    if (!to) {
      out.push({ label, from: `${norm(from.description)} · ${from.percent}% · ${money(from.amountAwg, currency)}`, to: "—" });
      continue;
    }
    if (norm(from.description) !== norm(to.description)) {
      out.push({ label: `${label} — name`, from: norm(from.description), to: norm(to.description) });
    }
    if (norm(from.detail) !== norm(to.detail)) {
      out.push({ label: `${label} — due`, from: norm(from.detail) || "—", to: norm(to.detail) || "—" });
    }
    if (from.percent !== to.percent || from.amountAwg !== to.amountAwg) {
      out.push({
        label: `${label} — amount`,
        from: `${from.percent}% · ${money(from.amountAwg, currency)}`,
        to: `${to.percent}% · ${money(to.amountAwg, currency)}`,
      });
    }
  }
  return out;
}

/**
 * Pair the two versions' articles up.
 *
 * Heading first — it survives renumbering, which is the whole point. A heading
 * that appears twice in one document cannot identify anything, so those fall
 * back to the number; a document with two "General" clauses is rare and a wrong
 * pairing there is worse than no pairing.
 */
function pairArticles(
  a: ContractArticle[],
  b: ContractArticle[],
): { from: ContractArticle | null; to: ContractArticle | null }[] {
  const countBy = (rows: ContractArticle[]) => {
    const n = new Map<string, number>();
    for (const r of rows) n.set(key(r.heading), (n.get(key(r.heading)) ?? 0) + 1);
    return n;
  };
  const aCount = countBy(a);
  const bCount = countBy(b);

  const unique = (r: ContractArticle) =>
    !!r.heading.trim() && aCount.get(key(r.heading)) === 1 && bCount.get(key(r.heading)) === 1;

  const byHeading = new Map<string, ContractArticle>();
  for (const r of b) if (unique(r)) byHeading.set(key(r.heading), r);

  const byNumber = new Map<string, ContractArticle>();
  for (const r of b) byNumber.set(norm(r.number), r);

  const pairs: { from: ContractArticle | null; to: ContractArticle | null }[] = [];
  const claimed = new Set<ContractArticle>();

  for (const from of a) {
    const to = (unique(from) ? byHeading.get(key(from.heading)) : undefined) ?? byNumber.get(norm(from.number));
    if (to && !claimed.has(to)) {
      claimed.add(to);
      pairs.push({ from, to });
    } else {
      pairs.push({ from, to: null });
    }
  }
  for (const to of b) if (!claimed.has(to)) pairs.push({ from: null, to });
  return pairs;
}

function paragraphChanges(from: string[], to: string[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  const max = Math.max(from.length, to.length);
  for (let i = 0; i < max; i += 1) {
    const x = norm(from[i] ?? "");
    const y = norm(to[i] ?? "");
    if (x !== y) out.push({ from: x || "—", to: y || "—" });
  }
  return out;
}

/** What changed between two versions of one contract. */
export function diffContracts(
  before: { facts: ContractFacts; body: ContractBody },
  after: { facts: ContractFacts; body: ContractBody },
): ContractDiff {
  const facts = fieldChanges(before.facts, after.facts);
  const schedule = scheduleChanges(before.body.schedule, after.body.schedule, after.facts.currency || "AWG");

  const articles: ArticleChange[] = [];
  let unchanged = 0;

  for (const { from, to } of pairArticles(before.body.articles, after.body.articles)) {
    if (!from && to) {
      articles.push({ kind: "added", number: to.number, heading: norm(to.heading) });
      continue;
    }
    if (from && !to) {
      articles.push({ kind: "removed", number: from.number, heading: norm(from.heading) });
      continue;
    }
    if (!from || !to) continue;

    const paragraphs = paragraphChanges(from.paragraphs, to.paragraphs);
    const headingMoved = norm(from.heading) !== norm(to.heading);
    const renumbered = norm(from.number) !== norm(to.number);

    if (paragraphs.length === 0 && !headingMoved) {
      // Renumbering on its own is reported as renumbering, not as a rewrite:
      // "article 12 is now 13" is a fact a reviewer can skim past, and thirty
      // of them dressed up as changes is why people stop reading the list.
      if (renumbered) articles.push({ kind: "renumbered", heading: norm(to.heading), from: from.number, to: to.number });
      else unchanged += 1;
      continue;
    }

    articles.push({
      kind: "reworded",
      number: to.number,
      heading: norm(to.heading),
      renumberedFrom: renumbered ? from.number : null,
      paragraphs: headingMoved
        ? [{ from: norm(from.heading), to: norm(to.heading) }, ...paragraphs]
        : paragraphs,
    });
  }

  return {
    facts,
    schedule,
    articles,
    unchanged,
    identical: facts.length === 0 && schedule.length === 0 && articles.length === 0,
  };
}

/** One line for the top of the revision: "3 clauses reworded, 1 added". */
export function diffSummary(diff: ContractDiff): string {
  if (diff.identical) return "Nothing changed.";
  const bits: string[] = [];
  const count = (kind: ArticleChange["kind"]) => diff.articles.filter((c) => c.kind === kind).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  if (diff.facts.length > 0) bits.push(plural(diff.facts.length, "particular", "particulars"));
  if (diff.schedule.length > 0) bits.push(plural(diff.schedule.length, "schedule change", "schedule changes"));
  if (count("reworded") > 0) bits.push(`${plural(count("reworded"), "clause", "clauses")} reworded`);
  if (count("added") > 0) bits.push(`${count("added")} added`);
  if (count("removed") > 0) bits.push(`${count("removed")} removed`);
  if (count("renumbered") > 0) bits.push(`${count("renumbered")} renumbered`);

  return `${bits.join(", ")}.`;
}
