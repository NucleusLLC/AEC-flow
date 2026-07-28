/**
 * DocumentFont — applies the configured document typeface to a printed document.
 *
 * Wraps its children in a subtree that (a) carries the bundled font variables so
 * the self-hosted files are actually loaded, and (b) sets `font-family` to the
 * selected face with its full fallback chain.
 *
 * The selection is resolved through `resolveFontForRenderer(id, "html")` rather
 * than trusted verbatim: a disabled or renderer-unsupported face must degrade to
 * something the renderer can genuinely paint, and must say so instead of
 * silently substituting (directive §11.4). Browser print is the "html" renderer —
 * Save-as-PDF prints what the page already shows.
 */
import { documentFontVariables, bundledFontVariable } from "@/lib/documents/font-loader";
import { fontFamilyCss, getFont, resolveFontForRenderer } from "@/lib/documents/fonts";

export function DocumentFont({
  fontId,
  children,
  className = "",
}: {
  fontId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const resolution = resolveFontForRenderer(fontId, "html");
  const font = getFont(resolution.effectiveId);

  // A bundled face is referenced through its CSS variable so the self-hosted
  // file is used; a system face is named directly, since there is no file to load.
  const variable = bundledFontVariable(font.id);
  const family = variable
    ? `var(${variable}), ${fontFamilyCss(font.id)}`
    : fontFamilyCss(font.id);

  return (
    <div
      className={`${documentFontVariables} ${className}`.trim()}
      style={{ fontFamily: family }}
      data-document-font={font.id}
      data-document-font-requested={resolution.requestedId}
      data-document-font-substituted={resolution.substituted ? "true" : "false"}
    >
      {children}
    </div>
  );
}
