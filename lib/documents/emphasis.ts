/**
 * `**bold**` in a free-text field. PURE — a string in, spans out.
 *
 * ─── ONE DEFINITION OF WHAT `**` MEANS ──────────────────────────────────────
 * The contract typesetter already read the model's `**…**`, and the proposal
 * needed the same thing for text a person types. Two regexes for one convention
 * is how "it works on the contract but not the proposal" becomes a bug report,
 * so the rule lives here and both call it. `lib/contracts/layout.ts` layers its
 * own automatic bolding — money, areas, dates — on top of this; the proposal
 * deliberately does not, because auto-bolding a figure the author did not mark
 * would silently restyle every proposal already in the system.
 *
 * ─── IT IS NOT MARKDOWN, AND SHOULD NOT GROW INTO IT ────────────────────────
 * One marker, doing one thing. A field that accepts `**` but not `_`, `#` or
 * `[]()` is a field with a rule somebody can hold in their head; a field that
 * accepts half of Markdown is one where people discover by accident which half.
 * If more is ever wanted, it wants a real editor, not more regexes here.
 *
 * ─── UNBALANCED MARKERS STAY AS TYPED ───────────────────────────────────────
 * `**` with no closing pair is left on the page exactly as written. The
 * temptation is to treat a trailing `**` as "bold to the end of the field",
 * which turns a typo in the middle of a paragraph into three bold pages. Text
 * that looks wrong is fixable by the person who typed it; text that has been
 * silently reinterpreted is not.
 */

export type TextSpan = { text: string; bold: boolean };

/**
 * `**…**`, non-greedy, and allowed to run across newlines so a marked phrase
 * can wrap. Requires at least one character between the markers: `****` is not
 * an empty bold span, it is four asterisks somebody typed.
 */
const MARKED = /\*\*([\s\S]+?)\*\*/g;

/** Split text into runs, the `**…**` ones marked bold. */
export function markedSpans(text: string | null | undefined): TextSpan[] {
  const source = String(text ?? "");
  if (!source) return [];

  const spans: TextSpan[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;

  MARKED.lastIndex = 0;
  while ((m = MARKED.exec(source))) {
    if (m.index > cursor) spans.push({ text: source.slice(cursor, m.index), bold: false });
    spans.push({ text: m[1], bold: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < source.length) spans.push({ text: source.slice(cursor), bold: false });

  return spans;
}

/**
 * The text without its markers.
 *
 * For places that cannot carry emphasis at all — a heading, a table cell, an
 * email subject, a PDF filename. They must still not print the asterisks.
 */
export function stripMarkers(text: string | null | undefined): string {
  return String(text ?? "").replace(MARKED, "$1");
}

/** Is there anything for the reader to see? Blank spans are not worth an element. */
export function hasContent(spans: readonly TextSpan[]): boolean {
  return spans.some((s) => s.text.trim().length > 0);
}
