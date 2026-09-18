/**
 * Does any printed document paint content where the page cannot carry it?
 *
 * WHY A BROWSER AND NOT A UNIT TEST. The paged preview decides where pages end by
 * measuring real geometry, and the failure this script exists to catch is
 * invisible without a layout engine: a footer band drawn across live content.
 * jsdom has no layout, and `lib/documents/pagination.test.ts` can only prove the
 * arithmetic — it cannot know whether the gap the component asks for actually
 * opened. A table row, for one, silently discards the top margin the component
 * used to open it with (see lib/documents/gutter), and every register in this app
 * is a table.
 *
 * WHAT IT ASSERTS, per page of every document it is given — the four things a
 * reader would complain about:
 *
 *   1. no content under a footer    the original defect
 *   2. no page is blank            a page whose content vanished
 *   3. no page is mostly empty     the wasted sheet (UNUSED_AREA_WARN, §7.1)
 *   4. no page is over-long        a "page" holding more than a page will hold
 *   5. no text lost                characters before and after the pass agree
 *
 * Rules 3 and 4 are measured against the PRINTABLE HEIGHT the document publishes
 * (`data-paged-page-height-mm`), not against the boundary the preview drew. An
 * earlier version of this script divided the content by the distance to the
 * preview's own footer band, which is placed at the end of the content — so every
 * page was "100% full" and both rules passed on a document whose first page held
 * 1797px against a 994px page. A check that reads its own answer back is
 * decorative.
 *
 * "Content" is decided the same way the component decides it: everything that is
 * not preview chrome, excluded BY ANCESTRY rather than by an element's own
 * attribute — a chrome wrapper is marked, the spans inside it are not, and a
 * check that counted those spans would report a blank page as full.
 *
 * Run it against a server serving the build under test, with a document long
 * enough to paginate:
 *
 *   node scripts/verify-print-overflow.mjs \
 *     --base http://localhost:3100 \
 *     --email you@example.com --password ... \
 *     /print/meetings/<id> /print/design/building-permits
 *
 * Exit status is 0 only when every page of every document passes.
 */
import { chromium } from "playwright-core";

/** Fraction of a non-final page that may sit unused — lib/documents/tokens §7.1. */
const UNUSED_AREA_WARN = 0.3;

/**
 * Chrome executable. Playwright's own download is not available in every
 * environment this runs in, so the system browser is the default and the
 * override is an environment variable rather than a flag nobody remembers.
 */
const CHROME =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg("base", "http://localhost:3100");
const EMAIL = arg("email", process.env.VERIFY_EMAIL);
const PASSWORD = arg("password", process.env.VERIFY_PASSWORD);
const routes = process.argv.slice(2).filter((a) => a.startsWith("/"));

if (!routes.length) {
  console.error("Give at least one /print/... route to check.");
  process.exit(2);
}

/**
 * Measures one rendered document. Returns a finding per page.
 *
 * Runs inside the page: every number here has to come from live layout, which is
 * the whole point of the script.
 */
