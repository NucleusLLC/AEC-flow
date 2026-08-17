import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

/**
 * THE findUnique TRIPWIRE.
 *
 * lib/db.ts scopes every company-owned model (TENANT_MODELS) by the current company.
 * For findMany/findFirst/count/... it injects `companyId` into the WHERE. `findUnique`
 * cannot work that way — a unique WHERE takes no extra field — so the extension instead
 * guards the ROW that comes back:
 *
 *     return (row as { companyId?: string | null }).companyId === cid ? row : null;
 *
 * That check reads `row.companyId`. If the query used a narrow `select` that does not
 * include `companyId`, the field is `undefined`, `undefined !== cid` is always true, and
 * the call returns null (findUniqueOrThrow throws) for EVERY signed-in user. It is not a
 * leak — it is a silent, total failure, and it only appears once a session has a company,
 * so it passes every unscoped local check and script and then fails in production.
 *
 * This has now surfaced twice (lib/data/drawing-intake.ts, then a six-site sweep), so it
 * is asserted rather than swept again. The rule:
 *
 *     findUnique / findUniqueOrThrow on a TENANT_MODELS model must not use a `select`
 *     that omits `companyId`. Use findFirst / findFirstOrThrow with the same (still
 *     unique) WHERE, so the scope becomes a real database filter.
 *
 * Static analysis on purpose: no database, no Prisma client, no session — it runs in the
 * pure-unit suite next to lib/proposals/tenant-scope.test.ts, which guards the companion
 * invariant (that TENANT_MODELS matches the schema).
 */

const root = resolve(__dirname, "..");

/** Directories scanned. `scripts/` is deliberately excluded — see NOT_SCANNED below. */
const SCAN_DIRS = ["lib", "app"];
const SCAN_EXT = [".ts", ".tsx"];

/**
 * `scripts/` is NOT scanned. Those run outside a request, where currentCompanyId()
 * returns `undefined` and the extension does not scope at all, so the row-guard never
 * executes and a narrow `select` is harmless there. scripts/backfill-estimate-clients.ts
 * contains exactly such a call and is correct as written.
 */
const NOT_SCANNED = "scripts";

/**
 * Accepted offenders, if one is ever genuinely unavoidable. Key format is
 * `<posix path>:<prisma delegate>` (no line number — those churn). EVERY entry needs a
 * comment saying why findFirst is wrong for that site and how the tenant scope is
 * enforced instead. Empty is the goal; adding an entry should feel expensive.
 */
const ALLOWED = new Map<string, string>([
  // (empty — every known site is fixed. See the module comment before adding.)
]);

/* ------------------------------------------------------------------ *
 * Reading TENANT_MODELS out of lib/db.ts
 * ------------------------------------------------------------------ */

/** Model names inside the TENANT_MODELS set literal. */
function tenantModels(): Set<string> {
  const db = readFileSync(resolve(root, "lib", "db.ts"), "utf8");
  const block = /const TENANT_MODELS = new Set<string>\(\[([\s\S]*?)\]\)/.exec(db);
  if (!block) throw new Error("Could not locate TENANT_MODELS in lib/db.ts");
  const names = [...block[1].matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
  if (names.length === 0) throw new Error("TENANT_MODELS parsed as empty — the regex is broken");
  return new Set(names);
}

/** Prisma's client property for a model: the model name with a lowercase first letter. */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/* ------------------------------------------------------------------ *
 * Source scanning
 * ------------------------------------------------------------------ */

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
      const full = resolve(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!SCAN_EXT.some((e) => entry.endsWith(e))) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) continue;
      out.push(full);
    }
  };
  walk(resolve(root, dir));
  return out;
}

