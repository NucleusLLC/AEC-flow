/**
 * createImportedPurchaseOrder: the PO number comes from the app's generator over
 * the practice's existing numbers, and a lost race for a number (P2002 on the
 * (companyId, poNumber) unique index) is retried with a fresh read. Prisma is
 * faked at `@/lib/db`; no database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const state = vi.hoisted(() => ({
  existing: [] as { poNumber: string }[],
  /** Numbers another request "takes" just before ours is written. */
  stolen: [] as string[],
  created: [] as Record<string, unknown>[],
  creates: 0,
}));

vi.mock("@/lib/db", () => {
  const purchaseOrder = {
    findMany: vi.fn(async () => state.existing.map((r) => ({ ...r }))),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      state.creates++;
      const n = data.poNumber as string;
      if (state.stolen.includes(n)) {
        state.stolen = state.stolen.filter((s) => s !== n);
        state.existing.push({ poNumber: n });
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        });
      }
      state.existing.push({ poNumber: n });
      state.created.push(data);
      return { id: `po_${state.creates}`, poNumber: n };
    }),
  };
  const tx = { purchaseOrder };
  return {
    prisma: {
      purchaseOrder,
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

import { PO_NUMBER_ATTEMPTS, createImportedPurchaseOrder } from "./api-v1";
import { planPoImport } from "@/lib/api/v1/po-import";
import { parseImportPayload } from "@/lib/api/v1/estimate-import";

function plan() {
  const r = parseImportPayload({
    source: "W&Dflow",
    title: "Doors L0",
    categories: [{ name: "Doors", items: [{ task: "D1", size: "900x2100", qty: 3, unit: "no" }] }],
  });
  if (!r.ok) throw new Error(r.message);
  return planPoImport(r.payload, null, "W&Dflow");
}

beforeEach(() => {
  state.existing = [];
  state.stolen = [];
  state.created = [];
  state.creates = 0;
});

describe("createImportedPurchaseOrder", () => {
  it("numbers the first order of the year PO-<year>-001 and writes the plan", async () => {
    const po = await createImportedPurchaseOrder(plan(), 2026);
    expect(po.poNumber).toBe("PO-2026-001");
    expect(state.created[0]).toMatchObject({
      poNumber: "PO-2026-001",
      vendorName: "To be assigned",
      status: "DRAFT",
      total: 0,
      createdByName: "W&Dflow",
      lineItems: [{ description: "Doors — D1 900x2100", quantity: 3, unit: "no", unitPrice: 0 }],
    });
  });

  it("continues the practice's series", async () => {
    state.existing = [{ poNumber: "PO-2026-004" }, { poNumber: "PO-2026-011" }];
    expect((await createImportedPurchaseOrder(plan(), 2026)).poNumber).toBe("PO-2026-012");
  });

  it("re-reads and takes the next number when a concurrent create won the race", async () => {
    state.existing = [{ poNumber: "PO-2026-004" }];
    state.stolen = ["PO-2026-005", "PO-2026-006"];
    const po = await createImportedPurchaseOrder(plan(), 2026);
    expect(po.poNumber).toBe("PO-2026-007");
    expect(state.creates).toBe(3);
  });

  it("gives up after a bounded number of lost races", async () => {
    state.stolen = Array.from({ length: PO_NUMBER_ATTEMPTS }, (_, i) => `PO-2026-${String(i + 1).padStart(3, "0")}`);
    await expect(createImportedPurchaseOrder(plan(), 2026)).rejects.toMatchObject({ code: "P2002" });
    expect(state.creates).toBe(PO_NUMBER_ATTEMPTS);
  });
});
