/**
 * POST /api/v1/purchase-orders/import: the mapping from a take-off (the
 * estimates-import body, same zod gate) to one draft purchase-order row. Pure —
 * no Prisma, no request.
 */
import { describe, expect, it } from "vitest";
import { parseImportPayload, type ImportPayload, type ImportProject } from "./estimate-import";
import {
  PO_IMPORT_VENDOR,
  planPoImport,
  poImportNotes,
  poLineDescription,
  purchaseOrderUrl,
} from "./po-import";
import { nextPoNumber } from "@/lib/procurement/calc";

const BODY = {
  source: "M.E.P.flow",
  sourceVersion: "1.0.0-beta.18",
  projectId: null,
  title: "M.E.P.flow take-off — Drawing1.dwg",
  currency: "awg",
  categories: [
    {
      name: "Drain · PVC",
      items: [
        { task: "Pipe", size: "DN100", qty: 12.5, unit: "m", note: "" },
        { task: "Elbow 90°", size: "DN100", qty: 4, unit: "no", note: "long radius" },
      ],
    },
    { name: "Supply · PPR", items: [{ task: "Pipe", qty: 0 }] },
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

describe("poLineDescription", () => {
  it("is '<category> — <task> <size>'", () => {
    expect(poLineDescription("Drain · PVC", { task: "Pipe", size: "DN100", note: "" })).toBe("Drain · PVC — Pipe DN100");
  });

  it("adds ' (<note>)' only when there is a note", () => {
    expect(poLineDescription("Drain", { task: "Elbow", size: "DN100", note: "long radius" })).toBe(
      "Drain — Elbow DN100 (long radius)",
    );
    expect(poLineDescription("Drain", { task: "Elbow", size: "", note: "  " })).toBe("Drain — Elbow");
  });

  it("collapses whitespace and leaves no dangling space when size is empty", () => {
    expect(poLineDescription("Drain", { task: "Pipe", size: "", note: "" })).toBe("Drain — Pipe");
    expect(poLineDescription("Drain", { task: "Pipe  long", size: "  DN50 ", note: "a\n b" })).toBe(
      "Drain — Pipe long DN50 (a b)",
    );
  });
});

describe("poImportNotes", () => {
  it("records source, version and title", () => {
    expect(poImportNotes(parsed())).toBe("Imported from M.E.P.flow 1.0.0-beta.18: M.E.P.flow take-off — Drawing1.dwg");
  });

  it("leaves the version out when absent", () => {
    const noVersion: Record<string, unknown> = { ...BODY };
    delete noVersion.sourceVersion;
    expect(poImportNotes(parsed(noVersion))).toBe("Imported from M.E.P.flow: M.E.P.flow take-off — Drawing1.dwg");
  });
});

describe("planPoImport", () => {
  it("makes one line per item, in payload order, across categories", () => {
    const plan = planPoImport(parsed(), null);
    expect(plan.lineItems.map((l) => l.description)).toEqual([
      "Drain · PVC — Pipe DN100",
      "Drain · PVC — Elbow 90° DN100 (long radius)",
      "Supply · PPR — Pipe",
    ]);
    expect(plan.lineItems.map((l) => l.quantity)).toEqual([12.5, 4, 0]);
    expect(plan.lineItems.map((l) => l.unit)).toEqual(["m", "no", ""]);
  });

  it("never invents a price: every unit price and every total is 0", () => {
    const plan = planPoImport(parsed(), PROJECT);
    expect(plan.lineItems.every((l) => l.unitPrice === 0)).toBe(true);
    expect(plan.subtotal).toBe(0);
    expect(plan.taxPercentage).toBe(0);
    expect(plan.shipping).toBe(0);
    expect(plan.total).toBe(0);
  });

  it("writes the lines in the shape the Procurement pages read, and nothing else", () => {
    const plan = planPoImport(parsed(), null);
    for (const l of plan.lineItems) {
      expect(Object.keys(l).sort()).toEqual(["description", "quantity", "unit", "unitPrice"]);
    }
  });

  it("is a DRAFT with the vendor to be assigned and the payload's currency", () => {
    const plan = planPoImport(parsed(), null);
    expect(plan.status).toBe("DRAFT");
    expect(plan.vendorName).toBe(PO_IMPORT_VENDOR);
    expect(plan.vendorName).toBe("To be assigned");
    expect(plan.currency).toBe("AWG");
  });

  it("with a project: its id and its own name", () => {
    const plan = planPoImport(parsed({ ...BODY, projectId: "prj_1" }), PROJECT);
    expect(plan.projectId).toBe("prj_1");
    expect(plan.projectName).toBe("Villa Verde");
  });

  it("without a project: no id, and the title as the project name", () => {
    const plan = planPoImport(parsed(), null);
    expect(plan.projectId).toBeNull();
    expect(plan.projectName).toBe("M.E.P.flow take-off — Drawing1.dwg");
  });

  it("carries the provenance in notes and the token's name as the creator", () => {
    const plan = planPoImport(parsed(), null, " W&Dflow on the drafting PC ");
    expect(plan.notes).toBe("Imported from M.E.P.flow 1.0.0-beta.18: M.E.P.flow take-off — Drawing1.dwg");
    expect(plan.createdByName).toBe("W&Dflow on the drafting PC");
    expect(planPoImport(parsed(), null).createdByName).toBeNull();
    expect(planPoImport(parsed(), null, "  ").createdByName).toBeNull();
  });

  it("accepts a take-off with no items (an order with no lines yet)", () => {
    const plan = planPoImport(parsed({ ...BODY, categories: [] }), null);
    expect(plan.lineItems).toEqual([]);
  });
});

describe("purchaseOrderUrl", () => {
  it("opens the PO in Procurement, whatever the base's trailing slash", () => {
    expect(purchaseOrderUrl("https://aec-flow.com", "cmh1")).toBe("https://aec-flow.com/procurement/cmh1");
    expect(purchaseOrderUrl("https://aec-flow.com/", "cmh1")).toBe("https://aec-flow.com/procurement/cmh1");
  });
});

describe("nextPoNumber (the app's own generator, shared with the import)", () => {
  it("is the highest number + 1 in the PO-{year}-{NNN} series", () => {
    expect(nextPoNumber([], 2026)).toBe("PO-2026-001");
    expect(nextPoNumber(["PO-2026-001", "PO-2026-007", "PO-2025-003"], 2026)).toBe("PO-2026-008");
  });
});
