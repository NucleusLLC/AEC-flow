/**
 * German, Chinese, Japanese and Portuguese translate the whole app, one folder
 * per language (dict/<lang>/<area>.ts). This holds them to the same bar as
 * Spanish and Dutch (coverage.test.ts): exactly the keys of each area, nothing
 * empty, every {placeholder} kept, one translation per English string — and
 * every navigation label, which reaches t() as data rather than a literal, in
 * all six languages.
 */
import { describe, expect, it } from "vitest";
import * as nav from "@/lib/nav";
import * as modules from "@/lib/modules";
import { AREAS } from "./dict";
import { EXTRA_AREAS } from "./dict/extra";
import { DICT, LANGS } from "./dictionaries";
import { LANG_CODES, type ExtraLang } from "./types";

const EXTRA = Object.keys(EXTRA_AREAS) as ExtraLang[];

/** Every label/title/tagline string reachable from the nav and module definitions. */
function navLabels(): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, depth: number) => {
    if (depth > 8 || v == null) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    if (typeof v !== "object") return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if ((k === "label" || k === "title" || k === "tagline") && typeof x === "string") out.add(x);
      else walk(x, depth + 1);
    }
  };
  walk(nav, 0);
  walk(modules, 0);
  return [...out];
}

describe("German, Chinese, Japanese and Portuguese", () => {
  it("are offered in the picker and accepted as a saved choice", () => {
    for (const l of EXTRA) {
      expect(LANG_CODES).toContain(l);
      expect(LANGS.map((x) => x.code)).toContain(l);
    }
  });

  it("cover exactly the keys of every area", () => {
    for (const l of EXTRA) {
      expect(Object.keys(EXTRA_AREAS[l]).sort()).toEqual(Object.keys(AREAS).sort());
      for (const [area, d] of Object.entries(AREAS)) {
        const want = Object.keys(d.es).sort();
        const have = Object.keys(EXTRA_AREAS[l][area] ?? {}).sort();
        expect({
          area: `${l}/${area}`,
          missing: want.filter((k) => !have.includes(k)),
          extra: have.filter((k) => !want.includes(k)),
        }).toEqual({ area: `${l}/${area}`, missing: [], extra: [] });
      }
    }
  });

  it("leave nothing empty and keep every {placeholder}", () => {
    const bad: string[] = [];
    for (const l of EXTRA)
      for (const [area, d] of Object.entries(EXTRA_AREAS[l]))
        for (const [en, tr] of Object.entries(d)) {
          if (!tr.trim()) bad.push(`${l}/${area} empty: ${en}`);
          for (const p of en.match(/\{\w+\}/g) ?? [])
            if (!tr.includes(p)) bad.push(`${l}/${area} lost ${p}: ${en}`);
        }
    expect(bad).toEqual([]);
  });

  it("translate each English string one way per language", () => {
    const clashes: string[] = [];
    for (const l of EXTRA) {
      const seen = new Map<string, [string, string]>();
      for (const [area, d] of Object.entries(EXTRA_AREAS[l]))
        for (const [k, v] of Object.entries(d)) {
          const prev = seen.get(k);
          if (prev && prev[1] !== v) clashes.push(`${l} "${k}": ${prev[0]}="${prev[1]}" vs ${area}="${v}"`);
          else seen.set(k, [area, v]);
        }
    }
    expect(clashes).toEqual([]);
  });
});

describe("navigation", () => {
  it("has every label in all six languages", () => {
    const labels = navLabels();
    expect(labels.length).toBeGreaterThan(40);
    const missing = LANG_CODES.filter((l) => l !== "en").flatMap((l) =>
      labels.filter((s) => !DICT[l][s]).map((s) => `${l}: ${s}`),
    );
    expect(missing).toEqual([]);
  });
});
