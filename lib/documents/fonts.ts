/**
 * Approved document font catalog (directive §11).
 *
 * WHY THIS EXISTS. The only font control in the app was a free-text input
 * (`footer.fontFamily`, stored with `.slice(0, 120)` and applied as an inline
 * style) that affected the footer and nothing else. Any string was accepted, so
 * a typo silently fell back to the browser default at print time — exactly the
 * "arbitrary unvalidated fonts" §48 prohibits. See docs/document-system/01-AUDIT.md §F5.
 *
 * Fonts are referenced by stable `id`, never by raw CSS name, so an issued
 * document can record what it was typeset in and keep rendering that way after
 * the default changes (§11.5).
 *
 * LICENSING IS LOAD-BEARING. `embeddable` and `licenseVerified` are not
 * decoration: a PDF renderer may only embed a face the practice is licensed to
 * embed. Aptos (Microsoft-proprietary) and Helvetica Neue (Linotype/Monotype)
 * appear in the directive's list but cannot be shipped as bundled/embeddable
 * without a licence held by the operator, so they are `system` or `disabled`
 * until one is confirmed. Do not flip these flags without a written licence.
 */

import type { DocumentType } from "@/lib/documents/types";

export interface DocumentFontOption {
  id: string;
  displayName: string;

  cssFamily: string;
  fallbackStack: string[];

  fontSource: "bundled" | "system" | "licensed" | "remote-approved";

  supportedRenderers: {
    html: boolean;
    pdf: boolean;
    docx: boolean;
    email: boolean;
  };

  multilingualSupport: boolean;
  embeddable: boolean;
  licenseVerified: boolean;

  recommendedFor: DocumentType[];
  status: "active" | "experimental" | "disabled";

  /** Why a font is restricted. Surfaced in Document Control so the limit is visible. */
  note?: string;
}

/**
 * The shared fallback tail. Every stack ends here so that a face which fails to
 * load degrades to something metrically reasonable rather than to a serif.
 */
const TAIL = ["Helvetica Neue", "Arial", "sans-serif"];

export const FONT_CATALOG: DocumentFontOption[] = [
  {
    id: "inter",
    displayName: "Inter",
    cssFamily: "Inter",
    fallbackStack: ["Source Sans 3", ...TAIL],
    fontSource: "bundled",
    supportedRenderers: { html: true, pdf: true, docx: false, email: false },
    multilingualSupport: true,
    embeddable: true,
    licenseVerified: true, // SIL Open Font License 1.1
    recommendedFor: ["proposal", "serviceProposal", "letter", "memo", "fieldReport", "meetingMinutes"],
    status: "active",
    note: "Recommended default. OFL 1.1. Not a Word style font — DOCX falls back to Aptos/Arial.",
  },
  {
    id: "source-sans-3",
    displayName: "Source Sans 3",
    cssFamily: "Source Sans 3",
    fallbackStack: ["Inter", ...TAIL],
    fontSource: "bundled",
    supportedRenderers: { html: true, pdf: true, docx: false, email: false },
    multilingualSupport: true,
    embeddable: true,
    licenseVerified: true, // OFL 1.1
    recommendedFor: ["proposal", "letter", "fieldReport"],
    status: "active",
  },
  {
    id: "ibm-plex-sans",
    displayName: "IBM Plex Sans",
    cssFamily: "IBM Plex Sans",
    fallbackStack: ["Inter", ...TAIL],
    fontSource: "bundled",
    supportedRenderers: { html: true, pdf: true, docx: false, email: false },
    multilingualSupport: true,
    embeddable: true,
    licenseVerified: true, // OFL 1.1
    recommendedFor: ["changeOrder", "punchList", "register", "estimate", "schedule"],
    status: "active",
    note: "Technical character; suits engineering and construction documents.",
  },
  {
    id: "roboto",
    displayName: "Roboto",
    cssFamily: "Roboto",
    fallbackStack: ["Inter", ...TAIL],
    fontSource: "bundled",
    supportedRenderers: { html: true, pdf: true, docx: false, email: false },
    multilingualSupport: true,
    embeddable: true,
    licenseVerified: true, // Apache 2.0
    recommendedFor: ["punchList", "register", "meetingMinutes"],
    status: "active",
    note: "Compact; fits more rows per page in dense registers.",
  },
  {
    id: "noto-sans",
    displayName: "Noto Sans",
    cssFamily: "Noto Sans",
    fallbackStack: ["Inter", ...TAIL],
    fontSource: "bundled",
    supportedRenderers: { html: true, pdf: true, docx: false, email: false },
    multilingualSupport: true,
    embeddable: true,
    licenseVerified: true, // OFL 1.1
    recommendedFor: ["proposal", "letter", "memo"],
    status: "active",
    note: "Widest glyph coverage — the safest choice for Papiamento, Dutch and Spanish together.",
  },
  {
    id: "helvetica",
    displayName: "Helvetica Neue / Helvetica",
    cssFamily: "Helvetica Neue",
    fallbackStack: ["Helvetica", "Arial", "sans-serif"],
    fontSource: "system",
    supportedRenderers: { html: true, pdf: true, docx: true, email: true },
    multilingualSupport: false,
    embeddable: false,
    licenseVerified: false,
    recommendedFor: ["letter", "memo"],
    status: "active",
    note: "System face — NOT embedded. Renders only where installed (macOS/iOS); Windows falls back to Arial.",
  },
  {
    id: "arial",
    displayName: "Arial",
    cssFamily: "Arial",
    fallbackStack: ["Helvetica", "sans-serif"],
    fontSource: "system",
    supportedRenderers: { html: true, pdf: true, docx: true, email: true },
    multilingualSupport: false,
    embeddable: false,
    licenseVerified: false,
    recommendedFor: ["letter", "memo", "invoice"],
    status: "active",
    note: "Maximum compatibility fallback. Present nearly everywhere; safe for DOCX and email.",
  },
  {
    id: "aptos",
    displayName: "Aptos",
    cssFamily: "Aptos",
    fallbackStack: ["Inter", ...TAIL],
    fontSource: "licensed",
    supportedRenderers: { html: false, pdf: false, docx: true, email: false },
    multilingualSupport: true,
    embeddable: false,
    licenseVerified: false,
    recommendedFor: [],
    status: "disabled",
    note:
      "Microsoft-proprietary. Ships with Office but cannot be bundled or embedded without a licence. " +
      "Disabled until a licence is confirmed — see docs/document-system/01-AUDIT.md D4.",
  },
];

