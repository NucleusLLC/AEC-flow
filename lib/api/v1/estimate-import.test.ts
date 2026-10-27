/**
 * POST /api/v1/estimates/import: the zod gate and the mapping from a take-off
 * to estimate sections and lines. Pure — no Prisma, no request.
 */
import { describe, expect, it } from "vitest";
import {
  IMPORT_LIMITS,
  estimateUrl,
  itemTask,
  parseImportPayload,
  planEstimateImport,
  type ImportPayload,
  type ImportProject,
} from "./estimate-import";

const BODY = {
  source: "M.E.P.flow",
  sourceVersion: "1.0.0-beta.18",
  projectId: null,
  title: "M.E.P.flow take-off — Drawing1.dwg",
  currency: "USD",
  categories: [
    {
      name: "Drain · PVC",
      items: [
        { task: "Pipe", size: "DN100", qty: 12.5, unit: "m", note: "" },
        { task: "Elbow 90°", size: "DN100", qty: 4, unit: "no", note: "long radius" },
      ],
    },
    { name: "Supply · PPR", items: [{ task: "Pipe", size: "", qty: 0, unit: "", note: "" }] },
  ],
};

const PROJECT: ImportProject = {
  id: "prj_1",
  projectNumber: "ZA-2026-014",
  name: "Villa Verde",
  siteAddress: "Noord 12",
  clientId: "cli_1",
  clientName: "Ms Vega",
};

function parsed(body: unknown = BODY): ImportPayload {
  const r = parseImportPayload(body);
  if (!r.ok) throw new Error(r.message);
  return r.payload;
}

function bad(body: unknown): string {
  const r = parseImportPayload(body);
  expect(r.ok).toBe(false);
  return r.ok ? "" : r.message;
}

describe("parseImportPayload", () => {
  it("accepts the documented example", () => {
    const p = parsed();
    expect(p.categories).toHaveLength(2);
    expect(p.projectId).toBeNull();
  });

  it("defaults the currency to USD and upper-cases one given", () => {
    const noCurrency: Record<string, unknown> = { ...BODY };
    delete noCurrency.currency;
    expect(parsed(noCurrency).currency).toBe("USD");
    expect(parsed({ ...BODY, currency: null }).currency).toBe("USD");
    expect(parsed({ ...BODY, currency: "awg" }).currency).toBe("AWG");
    expect(bad({ ...BODY, currency: "dollars" })).toMatch(/currency/);
  });

  it("treats an absent, null or blank projectId as no project", () => {
    const noProject: Record<string, unknown> = { ...BODY };
    delete noProject.projectId;
    expect(parsed(noProject).projectId).toBeNull();
    expect(parsed({ ...BODY, projectId: "  " }).projectId).toBeNull();
    expect(parsed({ ...BODY, projectId: " prj_1 " }).projectId).toBe("prj_1");
  });

  it("lets size, unit and note be left out", () => {
    const p = parsed({ ...BODY, categories: [{ name: "A", items: [{ task: "Pipe", qty: 1 }] }] });
    expect(p.categories[0].items[0]).toEqual({ task: "Pipe", size: "", qty: 1, unit: "", note: "" });
  });

  it.each([
    ["a missing title", { ...BODY, title: undefined }, /title/],
    ["a blank source", { ...BODY, source: "  " }, /source/],
    ["categories that are not a list", { ...BODY, categories: {} }, /categories/],
    ["a blank category name", { ...BODY, categories: [{ name: "", items: [] }] }, /name/],
    ["a negative qty", { ...BODY, categories: [{ name: "A", items: [{ task: "x", qty: -1 }] }] }, /negative/],
    ["a non-finite qty", { ...BODY, categories: [{ name: "A", items: [{ task: "x", qty: Infinity }] }] }, /qty/],
    ["NaN", { ...BODY, categories: [{ name: "A", items: [{ task: "x", qty: NaN }] }] }, /qty/],
    ["a qty sent as text", { ...BODY, categories: [{ name: "A", items: [{ task: "x", qty: "3" }] }] }, /qty/],
    ["a missing task", { ...BODY, categories: [{ name: "A", items: [{ qty: 1 }] }] }, /task/],
    ["a body that is not an object", "hello", /.+/],
    ["null", null, /.+/],
  ])("refuses %s", (_l, body, msg) => {
    expect(bad(body)).toMatch(msg);
  });

  it("caps every string at 300 characters", () => {
    const long = "x".repeat(IMPORT_LIMITS.maxString + 1);
    const ok = "x".repeat(IMPORT_LIMITS.maxString);
    expect(parseImportPayload({ ...BODY, title: ok }).ok).toBe(true);
    expect(bad({ ...BODY, title: long })).toMatch(/300/);
    expect(bad({ ...BODY, categories: [{ name: "A", items: [{ task: "x", qty: 1, note: long }] }] })).toMatch(/300/);
    expect(bad({ ...BODY, categories: [{ name: long, items: [] }] })).toMatch(/300/);
  });

  it("allows 200 categories and refuses 201", () => {
    const cats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `C${i}`, items: [] }));
    expect(parseImportPayload({ ...BODY, categories: cats(200) }).ok).toBe(true);
    expect(bad({ ...BODY, categories: cats(201) })).toMatch(/200/);
  });

  it("allows 5000 items in all and refuses 5001, however they are split", () => {
    const items = (n: number) => Array.from({ length: n }, () => ({ task: "Pipe", qty: 1 }));
    const split = (n: number) => [
      { name: "A", items: items(n - 1000) },
      { name: "B", items: items(1000) },
    ];
    expect(parseImportPayload({ ...BODY, categories: split(5000) }).ok).toBe(true);
    expect(bad({ ...BODY, categories: split(5001) })).toMatch(/5000/);
  });
});

