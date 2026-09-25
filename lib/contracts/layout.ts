/**
 * Turning contract prose into a typeset shape. PURE — strings in, a small
 * description of what to draw out. No React, no DOM, no measuring.
 *
 * ─── IT RECOGNISES SHAPES, NEVER ARTICLE NUMBERS ────────────────────────────
 * "Article 11 is the signature block" is true of one template and false of the
 * next one the practice uploads. Every rule here keys off the SHAPE of the
 * text: a paragraph of `Label: value` pairs whose first label is in capitals is
 * a card, whatever article it sits in; `11.1 Entire Agreement.` is a sub-clause
 * because it starts with a dotted number and a short title, not because it is
 * in article 11.
 *
 * ─── THE MODEL IS ASKED FOR THESE SHAPES ────────────────────────────────────
 * `lib/server/contract-ai.ts` tells the model to write particulars as
 * `Label: value`, sub-clauses as `11.1 Title. …` and each execution block as
 * one paragraph beginning with the role in capitals. The recognisers here and
 * the instructions there are one contract in two places; change them together.
 *
 * ─── EMPHASIS IS BOUNDED ────────────────────────────────────────────────────
 * The model marks the facts it inserted with `**…**` and those are honoured as
 * given. The pattern rules then run ONLY on the text between those spans, so a
 * name inside an already-bold phrase is not bolded twice and a pattern cannot
 * reach into the model's own emphasis. Headings, tables and signature lines are
 * stripped of `**` instead: bold inside a heading is noise.
 */

export type TextSpan = { text: string; bold: boolean };

export type ClauseTitle = {
  /** `11.1`, or `` when the paragraph does not open with a number. */
  number: string;
  /** `Entire Agreement`, or `` when there is no short title after the number. */
  title: string;
  /** What is left of the paragraph once the number and title are taken off. */
  rest: string;
};

export type LabelledItem = { label: string; value: string };

export type ParagraphShape =
  | { kind: "card"; heading: string; items: LabelledItem[]; signature: boolean }
  | { kind: "table"; items: LabelledItem[] }
  | { kind: "clause"; title: ClauseTitle }
  | { kind: "prose" };

/* ------------------------------------------------------------------ *
 * Emphasis
 * ------------------------------------------------------------------ */

/** The longest a clause title may be before it is just the start of a sentence. */
export const MAX_TITLE_WORDS = 7;

const MONEY_RE =
  /\b(?:AWG|Afl\.?|ANG|US\$|USD|EUR|€|\$)\s?\d[\d.,]*(?:\s?(?:million|thousand))?/gi;
// The trailing \b belongs INSIDE each alternative. `²` is not a word character,
// so a word boundary after `m²` can never match — with the \b outside, every
// area in every contract went unbolded and the test caught it.
const AREA_RE = /\b\d[\d.,]*\s?(?:m²|m2\b|sq\.?\s?m\b|square\s+met(?:er|re)s?\b)/gi;
const PERCENT_RE = /\b\d{1,3}(?:[.,]\d+)?\s?%/g;
const LOT_RE = /\b(?:Lot|Parcel|Unit|Kavel|Perceel)\s+[A-Z0-9][A-Z0-9-]*/gi;
const DATE_RE = new RegExp(
  [
    // 15 SEP 2026 · 15 September 2026 · 15 september 2026 · 15 de septiembre de 2026
    "\\b\\d{1,2}\\s+(?:de\\s+)?[A-Za-zÀ-ÿ]{3,12}\\.?\\s+(?:de\\s+)?\\d{4}\\b",
    // 2026-09-15 and 15/09/2026
    "\\b\\d{4}-\\d{2}-\\d{2}\\b",
    "\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b",
  ].join("|"),
  "g",
);

/**
 * Split a paragraph into spans, honouring the model's `**…**` and then applying
 * the fact patterns to the gaps between them.
 *
 * `names` are the party names as the user typed them — the one thing a pattern
 * cannot infer, and the thing a reader most wants to find on the page.
 */
