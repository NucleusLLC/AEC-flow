import { describe, it, expect } from "vitest";
import {
  copyLines,
  selectedTasks,
  currenciesMatch,
  copySummary,
  type Selection,
  type CopyOptions,
} from "@/lib/estimates/copy-lines";
import type { EstimateCategory, EstimateItem } from "@/lib/data/estimates.types";

const item = (over: Partial<EstimateItem> = {}): EstimateItem => ({
  id: "item-1",
  task: "Blockwork 15cm",
  qty: 240,
  unit: "m2",
  laborNorm: 0.8,
  materialUnitCost: 34.5,
  equipmentUnitCost: 2,
  subcontractUnitCost: 0,
  poc: 60,
  code: "MAS-015",
  ...over,
});

const source: EstimateCategory[] = [
  {
    id: "sec-a",
    name: "Superstructure",
    code: "B10",
    items: [item(), item({ id: "item-2", task: "Columns", code: "CON-COL", qty: 12, poc: 100 })],
  },
  {
    id: "sec-b",
    name: "Finishes",
    code: "C30",
    items: [item({ id: "item-3", task: "Floor tiling", code: "FIN-TIL", qty: 180, poc: 0 })],
  },
];

/** Deterministic ids, so a test can assert that they CHANGED and how. */
const ids = () => {
  let n = 0;
  return (kind: "section" | "item") => `new-${kind}-${++n}`;
};

const opts = (over: Partial<CopyOptions> = {}): CopyOptions => ({
  sourceCurrency: "AWG",
  targetCurrency: "AWG",
  ...over,
});

const all: Selection = { sections: ["sec-a", "sec-b"], items: [] };

describe("currenciesMatch", () => {
  it("ignores case and stray whitespace on two user-typed codes", () => {
    expect(currenciesMatch("AWG", "awg")).toBe(true);
    expect(currenciesMatch(" AWG ", "AWG")).toBe(true);
  });

  it("is false for genuinely different money", () => {
    expect(currenciesMatch("AWG", "USD")).toBe(false);
    expect(currenciesMatch("", "USD")).toBe(false);
  });
});