describe("itemTask", () => {
  it("is '<task> <size>' trimmed, with the note after a dash", () => {
    expect(itemTask({ task: "Pipe", size: "DN100", note: "" })).toBe("Pipe DN100");
    expect(itemTask({ task: "Pipe", size: "", note: "" })).toBe("Pipe");
    expect(itemTask({ task: " Pipe ", size: " DN50 ", note: "" })).toBe("Pipe DN50");
    expect(itemTask({ task: "Elbow", size: "DN100", note: "long radius" })).toBe("Elbow DN100 — long radius");
  });
});

describe("planEstimateImport", () => {
  const NOW = new Date("2026-10-27T12:00:00Z");

  it("without a project: a DRAFT titled after the take-off, nothing linked", () => {
    const plan = planEstimateImport(parsed(), null, NOW);
    expect(plan.estimate).toMatchObject({
      projectId: null,
      projectNumber: null,
      projectName: "M.E.P.flow take-off — Drawing1.dwg",
      client: null,
      clientId: null,
      currency: "USD",
      status: "DRAFT",
      locked: false,
      amount: 0,
      date: NOW,
    });
    expect(plan.estimate.budget.import).toEqual({
      source: "M.E.P.flow",
      sourceVersion: "1.0.0-beta.18",
      title: "M.E.P.flow take-off — Drawing1.dwg",
      importedAt: "2026-10-27T12:00:00.000Z",
    });
  });

  it("with a project: number, name, client and address come from the project", () => {
    const plan = planEstimateImport(parsed({ ...BODY, projectId: "prj_1" }), PROJECT, NOW);
    expect(plan.estimate).toMatchObject({
      projectId: "prj_1",
      projectNumber: "ZA-2026-014",
      projectName: "Villa Verde",
      client: "Ms Vega",
      clientId: "cli_1",
      location: "Noord 12",
    });
    // The take-off title is still kept, as provenance.
    expect(plan.estimate.budget.import.title).toBe("M.E.P.flow take-off — Drawing1.dwg");
  });

  it("one section per category and one line per item, in order, quantities only", () => {
    const plan = planEstimateImport(parsed(), null, NOW);
    expect(plan.categories.map((c) => [c.name, c.sortOrder])).toEqual([
      ["Drain · PVC", 0],
      ["Supply · PPR", 1],
    ]);
    expect(plan.categories[0].items).toEqual([
      {
        task: "Pipe DN100",
        qty: 12.5,
        unit: "m",
        code: null,
        laborNorm: 0,
        materialUnitCost: 0,
        equipmentUnitCost: 0,
        subcontractUnitCost: 0,
        poc: 0,
        sortOrder: 0,
      },
      expect.objectContaining({ task: "Elbow 90° DN100 — long radius", qty: 4, unit: "no", sortOrder: 1 }),
    ]);
    // No unit sent → the estimate's own default unit.
    expect(plan.categories[1].items[0]).toMatchObject({ task: "Pipe", qty: 0, unit: "no", sortOrder: 0 });
  });

  it("a blank sourceVersion is stored as null", () => {
    const plan = planEstimateImport(parsed({ ...BODY, sourceVersion: "" }), null, NOW);
    expect(plan.estimate.budget.import.sourceVersion).toBeNull();
  });
});

describe("estimateUrl", () => {
  it("opens the estimate in the Estimates workspace", () => {
    expect(estimateUrl("https://aec-flow.com/", "est 1")).toBe("https://aec-flow.com/estimates?project=est%201");
  });
});
