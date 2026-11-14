/**
 * Read a list out of a page's `searchParams`.
 *
 * Next hands a repeated query key (`?milestones=a&milestones=b` — exactly what a
 * GET form with several ticked checkboxes of the same name submits) to the page
 * as a `string[]`, a single one as a `string`, and a missing one as `undefined`.
 * Typing the param as `string` and calling `.split` on it crashes the page as soon
 * as a second box is ticked. This accepts every shape, and also comma-separated
 * values, so hand-written links like `?milestones=a,b` keep working.
 */
export function paramList(value: string | string[] | undefined | null): string[] {
  const parts = Array.isArray(value) ? value : value ? [value] : [];
  return parts
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean);
}
