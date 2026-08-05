/**
 * Schedule "Display Control" preferences — which readouts the board shows.
 *
 * PROTECTED SYSTEM (schedule) — display/chrome change, approved 2026-08-04.
 *
 * Presentation only. Nothing here participates in the CPM engine or in
 * `computeScheduleHealth`: every figure is still computed for every task on
 * every render, and a hidden readout is a figure that was calculated and then
 * not painted. Keeping the decision in a pure module (no React, no `window`)
 * is what lets it be unit-tested next to the other `lib/**` suites without a
 * DOM, and what keeps the calculation and the chrome from ever being confused
 * for one another.
 */

/** Storage key. Namespaced `aecflow:` like `aecflow:lang` — see language-provider. */
export const DISPLAY_PREFS_KEY = "aecflow:schedule:display";

/**
 * The eight toggles, in the owner's words and the owner's order. The panel
 * renders straight from this list so the on-screen order can never drift from
 * the specification.
 */
export const DISPLAY_ITEMS = [
  { key: "actualPlanned", label: "Display Actual/Planned" },
  { key: "spi", label: "SPI" },
  { key: "scheduleVariance", label: "Schedule Variance" },
  { key: "behindOverdue", label: "Behind/Overdue" },
  { key: "baselineFinish", label: "Baseline Finish" },
  { key: "forecast", label: "Forecast" },
  { key: "criticalPathSlipping", label: "Critical Path Slipping" },
  { key: "todayLine", label: "Current Date Vertical Line (RED)" },
] as const;

export type DisplayKey = (typeof DISPLAY_ITEMS)[number]["key"];
export type DisplayPrefs = Record<DisplayKey, boolean>;

/**
 * The six that are metric tiles in the status board, in render order. The last
 * two toggles (critical-path callout, today rule) are not tiles and so must not
 * count toward the grid's column arithmetic.
 */
export const TILE_KEYS = [
  "actualPlanned",
  "spi",
  "scheduleVariance",
  "behindOverdue",
  "baselineFinish",
  "forecast",
] as const satisfies readonly DisplayKey[];

/**
 * Everything on. This is the default, the server render, and the fallback for
 * any storage that cannot be read or cannot be trusted — an existing user sees
 * no change until they choose otherwise, and a corrupt value can never blank
 * the board.
 */
export function defaultDisplayPrefs(): DisplayPrefs {
  return Object.fromEntries(DISPLAY_ITEMS.map((i) => [i.key, true])) as DisplayPrefs;
}

/**
 * Total parse: any input, always a usable set of preferences.
 *
 * Unknown keys are dropped and a key whose value is not a boolean falls back to
 * visible. That last rule is also the forward-compatibility story: a preference
 * blob written before a new toggle existed simply has that toggle on, which is
 * the documented default rather than an accidental hide.
 */
export function parseDisplayPrefs(raw: string | null | undefined): DisplayPrefs {
  const prefs = defaultDisplayPrefs();
  if (typeof raw !== "string" || raw === "") return prefs;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return prefs; // truncated / hand-edited / not JSON at all
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return prefs;

  const obj = parsed as Record<string, unknown>;
  for (const { key } of DISPLAY_ITEMS) {
    if (typeof obj[key] === "boolean") prefs[key] = obj[key];
  }
  return prefs;
}

export function serializeDisplayPrefs(prefs: DisplayPrefs): string {
  return JSON.stringify(prefs);
}

/** How many of the six metric tiles are currently painted. */
export function countVisibleTiles(prefs: DisplayPrefs): number {
  return TILE_KEYS.reduce((n, k) => (prefs[k] ? n + 1 : n), 0);
}

/**
 * Column count for the tile grid, by how many tiles survive the filter.
 *
 * Six columns of which four are hidden must not leave four gaps, so the grid is
 * sized to what is actually rendered rather than to the six tiles that exist in
 * the source. The classes are written out in full because Tailwind scans source
 * text — a composed `grid-cols-${n}` would never be generated.
 */
const TILE_GRID: Record<number, string> = {
  0: "",
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  // Four tiles read better as 2x2 at the small breakpoint than as 3 + 1 orphan.
  4: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  // The original board's responsive shape, preserved for the all-on default.
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
};

export function tileGridClass(visibleCount: number): string {
  const n = Number.isFinite(visibleCount) ? Math.trunc(visibleCount) : 0;
  return TILE_GRID[Math.max(0, Math.min(TILE_KEYS.length, n))] ?? "";
}