const MEASURE = () => {
  // The preview root is the parent of the end-of-document label. Anchoring on the
  // first chrome node instead finds a spacer row and reports its table.
  const host =
    Array.from(document.querySelectorAll('[data-paged-preview-chrome="true"]')).find((el) =>
      el.textContent.includes("end of document"),
    )?.parentElement ?? null;
  if (!host) return { error: "no paged preview on this route" };

  const pageHeightMm = Number(host.dataset.pagedPageHeightMm);
  const hostRect = host.getBoundingClientRect();
  const hostTop = hostRect.top + window.scrollY;

  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:100mm;";
  host.appendChild(probe);
  const pxPerMm = probe.getBoundingClientRect().height / 100;
  probe.remove();

  /**
   * Every LINE the document paints, and every image. Chrome is excluded by
   * ancestry.
   *
   * Lines, not elements: a paragraph may legitimately span a page boundary — the
   * printer splits it between lines and so does the preview — and its element box
   * then encloses the footer band while not one line of it is drawn there. An
   * earlier version of this script measured element boxes and reported that
   * paragraph as content under the footer, which is the opposite of the truth. A
   * Range's client rects are one per line box, which is exactly the granularity
   * the question is asked at.
   */
  const leaves = [];
  let characters = 0;
  const range = document.createRange();
  const collect = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const text = child.textContent.trim().replace(/\s+/g, " ");
        if (!text) continue;
        // Whitespace is excluded on purpose. Splitting a paragraph at a word
        // boundary consumes the space it split on, so a count that included
        // spaces would report one lost character per page break and turn the
        // one assertion about losing text into noise.
        characters += text.replace(/\s+/g, "").length;
        range.selectNodeContents(child);
        for (const r of Array.from(range.getClientRects())) {
          if (r.height <= 0 || r.width <= 0) continue;
          leaves.push({
            text: text.slice(0, 70),
            top: r.top + window.scrollY - hostTop,
            bottom: r.bottom + window.scrollY - hostTop,
          });
        }
        continue;
      }
      if (child.nodeType !== 1) continue;
      if (child.dataset?.pagedPreviewChrome === "true") continue;
      if (getComputedStyle(child).display === "none") continue;
      if (child.tagName === "IMG" || child.tagName === "SVG") {
        const r = child.getBoundingClientRect();
        if (r.height > 0) {
          leaves.push({
            text: `<${child.tagName.toLowerCase()}>`,
            top: r.top + window.scrollY - hostTop,
            bottom: r.bottom + window.scrollY - hostTop,
          });
        }
        continue;
      }
      collect(child);
    }
  };
  collect(host);

  // The boundary markers, in document order. Each one is a page ending: its
  // footer band sits at the foot of the page above it, and the page below resumes
  // after the whole gutter.
  const bands = Array.from(host.children)
    .filter(
      (el) =>
        el.dataset.pagedPreviewChrome === "true" && getComputedStyle(el).position === "absolute",
    )
    .map((el) => {
      const r = el.getBoundingClientRect();
      const rule = el.querySelector("div > div");
      return {
        gutterTop: r.top + window.scrollY - hostTop,
        gutterBottom: r.top + window.scrollY - hostTop + r.height,
        footerRuleTop: rule.getBoundingClientRect().top + window.scrollY - hostTop,
      };
    });

  const pages = [];
  let pageTop = 0;
  for (const band of bands) {
    const onPage = leaves.filter((l) => l.bottom > pageTop + 1 && l.top < band.gutterBottom - 1);
    const deepest = onPage.reduce((m, l) => (l.bottom > m.bottom ? l : m), {
      bottom: pageTop,
      text: "(nothing)",
    });
    const under = leaves
      .filter((l) => l.bottom > band.footerRuleTop + 1 && l.top < band.gutterBottom - 1)
      .map((l) => `${l.text} (${Math.round(l.top)}-${Math.round(l.bottom)})`);
    pages.push({
      pageTop: Math.round(pageTop),
      footerRuleTop: Math.round(band.footerRuleTop),
      deepest: Math.round(deepest.bottom),
      deepestText: deepest.text,
      contentCount: onPage.length,
      under,
    });
    pageTop = band.gutterBottom;
  }

  // The last page has no boundary below it, so it is measured against the
  // document's end and is exempt from the mostly-empty rule: a document simply
  // stops where it stops.
  const tail = leaves.filter((l) => l.bottom > pageTop + 1);
  pages.push({
    pageTop: Math.round(pageTop),
    footerRuleTop: null,
    deepest: Math.round(tail.reduce((m, l) => Math.max(m, l.bottom), pageTop)),
    deepestText: "(final page)",
    contentCount: tail.length,
    under: [],
  });

  // Text loss. The pass opens gaps and moves nothing, so undoing everything it
  // did must leave the same characters behind. A spacer inside a paragraph was
  // split out of a text node, so the halves are rejoined before counting —
  // otherwise this would compare a split paragraph with itself and prove nothing.
  for (const el of Array.from(host.querySelectorAll("[data-paged-spacer]"))) {
    const parent = el.parentNode;
    el.remove();
    parent?.normalize();
  }
  for (const el of Array.from(host.querySelectorAll("[data-paged-break]"))) {
    el.removeAttribute("data-paged-break");
    el.style.removeProperty("--paged-gutter");
  }
  let bare = 0;
  const count = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        bare += child.textContent.replace(/\s+/g, "").length;
        continue;
      }
      if (child.nodeType !== 1) continue;
      if (child.dataset?.pagedPreviewChrome === "true") continue;
      if (getComputedStyle(child).display === "none") continue;
      count(child);
    }
  };
  count(host);

  return {
    pxPerMm: Number(pxPerMm.toFixed(3)),
    pages,
    /** What one page can actually hold, per the document's own page tokens. */
    pageHeightPx: Math.round(pageHeightMm * pxPerMm),
    pageHeightMm,
    /** One line of body text: the tolerance for a boundary pulled back to a line. */
    lineHeightPx: Math.round(
      parseFloat(getComputedStyle(host).lineHeight) ||
        parseFloat(getComputedStyle(host).fontSize) * 1.5,
    ),
    characters,
    charactersWithoutPass: bare,
  };
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1300 } });
const page = await context.newPage();

