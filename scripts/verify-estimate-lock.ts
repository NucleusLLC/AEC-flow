/**
 * Proves the version lock is a SERVER rule, not a disabled input.
 *
 * Creates a throwaway estimate, locks it, and tries to save through the real write path
 * (saveEstimate — the same one the sheet's autosave calls). The write must be refused.
 * Then unlocks, saves again, and confirms it goes through. Cleans up after itself.
 *
 * Run: npx tsx --tsconfig scripts/tsconfig.json scripts/verify-estimate-lock.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { saveEstimate, duplicateEstimate, setEstimateLock, getEstimateById } from "@/lib/data/estimates";

const raw = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

let pass = 0;
let fail = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  ok ? pass++ : fail++;
};

async function main() {
  const created = await raw.costEstimate.create({
    data: { projectName: "__lock-test__", version: "V1.0", currency: "AWG", client: "__test__" },
  });
  const id = created.id;

  try {
    const est = await getEstimateById(id);
    if (!est) throw new Error("could not load the test estimate");

    // 1. Unlocked → a save lands.
    await saveEstimate({ ...est, projectName: "__lock-test__ edited" }, 100);
    const afterEdit = await raw.costEstimate.findUnique({ where: { id } });
    check(afterEdit?.projectName === "__lock-test__ edited", "unlocked estimate accepts a save");

    // 2. Locked → the same save is REFUSED.
    await setEstimateLock(id, true);
    let refused = false;
    try {
      await saveEstimate({ ...est, projectName: "__should-never-land__" }, 999);
    } catch {
      refused = true;
    }
    const afterLocked = await raw.costEstimate.findUnique({ where: { id } });
    check(refused, "locked estimate REFUSES a save (throws)");
    check(afterLocked?.projectName === "__lock-test__ edited", "locked estimate is unchanged on disk");
    check(afterLocked?.amount === 100, "locked estimate's amount did not move");

    // 3. Duplicating a locked version is allowed, and the copy is editable.
    const copy = await duplicateEstimate(id, "V1.1");
    const copyRow = await raw.costEstimate.findUnique({ where: { id: copy.id } });
    check(copyRow?.version === "V1.1", "duplicate created with the new version label");
    check(copyRow?.locked === false, "the copy is unlocked");
    check(copyRow?.client === "__test__", "the copy carried the source's client");
    await raw.costEstimate.delete({ where: { id: copy.id } });

    // 4. Unlock → writes flow again.
    await setEstimateLock(id, false);
    await saveEstimate({ ...est, projectName: "__after-unlock__" }, 200);
    const afterUnlock = await raw.costEstimate.findUnique({ where: { id } });
    check(afterUnlock?.projectName === "__after-unlock__", "unlocking restores writes");
  } finally {
    await raw.costEstimate.delete({ where: { id } }).catch(() => {});
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => raw.$disconnect());
