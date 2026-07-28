import { describe, it, expect } from "vitest";
import {
  FONT_CATALOG,
  DEFAULT_FONT_ID,
  selectableFonts,
  getFont,
  fontFamilyCss,
  resolveFontForRenderer,
} from "@/lib/documents/fonts";

describe("font catalog integrity", () => {
  it("has unique ids", () => {
    const ids = FONT_CATALOG.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ships the default as an active, embeddable, licence-verified font", () => {
    const d = getFont(DEFAULT_FONT_ID);
    expect(d.status).toBe("active");
    expect(d.embeddable).toBe(true);
    expect(d.licenseVerified).toBe(true);
  });

  it("never marks a font embeddable without a verified licence", () => {
    // The rule that keeps an unlicensed face out of an embedded PDF.
    for (const f of FONT_CATALOG) {
      if (f.embeddable) expect(f.licenseVerified, f.displayName).toBe(true);
    }
  });

  it("keeps proprietary faces out of the selectable list until licensed", () => {
    const aptos = getFont("aptos");
    expect(aptos.status).toBe("disabled");
    expect(aptos.licenseVerified).toBe(false);
    expect(selectableFonts().map((f) => f.id)).not.toContain("aptos");
  });

  it("gives every font a fallback chain ending in a generic family", () => {
    for (const f of FONT_CATALOG) {
      expect(f.fallbackStack.length, f.displayName).toBeGreaterThan(0);
      expect(f.fallbackStack[f.fallbackStack.length - 1]).toBe("sans-serif");
    }
  });

  it("offers at least one font per renderer, so no renderer is left unserved", () => {
    for (const r of ["html", "pdf", "docx", "email"] as const) {
      expect(selectableFonts().some((f) => f.supportedRenderers[r]), r).toBe(true);
    }
  });
});

describe("getFont", () => {
  it("falls back to the default for an unknown or empty id", () => {
    expect(getFont("not-a-font").id).toBe(DEFAULT_FONT_ID);
    expect(getFont(null).id).toBe(DEFAULT_FONT_ID);
    expect(getFont(undefined).id).toBe(DEFAULT_FONT_ID);
  });
});

describe("fontFamilyCss", () => {
  it("quotes multi-word families and joins the fallback chain", () => {
    const css = fontFamilyCss("inter");
    expect(css.startsWith("Inter, ")).toBe(true);
    expect(css).toContain('"Source Sans 3"');
    expect(css).toContain('"Helvetica Neue"');
    expect(css.endsWith("sans-serif")).toBe(true);
  });

  it("does not quote single-word families", () => {
    expect(fontFamilyCss("arial")).toBe("Arial, Helvetica, sans-serif");
  });
});

describe("resolveFontForRenderer", () => {
  it("passes through when the renderer supports the font", () => {
    const r = resolveFontForRenderer("inter", "html");
    expect(r.substituted).toBe(false);
    expect(r.effectiveId).toBe("inter");
    expect(r.warning).toBeUndefined();
  });

  it("warns instead of silently substituting when a renderer cannot use the font", () => {
    // Inter is not a Word style font — DOCX must say so, not quietly change face.
    const r = resolveFontForRenderer("inter", "docx");
    expect(r.substituted).toBe(true);
    expect(r.effectiveId).not.toBe("inter");
    expect(r.warning).toMatch(/not available to the DOCX renderer/i);
    expect(r.warning).toMatch(/page count may differ/i);
  });

  it("substitutes a disabled font and explains why", () => {
    const r = resolveFontForRenderer("aptos", "html");
    expect(r.substituted).toBe(true);
    expect(r.effectiveId).toBe(DEFAULT_FONT_ID);
    expect(r.warning).toMatch(/disabled/i);
  });

  it("always resolves to a font the renderer actually supports", () => {
    for (const f of FONT_CATALOG) {
      for (const renderer of ["html", "pdf", "docx", "email"] as const) {
        const r = resolveFontForRenderer(f.id, renderer);
        expect(getFont(r.effectiveId).supportedRenderers[renderer], `${f.id}->${renderer}`).toBe(true);
      }
    }
  });

  it("records the requested id even when substituting, for document diagnostics", () => {
    const r = resolveFontForRenderer("inter", "docx");
    expect(r.requestedId).toBe("inter");
  });
});
