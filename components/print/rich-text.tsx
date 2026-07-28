/**
 * RichText — renders a multi-line text field as real paragraphs.
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
 * Purely presentational — the stored text is untouched.
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
          {p}
        </p>
      ))}
    </>
  );
}
