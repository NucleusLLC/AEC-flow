/**
 * Materials & Equipment Price Lists — Prisma-backed firm price book.
 *
 * SERVER-ONLY (imports Prisma → pg). Client components import the type /
 * constants / static fallback from `./price-lists.types` (re-exported below).
 * See [[aec-prisma-client-boundary]].
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { PriceItem } from "./price-lists.types";

export * from "./price-lists.types";

export type PriceBook = { materials: PriceItem[]; equipment: PriceItem[] };

function toDto(r: Prisma.PriceItemGetPayload<object>): PriceItem {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    unit: r.unit,
    unitPrice: r.unitPrice,
    supplier: r.supplier ?? undefined,
    note: r.note ?? undefined,
    region: r.region ?? undefined,
    currency: r.currency ?? undefined,
  };
}

/** The whole firm price book, split into materials + equipment. */
export async function getPriceBook(): Promise<PriceBook> {
  const rows = await prisma.priceItem.findMany({ orderBy: { sortOrder: "asc" } });
  return {
    materials: rows.filter((r) => r.kind === "MATERIAL").map(toDto),
    equipment: rows.filter((r) => r.kind === "EQUIPMENT").map(toDto),
  };
}

/**
 * Replace the whole price book (it's a single firm-wide reference list). New
 * rows from the editor carry temp ids ("px-new-…") — those get fresh cuids;
 * existing ids are preserved so the live-fetch mapping keeps working.
 */
export async function savePriceBook(materials: PriceItem[], equipment: PriceItem[]): Promise<void> {
  const rows = [
    ...materials.map((m, i) => ({ item: m, kind: "MATERIAL" as const, sortOrder: i })),
    ...equipment.map((e, i) => ({ item: e, kind: "EQUIPMENT" as const, sortOrder: i })),
  ];
  const data = rows.map(({ item, kind, sortOrder }) => ({
    ...(item.id && !item.id.startsWith("px-new-") ? { id: item.id } : {}),
    kind,
    code: item.code,
    name: item.name,
    category: item.category,
    unit: item.unit,
    unitPrice: item.unitPrice,
    supplier: item.supplier ?? null,
    note: item.note ?? null,
    region: item.region ?? null,
    currency: item.currency ?? null,
    sortOrder,
  }));

  await prisma.$transaction([
    prisma.priceItem.deleteMany({}),
    prisma.priceItem.createMany({ data }),
  ]);
}
