// Worst-case WCAG contrast of the dashboard-background glass stack over every
// photo in public/backgrounds. This is where the figures in
// lib/dashboard/glass.ts and the knob block of app/globals.css come from —
// re-run it whenever a photo or a knob changes.
//
//   node scripts/glass-contrast.mjs [dir] [lightSurface%] [darkSurface%] [lightFilter] [darkFilter]
//   env LSCRIM="0.44,0.28,0.20"  DSCRIM="0.42,0.26,0.14"  LFAINT="#374151"  PER_FILE=10
//
// Defaults are the shipped "Standard" step. Two backdrops are modelled per photo:
//   card    — the photo as the 44px backdrop blur sees it: downscaled 4x and
//             gaussian-blurred (sigma 11 ≈ 44px at full size), then the darkest
//             and brightest PIXEL of that. This is what sits under card text.
//   outside — the raw 24x14 block grid (darkest/brightest block), for text that
//             sits on the photo under the top scrim stop only (that is where the
//             greeting and page headings live). The halo is not credited.
// Blur only ever pulls an extreme toward the local mean, so the real card is
// never worse than the "card" figure.
//
// `sharp` comes with Next (an optional dependency it installs); nothing else.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "public/backgrounds";
const LIGHT = Number(process.argv[3] ?? 42) / 100;
const DARK = Number(process.argv[4] ?? 38) / 100;
const LF = Number(process.argv[5] ?? 1);
const DF = Number(process.argv[6] ?? 0.7);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [h, l] = [Math.max(a, b), Math.min(a, b)]; return (h + 0.05) / (l + 0.05); };
const mix = (under, over, a) => under.map((u, i) => u * (1 - a) + over[i] * a);
const scale = (c, k) => c.map((v) => Math.min(1, v * k));

// Mirrors the knob block in app/globals.css. Keep the two in step.
const T = {
  light: {
    filter: LF, scrim: hex("#fffaf3"),
    scrimStops: (process.env.LSCRIM ?? "0.44,0.28,0.20").split(",").map(Number),
    surface: hex("#ffffff"), alpha: LIGHT,
    text: { body: hex("#14181f"), muted: hex("#1f2937"), faint: hex(process.env.LFAINT ?? "#374151") },
  },
  dark: {
    filter: DF, scrim: hex("#141216"),
    scrimStops: (process.env.DSCRIM ?? "0.42,0.26,0.14").split(",").map(Number),
    surface: hex("#1a1a1f"), alpha: DARK,
    text: { body: hex("#e7eaf0"), muted: hex("#e2e6ec"), faint: hex("#c9cfd8") },
  },
};

const files = [];
for (const d of fs.readdirSync(dir)) {
  const p = path.join(dir, d);
  if (!fs.statSync(p).isDirectory()) continue;
  for (const f of fs.readdirSync(p)) if (/\.jpe?g$/i.test(f)) files.push(path.join(p, f));
}

function extremes(raw) {
  let lo = null, hi = null, loL = 2, hiL = -1;
  for (let i = 0; i < raw.length; i += 3) {
    const px = [raw[i] / 255, raw[i + 1] / 255, raw[i + 2] / 255];
    const L = lum(px);
    if (L < loL) { loL = L; lo = px; }
    if (L > hiL) { hiL = L; hi = px; }
  }
  return [lo, hi];
}

const worst = { light: {}, dark: {} };
const perFile = [];
for (const f of files) {
  const blocks = extremes(await sharp(f).resize(24, 14, { fit: "fill" }).raw().toBuffer());
  const blurred = extremes(await sharp(f).resize(480, 270, { fit: "fill" }).blur(11).raw().toBuffer());
  const row = { f: path.relative(dir, f) };
  for (const theme of ["light", "dark"]) {
    const t = T[theme];
    for (const [where, ext] of [["outside", blocks], ["card", blurred]]) {
      for (const px of ext) {
        const photo = scale(px, t.filter);
        // Text outside a card only ever sits in the top band (greeting, page
        // heading); cards can land on any stop.
        for (const stop of where === "card" ? t.scrimStops : [t.scrimStops[0]]) {
          const washed = mix(photo, t.scrim, stop);
          const bg = where === "card" ? lum(mix(washed, t.surface, t.alpha)) : lum(washed);
          for (const [tier, col] of Object.entries(t.text)) {
            const r = ratio(lum(col), bg);
            const k = `${tier}/${where}`;
            if (!worst[theme][k] || r < worst[theme][k].r) worst[theme][k] = { r, f: row.f, stop };
            const rk = `${theme}:${k}`;
            if (row[rk] === undefined || r < row[rk]) row[rk] = r;
          }
        }
      }
    }
  }
  perFile.push(row);
}
for (const theme of ["light", "dark"]) {
  console.log(theme, `(surface ${theme === "light" ? LIGHT : DARK}, filter ${theme === "light" ? LF : DF})`);
  for (const [k, v] of Object.entries(worst[theme]).sort()) console.log(`  ${k.padEnd(14)} ${v.r.toFixed(2)}:1  ${v.f}  scrim ${v.stop}`);
}
if (process.env.PER_FILE) {
  console.log("\nper-file body/card (light, dark) — worst first");
  perFile.sort((a, b) => Math.min(a["light:body/card"], a["dark:body/card"]) - Math.min(b["light:body/card"], b["dark:body/card"]));
  for (const r of perFile.slice(0, Number(process.env.PER_FILE) || 15)) console.log(`  ${r.f.padEnd(34)} ${r["light:body/card"].toFixed(2)}  ${r["dark:body/card"].toFixed(2)}`);
}
