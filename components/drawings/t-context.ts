/**
 * Translation with a disambiguating key.
 *
 * The dictionary is keyed by the English text, so one English word gets one
 * translation app-wide. A few drawing words collide with another meaning
 * elsewhere ("Schedule" is a programme in core, a door/window table on a sheet;
 * "Landscape" is a discipline and a page orientation). Those are looked up
 * under a context key — "Schedule (sheet type)" — and, when that key has no
 * translation (English), the plain English word is shown.
 */
export function tContext(t: (text: string) => string, english: string, contextKey: string): string {
  const v = t(contextKey);
  return v === contextKey ? english : v;
}

/** Sheet-type label, with "Schedule" kept apart from the programme sense. */
export function sheetTypeText(t: (text: string) => string, label: string): string {
  if (label === "Schedule") return tContext(t, "Schedule", "Schedule (sheet type)");
  return t(label);
}