export function emphasise(text: string, names: string[] = []): TextSpan[] {
  const source = String(text ?? "");
  if (!source) return [];

  const spans: TextSpan[] = [];
  const marked = /\*\*([\s\S]+?)\*\*/g;
  let cursor = 0;
  let m: RegExpExecArray | null;

  while ((m = marked.exec(source))) {
    if (m.index > cursor) spans.push(...patternSpans(source.slice(cursor, m.index), names));
    spans.push({ text: m[1], bold: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < source.length) spans.push(...patternSpans(source.slice(cursor), names));
  return merge(spans);
}

function patternSpans(text: string, names: string[]): TextSpan[] {
  if (!text) return [];
  const hits: { start: number; end: number }[] = [];

  const collect = (re: RegExp) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].trim()) hits.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  };

  for (const name of names) {
    const clean = String(name ?? "").trim();
    // Two characters is not a name; a one-letter "name" would bold every
    // occurrence of that letter in the contract.
    if (clean.length < 3) continue;
    collect(new RegExp(escapeRe(clean), "gi"));
  }
  collect(MONEY_RE);
  collect(AREA_RE);
  collect(PERCENT_RE);
  collect(LOT_RE);
  collect(DATE_RE);

  if (hits.length === 0) return [{ text, bold: false }];

  // Overlaps happen — "AWG 350,000" contains no percentage but "40% of AWG
  // 350,000" produces two hits that must not interleave. Longest first, then
  // drop anything that overlaps something already taken.
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const taken: { start: number; end: number }[] = [];
  for (const h of hits) {
    if (taken.some((t) => h.start < t.end && h.end > t.start)) continue;
    taken.push(h);
  }
  taken.sort((a, b) => a.start - b.start);

  const out: TextSpan[] = [];
  let at = 0;
  for (const t of taken) {
    if (t.start > at) out.push({ text: text.slice(at, t.start), bold: false });
    out.push({ text: text.slice(t.start, t.end), bold: true });
    at = t.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), bold: false });
  return out;
}

function merge(spans: TextSpan[]): TextSpan[] {
  const out: TextSpan[] = [];
  for (const s of spans) {
    if (!s.text) continue;
    const last = out[out.length - 1];
    if (last && last.bold === s.bold) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Headings, table cells and signature lines take the text without its markers. */
export function stripEmphasis(text: string): string {
  return String(text ?? "").replace(/\*\*/g, "");
}

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

const CLAUSE_RE = /^\s*(\d+(?:\.\d+)*)\s+([^.]{0,80}?)\.\s+([\s\S]*)$/;
const CLAUSE_NUMBER_ONLY_RE = /^\s*(\d+(?:\.\d+)*)[.)]?\s+([\s\S]*)$/;

/**
 * `11.1 Entire Agreement. This agreement …` → number, title, rest.
 *
 * The title has to be SHORT. Without that cap, "11.1 The Contractor shall at
 * its own cost provide all plant. The Employer …" sets sixteen words in bold
 * and the page turns into a wall of it.
 */
export function clauseTitle(paragraph: string): ClauseTitle | null {
  const text = String(paragraph ?? "");
  const m = CLAUSE_RE.exec(text);
  if (m) {
    const title = m[2].trim();
    const words = title.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.length <= MAX_TITLE_WORDS) {
      return { number: m[1], title, rest: m[3].trim() };
    }
  }
  const n = CLAUSE_NUMBER_ONLY_RE.exec(text);
  if (n) return { number: n[1], title: "", rest: n[2].trim() };
  return null;
}

const LABEL_RE = /^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 '()/.&-]{0,40}?)\s*:\s*([\s\S]*)$/;

/**
 * Pull `Label: value` items out of a paragraph, whether they are separated by
 * ` — ` or written one per line.
 */
export function labelledItems(paragraph: string): LabelledItem[] {
  const text = String(paragraph ?? "").trim();
  if (!text) return [];
  const pieces = text.includes("\n") ? text.split(/\n+/) : text.split(/\s+—\s+|\s+–\s+/);
  const items: LabelledItem[] = [];
  for (const piece of pieces) {
    const m = LABEL_RE.exec(piece.trim());
    if (!m) continue;
    items.push({ label: m[1].trim(), value: m[2].trim() });
  }
  return items;
}

const SIGNATURE_LABELS = /^(signature|signed|handtekening|firma|date|datum|fecha|witness|getuige|testigo)$/i;

