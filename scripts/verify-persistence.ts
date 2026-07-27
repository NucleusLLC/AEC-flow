/**
 * Round-trip persistence check for the calculation-engine fields (Phase 5).
 * Saves an estimate that uses Labor/Rate + Assembly, reads it back from the DB,
 * asserts the new fields survived, then deletes the test estimate.
 *
 * Run: TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
 *      npx ts-node -r tsconfig-paths/register -r dotenv/config scripts/verify-persistence.ts
 */
import { saveEstimate, getEstimateById } from "../lib/data/estimates";
import type { CostEstimate } from "../lib/data/estimates";
import { prisma } from "../lib/db";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}

const ID = "ZZZ-PERSIST-TEST";

const est: CostEstimate = {
  id: ID,
  projectId: null,
  projectName: "Persistence Test",
  version: "V1",
  date: "2026-01-01",
  location: "—",
  currency: "AWG",
  avgLaborRate: 50,
  profitPct: 10,
  bboPct: 5,
  categories: [
    {
      id: "ptc1",
      name: "Methods",
      items: [
        { id: "p-norm", task: "Norm line", qty: 5, unit: "m²", laborNorm: 2, materialUnitCost: 4, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 0 },
        { id: "p-rate", task: "Labor/Rate line", qty: 5, unit: "m²", laborNorm: 2, materialUnitCost: 0, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 0, calculationMethod: "labor_rate", laborRatePerUnit: 80 },
        { id: "p-asm", task: "Assembly line", qty: 2, unit: "no", laborNorm: 0, materialUnitCost: 0, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 0, calculationMethod: "assembly", assembly: [
          { id: "ac1", name: "Mason", type: "labor", qty: 3, unitCost: 40 },
          { id: "ac2", name: "Block", type: "material", qty: 10, unitCost: 5 },
        ] },
      ],
    },
  ],
};

async function main() {
  await saveEstimate(est, 0);
  const back = await getEstimateById(ID);
  if (!back) { check("estimate read back", false); return; }

  const items = back.categories[0]?.items ?? [];
  const norm = items.find((i) => i.task === "Norm line");
  const rate = items.find((i) => i.task === "Labor/Rate line");
  const asm = items.find((i) => i.task === "Assembly line");

  check("norm line persists as default (no method)", !!norm && (norm.calculationMethod ?? "norm") === "norm");
  check("labor_rate method persisted", rate?.calculationMethod === "labor_rate");
  check("laborRatePerUnit persisted", rate?.laborRatePerUnit === 80);
  check("assembly method persisted", asm?.calculationMethod === "assembly");
  check("assembly components persisted (count)", (asm?.assembly?.length ?? 0) === 2);
  check("assembly component values persisted", asm?.assembly?.[0]?.type === "labor" && asm?.assembly?.[0]?.unitCost === 40);
}

main()
  .catch((e) => { console.error(e); failures++; })
  .finally(async () => {
    // Cleanup — remove the test estimate (cascades to categories/items).
    try { await prisma.costEstimate.delete({ where: { id: ID } }); console.log("cleanup: test estimate deleted"); }
    catch (e) { console.error("cleanup failed:", e); }
    await prisma.$disconnect();
    if (failures > 0) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
    else console.log("\nAll persistence checks passed ✓");
  });
