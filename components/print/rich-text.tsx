import { Fragment } from "react";
import { markedSpans } from "@/lib/documents/emphasis";

/**
 * RichText — renders a multi-line text field as real paragraphs, honouring
 * `**bold**`.
 *
 * Free-text fields (scope of services, assumptions, terms) were rendered as a
 * single `whitespace-pre-wrap` <p> holding the whole field. That is one enormous
 * block as far as pagination is concerned: on a real Service Proposal the scope
 * paragraph measured 197mm — two thirds of a page — so a page break inevitably
 * landed inside it, mid-sentence, with no element edge for a footer band to sit
 * against.
 *
 * Splitting on blank lines gives the pagination engine something to work with:
 * short blocks that move whole to the next page, so breaks fall between
 * paragraphs. Single newlines are preserved inside each paragraph, so bullet-ish
 * lines the user typed keep their shape.
 *
 * EMPHASIS IS SPANS INSIDE THE PARAGRAPH, never a wrapper around it. A bold run
 * given its own block would be a second thing for the paginator to reason about,
 * and a paragraph that crosses a page has to break between its LINES — which it
 * can only do while it is one run of inline content. This is the same reason the
 * contract document renders its articles flat rather than in a `<section>`.
 *
 * Purely presentational — the stored text is untouched, and a `**` that is never
 * closed prints as typed rather than bolding the rest of the field.
 */
export function RichText({
  text,
  className = "text-[11px] text-gray-700",
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;

  // A blank line (allowing stray whitespace) separates paragraphs.
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/, ""))
    .filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0) return null;

  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className={`whitespace-pre-line ${className}${i > 0 ? " mt-2" : ""}`}>
          <Emphasised text={p} />
        </p>
      ))}
    </>
  );
}

/**
 * One field's worth of text as inline spans, with no block of its own.
 *
 * For the places that already have their paragraph and only need the emphasis —
 * a scope item's description, a table cell, the on-screen view of the same
 * field.
 */
export function Emphasised({ text }: { text: string | null | undefined }) {
  const spans = markedSpans(text);
  if (spans.length === 0) return null;

  return (
    <>
      {spans.map((s, i) => (
        <Fragment key={i}>
          {s.bold ? <strong className="font-semibold">{s.text}</strong> : s.text}
        </Fragment>
      ))}
    </>
  );
}
