/**
 * German, Mandarin, Japanese and Portuguese translate the menu and app chrome
 * only (dict/menu-extra.ts). This keeps that promise honest: every navigation
 * label is covered in all four, the four carry the same keys, and every key is
 * a string the app really shows (it has a Spanish entry).
 */
import { describe, expect, it } from "vitest";
import * as nav from "@/lib/nav";
import * as modules from "@/lib/modules";
import { DICT, LANGS } from "./dictionaries";
import { MENU_EXTRA } from "./dict/menu-extra";
import { LANG_CODES, type MenuLang } from "./types";

const MENU_LANGS = Object.keys(MENU_EXTRA) as MenuLang[];

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

describe("menu-only languages", () => {
  it("are all offered in the picker and accepted as a saved choice", () => {
    for (const l of MENU_LANGS) {
      expect(LANG_CODES).toContain(l);
      expect(LANGS.map((x) => x.code)).toContain(l);
    }
  });

  it("translate every navigation label", () => {
    const labels = navLabels();
    expect(labels.length).toBeGreaterThan(40);
    const missing = MENU_LANGS.flatMap((l) =>
      labels.filter((s) => !MENU_EXTRA[l][s]).map((s) => `${l}: ${s}`),
    );
    expect(missing).toEqual([]);
  });

  it("carry the same keys in all four languages", () => {
    const [first, ...rest] = MENU_LANGS;
    const keys = Object.keys(MENU_EXTRA[first]).sort();
    for (const l of rest) expect(Object.keys(MENU_EXTRA[l]).sort()).toEqual(keys);
  });

  it("only translate strings the app shows (each has a Spanish entry)", () => {
    const stray = Object.keys(MENU_EXTRA.de).filter((k) => !DICT.es[k]);
    expect(stray).toEqual([]);
  });

  it("keep {placeholders} intact", () => {
    for (const l of MENU_LANGS)
      for (const [en, tr] of Object.entries(MENU_EXTRA[l])) {
        const want = en.match(/\{\w+\}/g) ?? [];
        for (const p of want) expect(tr, `${l}: ${en}`).toContain(p);
      }
  });
});