describe("selectedTasks", () => {
  it("a ticked section means every task in it", () => {
    const groups = selectedTasks(source, { sections: ["sec-a"], items: [] });
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
  });

  it("takes only the ticked tasks from a section that is not itself ticked", () => {
    const groups = selectedTasks(source, { sections: [], items: ["item-2"] });
    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe("sec-a");
    expect(groups[0].items.map((i) => i.id)).toEqual(["item-2"]);
  });

  it("does not double a task that is ticked inside a ticked section", () => {
    const groups = selectedTasks(source, { sections: ["sec-a"], items: ["item-1"] });
    expect(groups[0].items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
  });

  it("drops a section with nothing chosen in it", () => {
    expect(selectedTasks(source, { sections: [], items: [] })).toEqual([]);
    expect(selectedTasks(source, { sections: [], items: ["item-3"] })).toHaveLength(1);
  });

  it("keeps the source order, so the copy reads like the sheet it came from", () => {
    const groups = selectedTasks(source, { sections: [], items: ["item-3", "item-1"] });
    expect(groups.map((g) => g.category.id)).toEqual(["sec-a", "sec-b"]);
  });
});

describe("copyLines — what travels", () => {
  it("carries the code, the description, the unit and the labour norm", () => {
    const res = copyLines(source, { sections: ["sec-a"], items: [] }, opts(), ids());
    const first = res.categories[0].items[0];
    expect(first.code).toBe("MAS-015");
    expect(first.task).toBe("Blockwork 15cm");
    expect(first.unit).toBe("m2");
    // Hours per unit is a property of the WORK — the destination applies its own
    // labour rate to it, which is the whole value of copying a task.
    expect(first.laborNorm).toBe(0.8);
  });

  it("carries the section's own classification code — the template path loses it", () => {
    const res = copyLines(source, all, opts(), ids());
    expect(res.categories.map((c) => c.code)).toEqual(["B10", "C30"]);
    expect(res.categories.map((c) => c.name)).toEqual(["Superstructure", "Finishes"]);
  });

  it("resets the quantity, because a quantity is the SOURCE building's take-off", () => {
    const res = copyLines(source, all, opts(), ids());
    expect(res.categories.flatMap((c) => c.items).map((i) => i.qty)).toEqual([0, 0, 0]);
  });

  it("carries quantities when asked — a repeated unit type is a real case", () => {
    const res = copyLines(source, all, opts({ includeQuantities: true }), ids());
    expect(res.categories.flatMap((c) => c.items).map((i) => i.qty)).toEqual([240, 12, 180]);
  });

  it("ALWAYS resets progress, whatever the options say", () => {
    for (const o of [opts(), opts({ includeQuantities: true, includePrices: true })]) {
      const res = copyLines(source, all, o, ids());
      expect(res.categories.flatMap((c) => c.items).every((i) => i.poc === 0)).toBe(true);
    }
  });

  it("leaves prices out by default", () => {
    const res = copyLines(source, all, opts(), ids());
    const first = res.categories[0].items[0];
    expect(first.materialUnitCost).toBe(0);
    expect(first.equipmentUnitCost).toBe(0);
    expect(first.subcontractUnitCost).toBe(0);
  });

  it("carries prices when asked and the currencies agree", () => {
    const res = copyLines(source, all, opts({ includePrices: true }), ids());
    expect(res.categories[0].items[0].materialUnitCost).toBe(34.5);
    expect(res.pricesWithheld).toBe(false);
  });

  it("WITHHOLDS prices across currencies even when asked, and says so", () => {
    // These are absolute snapshots with indexation, region and FX already baked
    // in. In another currency the number is not stale, it is meaningless.
    const res = copyLines(
      source,
      all,
      opts({ includePrices: true, targetCurrency: "USD" }),
      ids(),
    );
    expect(res.pricesWithheld).toBe(true);
    expect(res.categories[0].items[0].materialUnitCost).toBe(0);
  });

  it("treats a per-unit labour RATE as money, and the norm as not money", () => {
    const withRate: EstimateCategory[] = [
      {
        id: "sec-a",
        name: "S",
        items: [item({ calculationMethod: "labor_rate", laborRatePerUnit: 42 })],
      },
    ];
    const bare = copyLines(withRate, { sections: ["sec-a"], items: [] }, opts(), ids());
    expect(bare.categories[0].items[0].laborRatePerUnit).toBeUndefined();
    expect(bare.categories[0].items[0].laborNorm).toBe(0.8);
    expect(bare.categories[0].items[0].calculationMethod).toBe("labor_rate");

    const priced = copyLines(
      withRate,
      { sections: ["sec-a"], items: [] },
      opts({ includePrices: true }),
      ids(),
    );
    expect(priced.categories[0].items[0].laborRatePerUnit).toBe(42);
  });

  it("gives every copied row a new id, including assembly components", () => {
    const withAssembly: EstimateCategory[] = [
      {
        id: "sec-a",
        name: "S",
        items: [
          item({
            calculationMethod: "assembly",
            assembly: [
              { id: "asm-1", name: "Mason", type: "labor", qty: 1, unitCost: 30 },
              { id: "asm-2", name: "Block", type: "material", qty: 12.5, unitCost: 2.1 },
            ],
          }),
        ],
      },
    ];
    const res = copyLines(
      withAssembly,
      { sections: ["sec-a"], items: [] },
      opts({ includePrices: true }),
      ids(),
    );
    const copied = res.categories[0];
    expect(copied.id).not.toBe("sec-a");
    expect(copied.items[0].id).not.toBe("item-1");
    // Two lines sharing a component id is a copy that edits its own source.
    expect(copied.items[0].assembly?.map((a) => a.id)).toEqual(["new-item-3", "new-item-4"]);
    expect(copied.items[0].assembly?.map((a) => a.name)).toEqual(["Mason", "Block"]);
  });

  it("drops the assembly with the prices it contains", () => {
    const withAssembly: EstimateCategory[] = [
      {
        id: "sec-a",
        name: "S",
        items: [
          item({
            assembly: [{ id: "asm-1", name: "Mason", type: "labor", qty: 1, unitCost: 30 }],
          }),
        ],
      },
    ];
    const res = copyLines(withAssembly, { sections: ["sec-a"], items: [] }, opts(), ids());
    expect(res.categories[0].items[0].assembly).toBeUndefined();
  });

  it("counts what it copied", () => {
    const res = copyLines(source, all, opts(), ids());
    expect(res.taskCount).toBe(3);
    expect(res.categories).toHaveLength(2);
  });

  it("copies nothing from an empty selection rather than everything", () => {
    const res = copyLines(source, { sections: [], items: [] }, opts(), ids());
    expect(res.categories).toEqual([]);
    expect(res.taskCount).toBe(0);
  });
});

describe("copySummary", () => {
  it("says what is being left behind, not only what is being taken", () => {
    const res = copyLines(source, all, opts(), ids());
    const text = copySummary(res, opts());
    expect(text).toContain("3 tasks in 2 sections");
    expect(text).toContain("quantities and prices reset to zero");
  });

  it("names what is carried when both are asked for", () => {
    const o = opts({ includeQuantities: true, includePrices: true });
    const text = copySummary(copyLines(source, all, o, ids()), o);
    expect(text).toContain("with quantities and prices");
    expect(text).not.toContain("reset to zero");
  });

  it("explains a withheld price by naming both currencies", () => {
    const o = opts({ includePrices: true, targetCurrency: "USD" });
    const text = copySummary(copyLines(source, all, o, ids()), o);
    expect(text).toContain("AWG");
    expect(text).toContain("USD");
    expect(text).toContain("Prices were not copied");
  });

  it("uses the singular for one task", () => {
    const one: Selection = { sections: [], items: ["item-3"] };
    const text = copySummary(copyLines(source, one, opts(), ids()), opts());
    expect(text).toContain("1 task in 1 section");
  });
});
