/**
 * Section-aware backgrounds — the photo behind the app follows the part of the
 * app you are in. Engineering shows engineering; Estimates shows a cost
 * estimate on a desk; anything that belongs to no section keeps the generic
 * twelve-photo set in `backgrounds.ts`.
 *
 * Pure and client-safe, for the same reason as `backgrounds.ts` and `glass.ts`:
 * the client backdrop imports it, so it must pull in nothing that would drag
 * Prisma or `next/headers` into the browser bundle. Everything here is data and
 * string work — no React, no I/O, no `next/navigation`.
 *
 * THE FILES MAY NOT BE THERE YET
 * ------------------------------
 * The photographs are produced by a separate lane and dropped into
 * `public/backgrounds/<section>/01.jpg … 04.jpg`. Nothing here asserts they
 * exist. `usableBackgrounds()` is the single place that decides what a section
 * can actually show: it drops entries the browser has already failed to load
 * and, when a section has nothing left (an empty or half-filled folder), hands
 * back the generic set instead. A 404 therefore costs one dead entry, never a
 * blank app.
 */

import { DASHBOARD_BACKGROUNDS, type DashboardBackground } from "./backgrounds";

/**
 * Every section that has its own folder of photographs. The strings are the
 * folder names under `public/backgrounds/` and are part of the contract with
 * the imagery lane — renaming one orphans four files.
 */
export const SECTION_KEYS = [
  "architecture",
  "engineering",
  "interior",
  "design",
  "estimating",
  "schedule",
  "projects",
  "construction",
  "procurement",
  "drawings",
  "business",
  "people",
  "reports",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/** `null` means "no section" — the generic `public/backgrounds/dashboard` set. */
export type BackgroundSection = SectionKey | null;

/**
 * Route prefix → section.
 *
 * Order in this literal is documentation only; matching sorts by prefix length
 * so the longest wins, which is what keeps `/design/architecture` out of the
 * hands of `/design`. A prefix matches the path itself or a path one segment
 * deeper (`/estimates` and `/estimates/abc`, never `/estimates-archive`), so a
 * detail page inherits its section for free.
 *
 * Everything absent from this table — `/dashboard`, `/modules/*`, `/settings`,
 * `/account`, `/admin`, `/search`, `/notifications`, `/forms` — is deliberately
 * sectionless and keeps the generic set. Those are either cross-cutting or the
 * shell itself; giving them a themed photo would say something untrue about
 * where the user is.
 */
const ROUTE_SECTIONS: ReadonlyArray<readonly [string, SectionKey]> = [
  // Design module — the three discipline registers sit UNDER /design, so they
  // must be matched before it (see the sort below).
  ["/design/architecture", "architecture"],
  ["/design/engineering", "engineering"],
  ["/design/interior", "interior"],
  // /design itself: the register, /design/new, /design/deliverable/*,
  // /design/service-proposals/*.
  ["/design", "design"],

  ["/estimates", "estimating"],
  ["/cost-database", "estimating"],

  ["/schedule", "schedule"],
  ["/tasks", "schedule"],

  ["/projects", "projects"],
  ["/development", "projects"],

  ["/construction-admin", "construction"],

  ["/procurement", "procurement"],
  ["/materials", "procurement"],

  ["/drawings", "drawings"],
  ["/documents", "drawings"],

  ["/clients", "business"],
  ["/proposals", "business"],
  ["/orders", "business"],
  ["/meetings", "business"],

  ["/team", "people"],
  ["/chat", "people"],
  ["/leave", "people"],

  ["/reports", "reports"],
  ["/activity", "reports"],
  ["/widgets", "reports"],
  ["/imports", "reports"],
  ["/exports", "reports"],
  ["/beta-reports", "reports"],
];

/** Longest prefix first — the whole of the precedence rule, in one line. */
const MATCH_ORDER: ReadonlyArray<readonly [string, SectionKey]> = [...ROUTE_SECTIONS].sort(
  (a, b) => b[0].length - a[0].length,
);

/**
 * The section a route belongs to, or `null` for the generic set.
 *
 * Tolerant of what a router actually hands over: a missing pathname (the hook
 * can return null before the router is ready), a trailing slash, mixed case, a
 * stray query string or hash. It never throws and never returns a key that is
 * not in `SECTION_KEYS`.
 */
export function sectionForPath(pathname: string | null | undefined): SectionKey | null {
  if (typeof pathname !== "string" || pathname.length === 0) return null;

  // `usePathname()` gives a bare path, but a caller passing `router.asPath` or a
  // stored href would bring the query with it.
  let path = pathname.split("?")[0]!.split("#")[0]!.toLowerCase();
  if (!path.startsWith("/")) path = `/${path}`;
  // Normalise the trailing slash so `/design/` matches `/design`.
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  for (const [prefix, section] of MATCH_ORDER) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return section;
  }
  return null;
}