/**
 * What this paragraph should be drawn as.
 *
 * A CARD is a party's particulars or an execution block: a run of labelled
 * items whose heading is in capitals. The heading may or may not have a colon —
 * real output writes `CONTRACTOR — Name: … — Signature: …`, and a recogniser
 * that demanded a colon after the heading missed every one of them.
 */
export function paragraphShape(paragraph: string): ParagraphShape {
  const text = String(paragraph ?? "").trim();
  if (!text) return { kind: "prose" };

  const head = /^([A-ZÀ-Ý][A-ZÀ-Ý0-9 '&/().-]{2,60}?)(?:\s*[:—–-]\s+|\n)([\s\S]+)$/.exec(text);
  if (head) {
    const items = labelledItems(head[2]);
    if (items.length >= 1) {
      return {
        kind: "card",
        heading: head[1].trim().replace(/[:—–-]\s*$/, ""),
        items,
        signature: items.some((i) => SIGNATURE_LABELS.test(i.label)),
      };
    }
  }

  const items = labelledItems(text);
  if (items.length >= 2) {
    const first = items[0].label;
    if (first === first.toUpperCase() && /[A-ZÀ-Ý]/.test(first)) {
      return {
        kind: "card",
        heading: first,
        items: items.slice(1),
        signature: items.some((i) => SIGNATURE_LABELS.test(i.label)),
      };
    }
    return { kind: "table", items };
  }

  const clause = clauseTitle(text);
  if (clause) return { kind: "clause", title: clause };

  return { kind: "prose" };
}

/** A blank value prints as a fill-in line, never as nothing. */
export function isBlankValue(value: string): boolean {
  const v = String(value ?? "").trim();
  return v === "" || /^_{3,}$/.test(v) || v === "—" || v === "-";
}

/**
 * Two signature cards sit side by side; everything else runs full width.
 * Returned as rows so the renderer does not have to decide.
 */
export function pairCards<T>(cards: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2));
  return rows;
}

/**
 * With four or more short items a key/value table reads better as two pairs per
 * row — it halves the height, and a contract's particulars are mostly short.
 */
export function tableColumns(items: LabelledItem[]): 1 | 2 {
  if (items.length < 4) return 1;
  const longest = items.reduce((n, i) => Math.max(n, i.value.length), 0);
  return longest <= 32 ? 2 : 1;
}

/* ------------------------------------------------------------------ *
 * Giving the paginator somewhere to cut
 * ------------------------------------------------------------------ */

/**
 * Longest run of characters rendered as ONE paragraph element.
 *
 * MEASURED, not guessed. On this app's A4 sheet with standard margins the text
 * column holds roughly 3,000–3,500 characters of body copy per page, and the
 * document engine can only place a page break BETWEEN block elements — a single
 * `<p>` is one block however long it is. A 900-word clause therefore arrives at
 * the foot of a page as an indivisible 1,200px lump: the page before it is left
 * two thirds empty and the page it lands on runs 124% of a sheet. Both were
 * measured on a 30-article fixture by `scripts/verify-print-overflow.mjs`.
 *
 * 550 characters gives the paginator roughly six cut points per page, which is
 * finer than any reader can perceive, and the chunks are rendered with no
 * spacing between them so the clause still reads as one paragraph.
 */
export const MAX_BLOCK_CHARS = 550;

/**
 * Split a paragraph at sentence boundaries into runs no longer than
 * `MAX_BLOCK_CHARS`, conserving every character.
 *
 * Sentence boundaries, not words: a break mid-sentence between two block
 * elements would be invisible on screen but would let the paginator separate
 * "…shall not exceed" from "ten per cent." across a page turn, which is exactly
 * the kind of split a contract must not suffer.
 *
 * A single sentence longer than the limit is left whole. A clause that cannot
 * be cut politely is better long than mangled.
 */
export function chunkParagraph(text: string, maxChars = MAX_BLOCK_CHARS): string[] {
  const source = String(text ?? "");
  if (source.length <= maxChars) return [source];

  // Keep the delimiter with the sentence it ends.
  const sentences = source.match(/[^.!?]+(?:[.!?]+["')\]]*\s*|$)/g) ?? [source];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [source];
}
