/**
 * Dashboard background photo set (opt-in per user — Settings › Preferences).
 *
 * Pure and client-safe: no Prisma, no `next/headers`, no `server-only`. The
 * dashboard server page and the client backdrop both read this list, so it must
 * import nothing that would drag the DB into the browser bundle
 * (see the boundary note in `lib/data/preferences.ts`).
 *
 * The image files are produced and dropped into `public/backgrounds/dashboard/`
 * by a separate lane, so at runtime one of them may not exist yet. Nothing here
 * asserts the files are present — the backdrop marks an entry dead on the first
 * load error and moves on, which is why `nextBackgroundIndex` takes a skip list.
 */

export type DashboardBackground = {
  /** Stable key — also the React key for the image layer. */
  id: string;
  /** Public path; served straight out of `public/`. */
  src: string;
  /** Shown to a human choosing/debugging the set. Not rendered to end users. */
  label: string;
  /** What the photo shows. The rendered <Image> is decorative (alt=""). */
  description: string;
};

const DIR = "/backgrounds/dashboard";

export const DASHBOARD_BACKGROUNDS: readonly DashboardBackground[] = [
  {
    id: "blueprint-desk",
    src: `${DIR}/01-blueprint-desk.jpg`,
    label: "Drafting table at night",
    description: "Drawings and instruments on a drafting table under a low desk lamp.",
  },
  {
    id: "steel-frame",
    src: `${DIR}/02-steel-frame.jpg`,
    label: "Steel frame in fog",
    description: "Bare structural steel frame receding into morning fog.",
  },
  {
    id: "concrete-facade",
    src: `${DIR}/03-concrete-facade.jpg`,
    label: "Concrete fins, raking sun",
    description: "Board-formed concrete fins raked by low sunlight.",
  },
  {
    id: "site-dusk",
    src: `${DIR}/04-site-dusk.jpg`,
    label: "Site at dusk",
    description: "Construction site silhouetted against a deep blue dusk sky.",
  },
  {
    id: "atrium-light",
    src: `${DIR}/05-atrium-light.jpg`,
    label: "Atrium daylight",
    description: "Daylight falling through a tall glazed atrium onto pale floors.",
  },
  {
    id: "wireframe-lines",
    src: `${DIR}/06-wireframe-lines.jpg`,
    label: "Structural wireframe",
    description: "Fine wireframe linework of a structural model on a dark ground.",
  },
  {
    id: "truss-canopy",
    src: `${DIR}/07-truss-canopy.jpg`,
    label: "Truss canopy overhead",
    description: "Long-span steel truss canopy seen from directly below.",
  },
  {
    id: "rebar-grid",
    src: `${DIR}/08-rebar-grid.jpg`,
    label: "Rebar mat before the pour",
    description: "Tied reinforcement mat laid out across a slab before concrete.",
  },
  {
    id: "glass-tower-dusk",
    src: `${DIR}/09-glass-tower-dusk.jpg`,
    label: "Curtain wall at dusk",
    description: "Unitised curtain wall reflecting a fading dusk sky.",
  },
  {
    id: "tunnel-formwork",
    src: `${DIR}/10-tunnel-formwork.jpg`,
    label: "Tunnel formwork",
    description: "Curved tunnel formwork lit by strung work lights.",
  },
  {
    id: "model-maquette",
    src: `${DIR}/11-model-maquette.jpg`,
    label: "Scale model, raking light",
    description: "Massing model in card and timber under hard raking light.",
  },
  {
    id: "bridge-cables",
    src: `${DIR}/12-bridge-cables.jpg`,
    label: "Cable-stayed bridge",
    description: "Stay cables fanning from a bridge pylon against open sky.",
  },
];

/**
 * How long one photo holds before the rotation moves on. Single source of truth
 * for the Settings dropdown, the stored preference default, and the timer.
 */
export const BACKGROUND_INTERVALS: ReadonlyArray<{ seconds: number; label: string }> = [
  { seconds: 10, label: "10 seconds" },
  { seconds: 30, label: "30 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 600, label: "10 minutes" },
  { seconds: 1800, label: "30 minutes" },
];

export const DEFAULT_BACKGROUND_INTERVAL_SECONDS = 10;

/**
 * `User.preferences` is free-form JSON, so a stale or hand-edited value can be
 * anything at all. Nothing outside the published list is ever allowed to become
 * a timer — an unrecognised value falls back to the default.
 */
export function coerceBackgroundIntervalSeconds(value: unknown): number {
  return BACKGROUND_INTERVALS.some((i) => i.seconds === value)
    ? (value as number)
    : DEFAULT_BACKGROUND_INTERVAL_SECONDS;
}

/**
 * Starting image for a user. Deterministic on purpose: the server renders this
 * index into the HTML and the client hydrates from the same prop, so a random
 * pick here would be a hydration mismatch waiting to happen. Randomness lives
 * only in the browser, after mount (the rotation and the Shuffle button).
 */
export function pickDashboardBackgroundIndex(seed?: string | null): number {
  if (!seed) return 0;
  // FNV-1a — spreads adjacent user ids across the set.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % DASHBOARD_BACKGROUNDS.length;
}

/**
 * The next usable image after `current`, skipping any index in `skip` (entries
 * whose file failed to load). Returns null when every image is unusable, which
 * is the signal to drop the whole backdrop and leave the dashboard plain.
 */
export function nextBackgroundIndex(current: number, skip: readonly number[] = []): number | null {
  const n = DASHBOARD_BACKGROUNDS.length;
  for (let step = 1; step <= n; step++) {
    const i = (current + step) % n;
    if (!skip.includes(i)) return i;
  }
  return null;
}