/** Four photographs per section, on the contract `<section>/01.jpg … 04.jpg`. */
function set(section: SectionKey, entries: ReadonlyArray<[string, string]>): DashboardBackground[] {
  return entries.map(([label, description], i) => ({
    // Namespaced so ids stay unique across all fourteen sets — the backdrop
    // tracks dead images by id and must never confuse two sections' photos.
    id: `${section}-${String(i + 1).padStart(2, "0")}`,
    src: `/backgrounds/${section}/${String(i + 1).padStart(2, "0")}.jpg`,
    label,
    description,
  }));
}

/**
 * The per-section manifests. Labels are what a human sees in the Shuffle chip's
 * tooltip, so they read as captions rather than filenames.
 */
export const SECTION_BACKGROUNDS: Readonly<Record<SectionKey, readonly DashboardBackground[]>> = {
  architecture: set("architecture", [
    ["Facade in raking daylight", "A finished building facade raked by low daylight."],
    ["Study model on the table", "A card and timber study model on a studio table."],
    ["Plan and section on trace", "Plan and section drawings laid out on tracing paper."],
    ["Courtyard, long shadows", "A quiet courtyard crossed by long afternoon shadows."],
  ]),
  engineering: set("engineering", [
    ["Structural frame under load", "A structural steel frame standing against open sky."],
    ["Steel connection detail", "A bolted steel connection photographed close in."],
    ["Analysis model on screen", "A structural analysis model displayed on a workstation."],
    ["Reinforcement before the pour", "Tied reinforcement laid across a slab before concrete."],
  ]),
  interior: set("interior", [
    ["Furnished room, soft daylight", "A furnished interior lit by soft indirect daylight."],
    ["Finish samples laid out", "Fabric, stone and timber finish samples arranged on a table."],
    ["Joinery detail", "A close view of fitted joinery and its hardware."],
    ["Lighting study at dusk", "An interior lighting scheme photographed at dusk."],
  ]),
  design: set("design", [
    ["Sketching over a layout", "A hand sketching in pencil over a printed layout."],
    ["Drawing set on the desk", "A bound drawing set open on a working desk."],
    ["Concept boards on the wall", "Concept boards and reference images pinned to a studio wall."],
    ["Trace roll and pencils", "A roll of trace, scale rule and pencils on a drafting table."],
  ]),
  estimating: set("estimating", [
    ["Cost estimate on a desk", "A printed cost estimate spread across a desk."],
    ["Quantities and a calculator", "A quantity take-off sheet beside a desk calculator."],
    ["Priced bill of quantities", "A priced bill of quantities under a desk lamp."],
    ["Take-off over a floor plan", "Measured take-off marks drawn over a floor plan."],
  ]),
  schedule: set("schedule", [
    ["Programme on the wall", "A printed bar-chart programme pinned across a wall."],
    ["Programme review", "A construction programme reviewed on a meeting table."],
    ["Milestones on a calendar", "Milestone dates marked on a wall calendar."],
    ["Site programme on a clipboard", "A site programme held on a clipboard."],
  ]),
  projects: set("projects", [
    ["Project board with drawings", "A project board carrying drawings and progress notes."],
    ["Site plan across the table", "A site plan opened flat across a table."],
    ["Development model overhead", "A masterplan model photographed from directly above."],
    ["Project site from the air", "An aerial view of a project site and its surroundings."],
  ]),
  construction: set("construction", [
    ["Site inspection walk", "An inspection walk through a building under construction."],
    ["Formwork and scaffold", "Formwork and scaffold standing around a rising structure."],
    ["Crane against open sky", "A tower crane silhouetted against open sky."],
    ["Concrete pour in progress", "A concrete pour under way on a slab."],
  ]),
  procurement: set("procurement", [
    ["Material samples laid out", "Material samples arranged for selection and comparison."],
    ["Delivery arriving on site", "A material delivery being unloaded on site."],
    ["Stacked material in the yard", "Stacked and labelled material in a supply yard."],
    ["Purchase orders on a desk", "Purchase orders and supplier quotations on a desk."],
  ]),
  drawings: set("drawings", [
    ["Rolled drawings on a rack", "Rolled drawings stored upright in a plan rack."],
    ["Sheet in the plan press", "A drawing sheet drawn out of a plan press."],
    ["Title block, close in", "The title block corner of a drawing sheet, close in."],
    ["Drawing set fanned open", "A drawing set fanned open across a table."],
  ]),
  business: set("business", [
    ["Meeting around the table", "A client meeting under way around a table."],
    ["Documents and a pen", "Contract documents and a pen on a desk."],
    ["Signed agreement", "A signed agreement resting on a desk."],
    ["Boardroom, morning light", "An empty boardroom in early morning light."],
  ]),
  people: set("people", [
    ["The studio at work", "A design studio at work at its desks."],
    ["Site team briefing", "A site team gathered for a morning briefing."],
    ["Hard hats on the rack", "Hard hats and vests hanging on a site rack."],
    ["Conversation at the desk", "Two colleagues talking over a drawing at a desk."],
  ]),
  reports: set("reports", [
    ["Charts printed out", "Printed charts and summaries spread on a desk."],
    ["Report under a lamp", "A bound report open under a desk lamp."],
    ["Figures on screen", "Project figures displayed on a monitor."],
    ["Tables and a pen", "Data tables annotated in pen."],
  ]),
};

