/**
 * Translation coverage. Reads the source off disk as text — no React, no
 * database — and fails when:
 *   - an area has a Spanish key with no Dutch value, or the other way round;
 *   - two areas translate the same English string differently;
 *   - a literal `t("…")` call anywhere in app/, components/ or lib/ has no
 *     Spanish or no Dutch entry.
 * The third check is what keeps "everything translated" true after today.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS } from "./dict";
import { DICT } from "./dictionaries";

const ROOT = resolve(__dirname, "../..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(tsx?|mts)$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(p);
  }
  return out;
}

/** Literal keys passed to t(...). Template literals and variables are skipped. */
function literalKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  // t("…") and tr("…") — some files name the hook tr because a loop variable is t.
  const call = /\btr?\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*[,)]/g;
  for (const dir of ["app", "components", "lib"]) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const src = readFileSync(file, "utf8");
      // Only files that use the translation hooks, import from lib/i18n, or
      // take a translate function as a prop: other modules have their own
      // helpers called t() (lib/data/estimate-presets.ts builds tasks with one).
      const translates =
        /\b(useT|getServerT|useLanguage)\(/.test(src) ||
        /from "@\/lib\/i18n\//.test(src) ||
        /\btr?\??:\s*\(\w+: string\) => string/.test(src);
      if (!translates) continue;
      for (const m of src.matchAll(call)) {
        const key =
          m[1] !== undefined
            ? JSON.parse(`"${m[1]}"`)
            : m[2].replace(/\\'/g, "'");
        if (!keys.has(key)) keys.set(key, file.slice(ROOT.length + 1));
      }
    }
  }
  return keys;
}

describe("i18n dictionaries", () => {
  it("every area has the same keys in Spanish and Dutch", () => {
    for (const [area, d] of Object.entries(AREAS)) {
      const es = Object.keys(d.es).sort();
      const nl = Object.keys(d.nl).sort();
      expect({
        area,
        onlyEs: es.filter((k) => !(k in d.nl)),
        onlyNl: nl.filter((k) => !(k in d.es)),
      }).toEqual({ area, onlyEs: [], onlyNl: [] });
    }
  });

  it("no English string is translated two different ways", () => {
    const clashes: string[] = [];
    for (const lang of ["es", "nl"] as const) {
      const seen = new Map<string, [string, string]>();
      for (const [area, d] of Object.entries(AREAS)) {
        for (const [k, v] of Object.entries(d[lang])) {
          const prev = seen.get(k);
          if (prev && prev[1] !== v)
            clashes.push(
              `${lang} "${k}": ${prev[0]}="${prev[1]}" vs ${area}="${v}"`,
            );
          else seen.set(k, [area, v]);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it("no translation is empty", () => {
    const empty = (["es", "nl"] as const).flatMap((l) =>
      Object.entries(DICT[l])
        .filter(([, v]) => !v.trim())
        .map(([k]) => `${l}: ${k}`),
    );
    expect(empty).toEqual([]);
  });

  it("every literal t() string in the app has Spanish and Dutch", () => {
    const missing: string[] = [];
    for (const [key, file] of literalKeys()) {
      for (const lang of ["es", "nl"] as const) {
        if (!(key in DICT[lang])) missing.push(`${lang}  ${file}  "${key}"`);
      }
    }
    expect(missing).toEqual([]);
  });
});
