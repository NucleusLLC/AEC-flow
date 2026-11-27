import { describe, expect, it } from "vitest";
import {
  buildPreview,
  cleanDataUrl,
  lineTask,
  matchPrice,
  parseBoqCore,
  parseBoqFile,
  planBoqEstimate,
  planBoqPurchaseOrder,
  priceIndex,
  type BoqPrice,
} from "./cadgen-boq";
import { PO_IMPORT_VENDOR } from "@/lib/api/v1/po-import";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

/** The shape pool/src/boq.js boqAec() writes (trimmed). */
function poolFile(over: Record<string, unknown> = {}) {
  return {
    schema: "cadgen.boq/1",
    source: "CAD-generators · Pool & Jacuzzi",
    purpose: "estimate",
    generated: "2026-11-25T22:00:00.000Z",
    project: { number: "2026A-031", name: "Villa Palm Pool", owner: "J. Croes", address: "Palm Beach 12, Aruba", drawing: "P-101" },
    cover: {
      use: ["project-cover", "estimate-cover"],
      rendering: { title: "Artist impression", mime: "image/jpeg", dataUrl: "data:image/jpeg;base64,/9j/4AAQ", caption: "Indicative" },
      floorPlan: { title: "Pool floor plan", mime: "image/svg+xml", svg: "<svg/>", dataUrl: "data:image/svg+xml;base64,PHN2Zy8+", caption: "Plan" },
    },
    currency: "",
    lines: [
      { line: 1, code: "EW-01", category: "Earthworks", description: "Excavation incl. working space", specification: "machine dig", quantity: 61.2, unit: "m³", unitRate: null, amount: null },
      { line: 2, code: "CO-01", category: "Concrete", description: "Shell walls", specification: "C30 shotcrete, 200 mm", quantity: 9.4, unit: "m³", unitRate: 999, amount: null },
      { line: 3, code: "RB-12", category: "Reinforcement", description: "Rebar Ø12 B500 / Gr 60", specification: "", quantity: 812, unit: "kg", unitRate: null, amount: null },
      { line: 4, code: "EQ-PUMP", category: "Equipment", description: "Variable-speed pump", specification: "1.5 kW", quantity: 1, unit: "no.", unitRate: null, amount: null },
      { line: 5, code: "CO-02", category: "Concrete", description: "Shell floor", specification: "C30, 200 mm", quantity: 7.1, unit: "m³", unitRate: null, amount: null },
    ],
    ...over,
  };
}

const BOOK: BoqPrice[] = [
  { code: "co-01", name: "Shotcrete C30", unit: "m³", unitPrice: 420, currency: "AWG", kind: "material" },
  { code: "EQ-PUMP", name: "VS pump", unit: "no", unitPrice: 2150, currency: "AWG", kind: "equipment" },
  { code: "RB 12", name: "Rebar 12", unit: "kg", unitPrice: 2.4, currency: "USD", kind: "material" },
];

const PROJECT = { id: "p1", projectNumber: "2026A-031", name: "Villa Palm Pool", siteAddress: null, clientId: "c1", clientName: "J. Croes" };

describe("parseBoqFile", () => {
  it("reads the pool generator file with its two cover images", () => {
    const r = parseBoqFile(JSON.stringify(poolFile()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.lines).toHaveLength(5);
    expect(r.file.purpose).toBe("estimate");
    expect(r.file.project.number).toBe("2026A-031");
    expect(r.file.rendering?.mime).toBe("image/jpeg");
    expect(r.file.floorPlan?.mime).toBe("image/svg+xml");
  });

  it("refuses another schema, bad JSON, an empty file and a negative quantity", () => {
    expect(parseBoqFile("{nope").ok).toBe(false);
    const other = parseBoqFile(JSON.stringify(poolFile({ schema: "something/2" })));
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.message).toMatch(/cadgen\.boq\/1/);
    expect(parseBoqFile(JSON.stringify(poolFile({ lines: [] }))).ok).toBe(false);
    const neg = poolFile();
    (neg.lines as { quantity: number }[])[0].quantity = -1;
    expect(parseBoqFile(JSON.stringify(neg)).ok).toBe(false);
  });

  it("reads purchase-order purpose and drops a non-image data URL", () => {
    const r = parseBoqFile(JSON.stringify(poolFile({ purpose: "purchase-order", cover: { rendering: { dataUrl: "data:text/html;base64,PHNjcmlwdD4=" } } })));
    expect(r.ok && r.file.purpose).toBe("purchase-order");
    expect(r.ok && r.file.rendering).toBeNull();
  });

  it("the server re-check accepts the core without images", () => {
    const { cover: _c, ...core } = poolFile();
    void _c;
    expect(parseBoqCore(core).ok).toBe(true);
    expect(parseBoqCore({ ...core, lines: "x" }).ok).toBe(false);
  });
});