/** The published set for a section, ignoring whether the files load. */
export function backgroundSet(section: BackgroundSection): readonly DashboardBackground[] {
  return section ? SECTION_BACKGROUNDS[section] : DASHBOARD_BACKGROUNDS;
}

/**
 * What a section can actually show right now.
 *
 * `dead` carries the ids whose file the browser already failed to fetch. When
 * that empties a section — an unfilled folder, a lane still rendering — the
 * generic set stands in rather than the app going bare. Returns an empty array
 * only when the generic set is dead too, which is the signal to drop the
 * backdrop entirely.
 */
export function usableBackgrounds(
  section: BackgroundSection,
  dead: readonly string[] = [],
): readonly DashboardBackground[] {
  const live = backgroundSet(section).filter((b) => !dead.includes(b.id));
  if (live.length > 0) return live;
  return section ? DASHBOARD_BACKGROUNDS.filter((b) => !dead.includes(b.id)) : [];
}

/**
 * The photo a section opens on. Deterministic in `seed` (the server-picked
 * index) so the first render is the same on both sides of hydration, and so a
 * user's own start photo is stable per section rather than arbitrary.
 */
export function startBackground(
  section: BackgroundSection,
  dead: readonly string[] = [],
  seed = 0,
): DashboardBackground | null {
  const live = usableBackgrounds(section, dead);
  if (live.length === 0) return null;
  const n = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  return live[n % live.length] ?? null;
}

/**
 * The next usable photo after `currentId` within a section, wrapping. A
 * `currentId` from another section (or a dead one) is not an error — the
 * rotation simply starts at the top of the new set, which is exactly what a
 * cross-section move wants. Null when nothing anywhere is loadable.
 */
export function nextBackground(
  section: BackgroundSection,
  currentId: string | null,
  dead: readonly string[] = [],
): DashboardBackground | null {
  const live = usableBackgrounds(section, dead);
  if (live.length === 0) return null;
  const i = live.findIndex((b) => b.id === currentId);
  return live[(i + 1) % live.length] ?? null;
}
