/** Does getEstimateById() return the sheet for a signed-in user of this company? */
import "dotenv/config";
import { getEstimateById } from "@/lib/data/estimates";

async function main() {
  const ids = ["cmrh1s7zs000004l410azeses", "cmr54wm1c000004lew1nvrdl9", "EST-2025-031"];
  for (const id of ids) {
    const est = await getEstimateById(id);
    const cats = est?.categories?.length ?? 0;
    const items = est?.categories?.reduce((n: number, c: { items?: unknown[] }) => n + (c.items?.length ?? 0), 0) ?? 0;
    console.log(`${id.padEnd(26)} -> ${est ? `LOADED cats:${cats} items:${items}` : "NULL  <<< app shows an EMPTY sheet and autosaves over it"}`);
  }
}
void main();