/** The text of the balanced `(...)` argument list starting at `open` (the index of "("). */
function argText(src: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * The value text of a TOP-LEVEL `select:` key in an object-literal argument, or null when
 * there is none. Depth-aware so a nested `select:` (a relation's own select, as in
 * `project: { select: { name: true } }`) is not mistaken for the query's own.
 */
function topLevelSelect(args: string): string | null {
  const objStart = args.indexOf("{");
  if (objStart === -1) return null;
  let depth = 0;
  for (let i = objStart; i < args.length; i++) {
    const ch = args[i];
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
    else if (depth === 1 && args.startsWith("select", i) && /[\s{,]/.test(args[i - 1] ?? "{")) {
      const colon = args.indexOf(":", i);
      if (colon === -1) return null;
      return valueAfter(args, colon + 1);
    }
  }
  return null;
}

/** The text of the value starting at `from`: an object/array literal, or a bare identifier. */
function valueAfter(src: string, from: number): string {
  let i = from;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] === "{" || src[i] === "[") {
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === "{" || src[j] === "[") depth++;
      else if (src[j] === "}" || src[j] === "]") {
        depth--;
        if (depth === 0) return src.slice(i, j + 1);
      }
    }
    return src.slice(i);
  }
  const ident = /^[A-Za-z_$][\w$.]*/.exec(src.slice(i));
  return ident ? ident[0] : "";
}

/**
 * Does this select text include `companyId`? A select given as an identifier
 * (`select: SELECT`) is resolved against a `const SELECT = {...}` in the same file — that
 * is the exact shape lib/data/drawings.ts used, and the shape a reader is most likely to
 * misjudge. Anything unresolvable counts as "omits companyId": a tripwire that guesses
 * in favour of the code is not a tripwire.
 */
function selectHasCompanyId(selectText: string, fileSrc: string): boolean {
  if (/\bcompanyId\b/.test(selectText)) return true;
  if (/^[A-Za-z_$][\w$]*$/.test(selectText)) {
    const decl = new RegExp(`const\\s+${selectText}\\s*(?::[^=]*)?=\\s*`).exec(fileSrc);
    if (decl) {
      const body = valueAfter(fileSrc, decl.index + decl[0].length - 1);
      return /\bcompanyId\b/.test(body);
    }
  }
  return false;
}

type Offence = { file: string; line: number; delegate: string; model: string; select: string };

/** Every tenant-model findUnique/findUniqueOrThrow whose top-level select omits companyId. */
function scan(): Offence[] {
  const models = tenantModels();
  const byDelegate = new Map<string, string>();
  for (const m of models) byDelegate.set(delegateName(m), m);

  const offences: Offence[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of sourceFiles(dir)) {
      const src = readFileSync(file, "utf8");
      // Any receiver: `prisma.`, `tx.`, `db.`, a destructured client — the extension
      // applies inside $transaction too (proven against the live database), so a
      // `tx.` call is exactly as exposed as a `prisma.` one.
      const re = /\.(\w+)\.(findUnique(?:OrThrow)?)\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const model = byDelegate.get(m[1]);
        if (!model) continue; // not a tenant model — the extension's guard never runs
        const open = src.indexOf("(", m.index + m[0].length - 1);
        const args = argText(src, open);
        if (args === null) continue;
        const select = topLevelSelect(args);
        if (select === null) continue; // no select → all scalars → companyId present
        if (selectHasCompanyId(select, src)) continue;
        offences.push({
          file: relative(root, file).split(sep).join("/"),
          line: src.slice(0, m.index).split("\n").length,
          delegate: m[1],
          model,
          select: select.replace(/\s+/g, " ").slice(0, 90),
        });
      }
    }
  }
  return offences;
}

/* ------------------------------------------------------------------ *
 * The assertions
 * ------------------------------------------------------------------ */

