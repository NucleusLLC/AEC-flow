/**
 * The fences around the unscoped Prisma client.
 *
 * lib/samples/unscoped-db.ts is a client WITHOUT the tenant extension. It
 * exists because the sample set is written where the session's company is the
 * wrong one (signup: none yet; the founder push: the founder's). These tests
 * read the source as text and fail the build if that client leaks out of
 * lib/samples, or if the sample set starts writing a company-owned model the
 * tenant extension does not know about.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_CHILD_MODELS, SAMPLE_MODEL_ORDER } from "./build";

const ROOT = resolve(__dirname, "../..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(tsx?|mts)$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => p.slice(ROOT.length + 1).replace(/\\/g, "/");

describe("the unscoped client stays inside lib/samples", () => {
  it("nothing outside lib/samples imports it", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const path = rel(file);
        if (path.startsWith("lib/samples/")) continue;
        const src = readFileSync(file, "utf8");
        if (/samples\/unscoped-db|unscopedPrisma/.test(src)) offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("inside lib/samples only the installer and the founder list use it", () => {
    const users = sourceFiles(join(ROOT, "lib/samples"))
      .filter((f) => !/\.test\.ts$/.test(f) && !f.endsWith("unscoped-db.ts"))
      .filter((f) => /unscopedPrisma\(/.test(readFileSync(f, "utf8")))
      .map(rel)
      .sort();
    expect(users).toEqual(["lib/samples/admin.ts", "lib/samples/install.ts"]);
  });

  it("no client component can pull the builder or the installer into the browser", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, "components"))) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(src)) continue;
      // Type-only imports are erased; a value import from these modules is not.
      for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*from\s+"@\/lib\/samples\/(build|install|admin|unscoped-db)";/gm)) {
        if (!m[1]) offenders.push(`${rel(file)} imports ${m[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the sample set and the tenant extension agree", () => {
  const dbSource = readFileSync(join(ROOT, "lib/db.ts"), "utf8");
  const tenantBlock = dbSource.slice(dbSource.indexOf("const TENANT_MODELS"), dbSource.indexOf("]);", dbSource.indexOf("const TENANT_MODELS")));
  const tenantModels = new Set([...tenantBlock.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]));
  const pascal = (model: string) => model.charAt(0).toUpperCase() + model.slice(1);

  it("every company-owned model the sample writes is one the extension scopes", () => {
    expect(tenantModels.size).toBeGreaterThan(40);
    const unknown = SAMPLE_MODEL_ORDER.filter((m) => !SAMPLE_CHILD_MODELS.has(m) && !tenantModels.has(pascal(m)));
    expect(unknown).toEqual([]);
  });

  it("the models treated as children are exactly the ones with no companyId column", () => {
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    const hasCompanyId = (model: string) => {
      const start = schema.indexOf(`\nmodel ${pascal(model)} {`);
      expect({ model, found: start >= 0 }).toEqual({ model, found: true });
      const body = schema.slice(start, schema.indexOf("\n}", start));
      return /^\s+companyId\s+String/m.test(body);
    };
    for (const model of SAMPLE_MODEL_ORDER) {
      expect({ model, child: SAMPLE_CHILD_MODELS.has(model) }).toEqual({ model, child: !hasCompanyId(model) });
    }
  });

  it("the installer names the company on every delete of a company-owned model", () => {
    const src = readFileSync(join(ROOT, "lib/samples/install.ts"), "utf8");
    // The one generic delete: by id AND companyId unless the model has no such column.
    expect(src).toContain("SAMPLE_CHILD_MODELS.has(model)");
    expect(src).toContain("{ id: { in: list }, companyId }");
    // The activity feed is only ever touched for this company.
    for (const m of src.matchAll(/activityLog\.updateMany\(\{ where: \{([^}]*)/g)) expect(m[1]).toContain("companyId");
  });
});
