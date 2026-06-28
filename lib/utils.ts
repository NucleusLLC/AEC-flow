/**
 * Lightweight className combiner. Filters out falsy values and joins the rest
 * with a space. Avoids pulling in clsx/tailwind-merge for now — keep it lean.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Returns the initials (max 2) for a person's name. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