describe("findUnique tenant-scope guard", () => {
  it("finds no tenant-model findUnique whose select omits companyId", () => {
    const offences = scan().filter((o) => !ALLOWED.has(`${o.file}:${o.delegate}`));
    const report = offences
      .map(
        (o) =>
          `\n  ${o.file}:${o.line} — ${o.model}.findUnique with select { ${o.select} }` +
          `\n      returns null for every signed-in user. Use findFirst with the same where,` +
          `\n      or add companyId: true to the select.`,
      )
      .join("");
    expect(offences.map((o) => `${o.file}:${o.line}`), `\n${offences.length} broken call site(s):${report}\n`).toEqual([]);
  });

  it("keeps every allow-list entry pointing at a call that still exists", () => {
    // A stale exception is worse than none: it silently blesses whatever moves into that
    // file next. If an entry no longer matches a real offence, delete it.
    const keys = new Set(scan().map((o) => `${o.file}:${o.delegate}`));
    const stale = [...ALLOWED.keys()].filter((k) => !keys.has(k));
    expect(stale, `stale allow-list entries — delete them: ${stale.join(", ")}`).toEqual([]);
  });

  it("does not scan scripts/, which run unscoped by design", () => {
    // Guards the reasoning, not just the outcome: if someone widens SCAN_DIRS to include
    // scripts/, this fails and they read the NOT_SCANNED note before arguing with it.
    expect(SCAN_DIRS).not.toContain(NOT_SCANNED);
  });
});

/**
 * The scanner is the load-bearing part, and a regex that silently stops matching would
 * make this whole file a green light forever. So it is tested against source it must
 * catch and source it must not.
 */
describe("the scanner itself", () => {
  const models = tenantModels();

  it("knows the models it is guarding", () => {
    // Spot-check the delegate mapping against models that actually appear in the
    // call sites this test exists to police.
    expect(models.has("Drawing")).toBe(true);
    expect(models.has("CostEstimate")).toBe(true);
    expect(models.has("ProjectSchedule")).toBe(true);
    expect(delegateName("CostEstimate")).toBe("costEstimate");
    expect(delegateName("RfiLog")).toBe("rfiLog");
    // Not tenant models: the guard never runs, so these must never be reported.
    expect(models.has("User")).toBe(false);
    expect(models.has("Company")).toBe(false);
  });

  it("reads a top-level select and ignores a nested one", () => {
    expect(topLevelSelect("{ where: { id }, select: { locked: true } }")).toBe("{ locked: true }");
    expect(topLevelSelect("{ where: { id }, select: SELECT }")).toBe("SELECT");
    // A relation's own select must not be read as the query's.
    expect(topLevelSelect("{ where: { id }, include: { project: { select: { name: true } } } }")).toBeNull();
    expect(topLevelSelect("{ where: { id } }")).toBeNull();
  });

  it("resolves a select named by a const in the same file", () => {
    const withoutCid = "const SELECT = { id: true, title: true } as const;";
    const withCid = "const SELECT = { id: true, companyId: true } as const;";
    expect(selectHasCompanyId("SELECT", withoutCid)).toBe(false);
    expect(selectHasCompanyId("SELECT", withCid)).toBe(true);
    // An unresolvable identifier is treated as omitting companyId, on purpose.
    expect(selectHasCompanyId("SOMEWHERE_ELSE", withoutCid)).toBe(false);
    expect(selectHasCompanyId("{ locked: true, companyId: true }", "")).toBe(true);
  });

  it("still reports the exact defect it was written for", () => {
    // The real pre-fix line from lib/data/drawings.ts. If the scanner ever stops
    // flagging this, it has stopped working — regardless of how green the sweep looks.
    const src = [
      "const SELECT = { id: true, sheetNumber: true, project: { select: { name: true } } } as const;",
      "const row = await prisma.drawing.findUnique({ where: { id }, select: SELECT });",
    ].join("\n");
    const re = /\.(\w+)\.(findUnique(?:OrThrow)?)\s*\(/g;
    const m = re.exec(src)!;
    const args = argText(src, src.indexOf("(", m.index + m[0].length - 1))!;
    const select = topLevelSelect(args)!;
    expect(select).toBe("SELECT");
    expect(selectHasCompanyId(select, src)).toBe(false);
    // …and the fixed form, which uses findFirst, is not matched at all.
    expect(/\.(\w+)\.(findUnique(?:OrThrow)?)\s*\(/.test(src.replace("findUnique", "findFirst"))).toBe(false);
  });

  it("scans a plausible number of files (a broken walker would find none)", () => {
    const count = SCAN_DIRS.reduce((n, d) => n + sourceFiles(d).length, 0);
    expect(count).toBeGreaterThan(50);
  });
});
