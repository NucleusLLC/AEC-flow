/**
 * Fill named slots in a translated template, so word order can change per
 * language: fmt(t("{count} of {total} approved"), { count: 3, total: 8 }).
 * The template (with its braces) is the dictionary key.
 */
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}