describe("price matching", () => {
  const ix = priceIndex(BOOK);
  it("matches on code ignoring case and spaces, only in the estimate currency", () => {
    expect(matchPrice("CO-01", ix, "AWG")).toMatchObject({ status: "priced", kind: "material", unitPrice: 420 });
    expect(matchPrice("EQ-PUMP", ix, "awg")).toMatchObject({ status: "priced", kind: "equipment" });
    expect(matchPrice("RB-12", ix, "AWG").status).toBe("unpriced"); // "RB 12" ≠ "RB-12"
    expect(matchPrice("RB12", ix, "AWG")).toMatchObject({ status: "other-currency", currency: "USD" });
    expect(matchPrice("", ix, "AWG").status).toBe("unpriced");
    expect(matchPrice("EW-01", ix, "AWG").status).toBe("unpriced");
  });
});

describe("preview + plans", () => {
  const r = parseBoqFile(JSON.stringify(poolFile()));
  if (!r.ok) throw new Error("fixture");
  const preview = buildPreview(r.file, BOOK, "AWG");

  it("one section per category, in first-seen order, lines kept in file order", () => {
    expect(preview.sections.map((s) => s.name)).toEqual(["Earthworks", "Concrete", "Reinforcement", "Equipment"]);
    expect(preview.sections[1].lines.map((l) => l.code)).toEqual(["CO-01", "CO-02"]);
    expect(preview).toMatchObject({ lineCount: 5, priced: 2, unpriced: 3, otherCurrency: 0 });
    expect(preview.total).toBe(Math.round((9.4 * 420 + 2150) * 100) / 100);
  });

  it("never uses a unitRate written in the file", () => {
    const concrete = preview.sections[1].lines[0];
    expect(concrete.match).toMatchObject({ unitPrice: 420 });
    const plan = planBoqEstimate(r.file, buildPreview(r.file, [], "AWG"), PROJECT, "AWG", { image: null, plan: null });
    expect(plan.categories.flatMap((c) => c.items).every((i) => i.materialUnitCost === 0 && i.equipmentUnitCost === 0)).toBe(true);
  });

  it("estimate: codes kept, material vs equipment cost column, cover on with both images", () => {
    const plan = planBoqEstimate(r.file, preview, PROJECT, "AWG", { image: "IMG", plan: "PLAN" }, new Date("2026-11-25T00:00:00Z"));
    expect(plan.estimate).toMatchObject({ projectId: "p1", currency: "AWG", status: "DRAFT", clientId: "c1", location: "Palm Beach 12, Aruba" });
    expect(plan.estimate.budget.cover).toEqual({ on: true, image: "IMG", plan: "PLAN" });
    expect(plan.estimate.budget.import.title).toBe("Villa Palm Pool");
    const items = plan.categories.flatMap((c) => c.items);
    const byCode = Object.fromEntries(items.map((i) => [i.code, i]));
    expect(byCode["CO-01"]).toMatchObject({ materialUnitCost: 420, equipmentUnitCost: 0, qty: 9.4, unit: "m³" });
    expect(byCode["EQ-PUMP"]).toMatchObject({ materialUnitCost: 0, equipmentUnitCost: 2150 });
    expect(byCode["EW-01"].task).toBe("Excavation incl. working space — machine dig");
    expect(plan.categories[1].items.map((i) => i.sortOrder)).toEqual([0, 1]);
  });

  it("estimate without images has no cover key", () => {
    const plan = planBoqEstimate(r.file, preview, PROJECT, "AWG", { image: null, plan: null });
    expect(plan.estimate.budget.cover).toBeUndefined();
  });

  it("purchase order: one line per BOQ line, priced lines carry a unit price, totals summed", () => {
    const po = planBoqPurchaseOrder(r.file, preview, null, "AWG", "Greg");
    expect(po.vendorName).toBe(PO_IMPORT_VENDOR);
    expect(po.projectId).toBeNull();
    expect(po.projectName).toBe("Villa Palm Pool");
    expect(po.lineItems).toHaveLength(5);
    expect(po.lineItems.find((l) => l.description.startsWith("EQ-PUMP"))?.unitPrice).toBe(2150);
    expect(po.subtotal).toBe(preview.total);
    expect(po.total).toBe(po.subtotal);
    expect(po.createdByName).toBe("Greg");
  });
});

describe("helpers", () => {
  it("lineTask falls back to the code", () => {
    expect(lineTask({ description: "", specification: "", code: "X-1" })).toBe("X-1");
  });
  it("cleanDataUrl keeps allowed types under the size and drops the rest", () => {
    expect(cleanDataUrl(PNG, ["image/png"], 1000)).toBe(PNG);
    expect(cleanDataUrl(PNG, ["image/jpeg"], 1000)).toBeNull();
    expect(cleanDataUrl(PNG, ["image/png"], 2)).toBeNull();
    expect(cleanDataUrl("javascript:alert(1)", ["image/png"], 1000)).toBeNull();
    expect(cleanDataUrl(42, ["image/png"], 1000)).toBeNull();
  });
});