export const DEFAULT_FONT_ID = "inter";

/** Catalog version. Issued documents record this so a later edit is traceable (§11.5). */
export const FONT_CATALOG_VERSION = "1.0.0";

/** Only fonts a user may actually choose. Disabled entries stay in the catalog for provenance. */
export function selectableFonts(): DocumentFontOption[] {
  return FONT_CATALOG.filter((f) => f.status !== "disabled");
}

export function getFont(id: string | null | undefined): DocumentFontOption {
  return FONT_CATALOG.find((f) => f.id === id) ?? getFont(DEFAULT_FONT_ID)!;
}

/** Full CSS `font-family` value for a font id, fallbacks included. */
export function fontFamilyCss(id: string | null | undefined): string {
  const font = getFont(id);
  const quote = (n: string) => (/\s/.test(n) ? `"${n}"` : n);
  return [font.cssFamily, ...font.fallbackStack].map(quote).join(", ");
}

export type RendererKind = keyof DocumentFontOption["supportedRenderers"];

export type FontResolution = {
  requestedId: string;
  /** The font this renderer will actually use. */
  effectiveId: string;
  substituted: boolean;
  /** Present when the renderer cannot honour the request. */
  warning?: string;
};

/**
 * What a given renderer will really do with a font choice.
 *
 * §11.4 forbids silently substituting a materially different face: when a
 * renderer cannot use the requested font this returns an explicit warning for
 * Document Control to display and for document diagnostics to record.
 */
export function resolveFontForRenderer(id: string, renderer: RendererKind): FontResolution {
  const font = getFont(id);

  if (font.status === "disabled") {
    const alternative = fallbackFor(renderer, font.id);
    return {
      requestedId: id,
      effectiveId: alternative.id,
      substituted: true,
      warning:
        `${font.displayName} is disabled (${font.note ?? "not licensed"}). ` +
        `${alternative.displayName} will be used instead.`,
    };
  }

  if (font.supportedRenderers[renderer]) {
    return { requestedId: id, effectiveId: font.id, substituted: false };
  }

  const alternative = fallbackFor(renderer, font.id);
  return {
    requestedId: id,
    effectiveId: alternative.id,
    substituted: true,
    warning:
      `${font.displayName} is not available to the ${renderer.toUpperCase()} renderer. ` +
      `${alternative.displayName} will be used instead — line breaks and page count may differ.`,
  };
}

/**
 * The best substitute that the given renderer can genuinely use.
 *
 * Prefers the catalog default, but only when that default supports the renderer:
 * the default (Inter) has no DOCX support, so a naive "fall back to default"
 * would hand DOCX a font it cannot render. Arial is the last resort precisely
 * because it is the one face every renderer accepts.
 */
function fallbackFor(renderer: RendererKind, excludeId: string): DocumentFontOption {
  const preferred = getFont(DEFAULT_FONT_ID);
  if (preferred.id !== excludeId && preferred.supportedRenderers[renderer]) return preferred;

  return (
    selectableFonts().find((f) => f.id !== excludeId && f.supportedRenderers[renderer]) ??
    getFont("arial")
  );
}
