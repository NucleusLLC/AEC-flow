/**
 * Copying coded tasks from one project's estimate into another's.
 *
 * PURE, and separate from the data layer, because almost everything that can go
 * wrong here is a decision about WHICH FIELDS TRAVEL — and every one of those
 * decisions is quiet. A copied line with the wrong number in it looks exactly
 * like a copied line with the right number in it, on a sheet that becomes a
 * quote to a client.
 *
 * The four that matter, each learned from how this module stores its data:
 *
 *   `qty`      does NOT travel by default. A quantity comes from the SOURCE
 *              project's take-off — its lengths, widths and counts (see
 *              TakeoffRow in lib/data/estimates.types.ts). Carrying it into
 *              another project imports the wrong building, silently, into a
 *              field nobody re-checks because it is already filled in.
 *   `poc`      never travels. It is percent-complete. A task copied at 60%
 *              would show phantom progress, and a progress AMOUNT, on a project
 *              where no one has done anything. `saveAsTemplate` resets it for
 *              the same reason.
 *   unit costs travel only when the two estimates share a currency. These are
 *              absolute snapshots: `addCostItem` bakes in indexation, regional
 *              adjustment and FX at the moment of insert. Across currencies the
 *              number is not stale, it is meaningless.
 *   `laborNorm` always travels. It is HOURS PER UNIT — a property of the work,
 *              not of the project or the money — and the destination multiplies
 *              it by its own `avgLaborRate`. This is the one field that makes a
 *              copied task worth having.
 *
 * And one thing that travels which the existing template path DROPS: the
 * section's own `code`. `applyTemplate` and `saveAsTemplate` both carry only
 * `name` and `items`, so a UniFormat code is lost on every round trip through a
 * template. A copy that loses the classification is not a copy of the estimate.
 */

import type { EstimateCategory, EstimateItem } from "@/lib/data/estimates.types";

/** What the user ticked. Sections and items are chosen independently. */
export type Selection = {
  /** Section ids ticked in their own right — takes every item in them. */
  sections: readonly string[];
  /** Item ids ticked individually. */
  items: readonly string[];
};

export type CopyOptions = {
  /**
   * Bring the quantities across. Off by default — see the note above. On is a
   * deliberate answer to "the two buildings are the same", which does happen:
   * a repeated unit type, a second phase of the same block.
   */
  includeQuantities?: boolean;
  /**
   * Bring the material / equipment / subcontract unit costs across. The caller
   * must only offer this when the currencies match; `copyLines` enforces it
   * anyway, because a UI that is wrong about this produces a wrong quote.
   */
  includePrices?: boolean;
  /** The source estimate's currency, e.g. "AWG". */
  sourceCurrency: string;
  /** The destination estimate's currency. */
  targetCurrency: string;
};

/** New ids, supplied by the caller so this module stays pure and testable. */
export type IdFactory = (kind: "section" | "item") => string;

export type CopyResult = {
  /** Sections to APPEND to the destination, in source order. */
  categories: EstimateCategory[];
  /** How many tasks were copied. */
  taskCount: number;
  /** True when prices were asked for and withheld because the currencies differ. */
  pricesWithheld: boolean;
};

/**
 * Whether the destination can take the prices as they stand.
 *
 * Case- and whitespace-insensitive, because these are user-entered currency
 * codes on two records edited months apart.
 */
export function currenciesMatch(a: string, b: string): boolean {
  return (a ?? "").trim().toUpperCase() === (b ?? "").trim().toUpperCase();
}

/**
 * The tasks a selection actually names.
 *
 * A ticked SECTION means every task in it, including ones not ticked
 * individually — that is what ticking the section is for. A section ticked with
 * items also ticked is the same set, not a doubled one, which is why this
 * returns a filtered view of the source rather than a concatenation.
 */
export function selectedTasks(
  categories: readonly EstimateCategory[],
  selection: Selection,
): { category: EstimateCategory; items: EstimateItem[] }[] {
  const wholeSections = new Set(selection.sections);
  const individualItems = new Set(selection.items);

  return categories
    .map((category) => ({
      category,
      items: wholeSections.has(category.id)
        ? category.items
        : category.items.filter((item) => individualItems.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Builds the sections to append to the destination estimate.
 *
 * Empty sections are dropped: a section ticked whose every item was left out
 * would arrive as a heading with nothing under it, which reads as data loss
 * rather than as a choice.
 */
export function copyLines(
  categories: readonly EstimateCategory[],
  selection: Selection,
  options: CopyOptions,
  newId: IdFactory,
): CopyResult {
  const groups = selectedTasks(categories, selection);
  const samecurrency = currenciesMatch(options.sourceCurrency, options.targetCurrency);
  const withPrices = options.includePrices === true && samecurrency;
  const pricesWithheld = options.includePrices === true && !samecurrency;

  const copied: EstimateCategory[] = groups.map((group) => ({
    id: newId("section"),
    name: group.category.name,
    // Carried, unlike the template path — see the module note.
    code: group.category.code,
    items: group.items.map((item) => copyItem(item, { withPrices, withQuantities: options.includeQuantities === true, newId })),
  }));

  return {
    categories: copied,
    taskCount: copied.reduce((n, c) => n + c.items.length, 0),
    pricesWithheld,
  };
}

function copyItem(
  item: EstimateItem,
  opts: { withPrices: boolean; withQuantities: boolean; newId: IdFactory },
): EstimateItem {
  return {
    ...item,
    id: opts.newId("item"),
    // What the task IS: the code, the description, the unit, the labour norm and
    // how it is calculated all describe the work and travel untouched.
    qty: opts.withQuantities ? item.qty : 0,
    // Never. See the module note.
    poc: 0,
    materialUnitCost: opts.withPrices ? item.materialUnitCost : 0,
    equipmentUnitCost: opts.withPrices ? item.equipmentUnitCost : 0,
    subcontractUnitCost: opts.withPrices ? item.subcontractUnitCost : 0,
    // An assembly is a priced breakdown of one line, so it follows the same rule
    // as the prices it contains — and its own ids are regenerated, since two
    // lines sharing a component id is a copy that edits its own source.
    assembly:
      item.assembly && opts.withPrices
        ? item.assembly.map((component) => ({ ...component, id: opts.newId("item") }))
        : undefined,
    // A per-unit labour RATE is money, so it obeys the currency rule; the norm
    // (hours) does not, and is left alone by the spread above.
    laborRatePerUnit: opts.withPrices ? item.laborRatePerUnit : undefined,
  };
}

/**
 * The sentence shown before the copy happens, so the person pressing the button
 * knows what they are about to move and what is being left behind.
 *
 * Written out rather than implied: "3 tasks" is not enough to notice that the
 * quantities are about to arrive as zero.
 */
export function copySummary(result: CopyResult, options: CopyOptions): string {
  const tasks = `${result.taskCount} ${result.taskCount === 1 ? "task" : "tasks"}`;
  const sections = `${result.categories.length} ${result.categories.length === 1 ? "section" : "sections"}`;
  const carried: string[] = [];
  const left: string[] = [];

  (options.includeQuantities ? carried : left).push("quantities");
  (options.includePrices && !result.pricesWithheld ? carried : left).push("prices");

  const parts = [`${tasks} in ${sections}`];
  if (carried.length) parts.push(`with ${carried.join(" and ")}`);
  if (left.length) parts.push(`${left.join(" and ")} reset to zero`);
  const sentence = parts.join(", ") + ".";

  return result.pricesWithheld
    ? `${sentence} Prices were not copied: this estimate is in ${options.sourceCurrency} and the destination is in ${options.targetCurrency}.`
    : sentence;
}