if (EMAIL && PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 40000 });
}

let failures = 0;
const say = (ok, line) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${line}`);
  if (!ok) failures++;
};

for (const route of routes) {
  console.log(`\n── ${route}`);
  await page.goto(`${BASE}${route}`);
  await page.locator(".aec-doc").waitFor({ timeout: 40000 });
  // Fonts change every height and land after first paint, so a measurement taken
  // before they settle describes a document nobody will ever see.
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(1200);

  const r = await page.evaluate(MEASURE);
  if (r.error) {
    say(false, `${route}: ${r.error}`);
    continue;
  }

  if (!Number.isFinite(r.pageHeightMm) || r.pageHeightMm <= 0) {
    say(false, `${route}: the document publishes no printable height to measure against`);
    continue;
  }

  console.log(
    `      ${r.pages.length} page(s), ${r.pxPerMm} px/mm, page holds ${r.pageHeightMm}mm = ${r.pageHeightPx}px, ${r.characters} characters`,
  );
  for (const [i, p] of r.pages.entries()) {
    const last = i === r.pages.length - 1;
    // Against the real page, so a preview that put the boundary in the wrong
    // place cannot mark its own homework.
    const used = p.deepest - p.pageTop;
    const fill = used / r.pageHeightPx;
    const span = p.footerRuleTop === null ? used : p.footerRuleTop - p.pageTop;
    console.log(
      `      page ${i + 1}: content ${p.pageTop}-${p.deepest}px (${Math.round(fill * 100)}% of a page)` +
        (p.footerRuleTop === null ? ", final" : `, footer rule ${p.footerRuleTop}px`) +
        ` — deepest: ${p.deepestText}`,
    );
    say(p.under.length === 0, `page ${i + 1}: nothing under the footer${p.under.length ? ` — ${p.under.join("; ")}` : ""}`);
    say(p.contentCount > 0, `page ${i + 1}: not blank (${p.contentCount} text elements)`);
    if (!last) {
      say(
        fill >= 1 - UNUSED_AREA_WARN,
        `page ${i + 1}: not mostly empty (${Math.round(fill * 100)}% of a page, floor ${Math.round((1 - UNUSED_AREA_WARN) * 100)}%)`,
      );
      // A boundary may be pulled back to the top of a line or a table row, never
      // pushed past the end of the paper. One line of tolerance covers the
      // rounding in that pull-back; anything more is a page that does not exist.
      say(
        span <= r.pageHeightPx + r.lineHeightPx,
        `page ${i + 1}: not over-long (${Math.round(span)}px against a ${r.pageHeightPx}px page)`,
      );
    }
  }
  say(
    r.characters === r.charactersWithoutPass,
    `no text lost (${r.characters} characters with the pass, ${r.charactersWithoutPass} without)`,
  );
}

await browser.close();
console.log(`\n${failures === 0 ? "OK" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
