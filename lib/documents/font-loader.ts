/**
 * Loads the bundled document fonts and maps catalog ids to CSS variables.
 *
 * The catalog in lib/documents/fonts.ts declares five faces as `bundled` and
 * `embeddable`. That claim is only true if the font files are actually served,
 * so they are loaded here through `next/font/google`, which self-hosts the files
 * from our own origin — no runtime request to Google, and a real font file in
 * the page rather than a family name the browser may or may not resolve.
 *
 * `next/font` calls must be module-scope literals, so every family is declared
 * eagerly. They are only referenced by document surfaces, and Next tree-shakes
 * per route, so ordinary app pages do not pay for faces they never render.
 *
 * `display: "block"` is deliberate and differs from the usual web default: a
 * document that swaps face mid-render would repaginate under the user, and a
 * print job started during the swap window can capture the fallback metrics.
 * Blocking briefly is the correct trade for something destined for paper.
 */
import {
  Inter,
  Source_Sans_3,
  IBM_Plex_Sans,
  Roboto,
  Noto_Sans,
} from "next/font/google";

// Every option below must be an inline literal: next/font is resolved at build
// time by a static analyser, so a shared `subsets` constant — even `[...LATIN]` —
// fails with "Unexpected spread". The repetition is required, not accidental.
// `latin-ext` covers the accented characters Dutch, Spanish and Papiamento need.

const inter = Inter({
  variable: "--doc-font-inter",
  subsets: ["latin", "latin-ext"],
  display: "block",
});

const sourceSans3 = Source_Sans_3({
  variable: "--doc-font-source-sans-3",
  subsets: ["latin", "latin-ext"],
  display: "block",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--doc-font-ibm-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "block",
});

const roboto = Roboto({
  variable: "--doc-font-roboto",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  display: "block",
});

const notoSans = Noto_Sans({
  variable: "--doc-font-noto-sans",
  subsets: ["latin", "latin-ext"],
  display: "block",
});

/**
 * The class list that makes every bundled face available on a document subtree.
 * Apply once, high up, then switch faces by `font-family` without reloading.
 */
export const documentFontVariables = [
  inter.variable,
  sourceSans3.variable,
  ibmPlexSans.variable,
  roboto.variable,
  notoSans.variable,
].join(" ");

/**
 * CSS variable holding the real (self-hosted) family for a bundled catalog id.
 * System faces — Helvetica, Arial — have no variable: they are resolved by name
 * from the operating system, which is exactly what `fontSource: "system"` means.
 */
const BUNDLED_VAR: Record<string, string> = {
  inter: "--doc-font-inter",
  "source-sans-3": "--doc-font-source-sans-3",
  "ibm-plex-sans": "--doc-font-ibm-plex-sans",
  roboto: "--doc-font-roboto",
  "noto-sans": "--doc-font-noto-sans",
};

export function bundledFontVariable(fontId: string): string | null {
  return BUNDLED_VAR[fontId] ?? null;
}

export function isBundledFont(fontId: string): boolean {
  return fontId in BUNDLED_VAR;
}
