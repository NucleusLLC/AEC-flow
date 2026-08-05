/**
 * Round-trip check for the Schedule Budget columns against the LIVE database.
 *
 * PROTECTED SYSTEM (schedule) — additive verification, approved 2026-08-04.
 *
 * Proves the three things a nullable-additive migration has to prove:
 *   1. `ScheduleTask.budgetAmount/budgetSource/budgetRef` survive a save/read cycle,
 *      and a Decimal comes back as the same amount rather than a float approximation.
 *   2. "No budget set" round-trips as NULL, not as 0 — the distinction the whole panel
 *      rests on.
 *   3. `PurchaseOrder.scheduleTaskKey` attributes a real order to a task, and an order
 *      left unattributed lands in the rollup's unassigned bucket rather than vanishing.
 *
 * Deliberately mirrors scripts/verify-schedule-persistence.ts, including its cleanup.
 *
 * Run: TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
 *      npx ts-node -r tsconfig-paths/register -r dotenv/config scripts/verify-schedule-budget.ts
 */
import { getSchedule, saveSchedule } from "../lib/data/schedule-db";
import { getProjectCommitments, setCommitmentTask } from "../lib/data/schedule-budget";
import { rollupBudget, toMajor } from "../lib/schedule/budget";
import type { ScheduleTask } from "../lib/data/schedule";
import { prisma } from "../lib/db";

let failures = 0;
function check(name: string, cond: boolean, got?: unknown) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  (got ${JSON.stringify(got)})`}`);
  if (!cond) failures++;
}

const PID = "ZZZ-BUDGET-TEST";
const PO_A = "ZZZ-PO-BUDGET-A";
const PO_B = "ZZZ-PO-BUDGET-B";

const tasks: ScheduleTask[] = [
  {
    id: "a",
    name: "Foundations",
    discipline: "CONSTRUCTION",
    status: "IN_PROGRESS",
    start: "2026-02-01",
    end: "2026-03-01",
    progressPct: 50,
    dependsOn: [],
    budgetAmount: 12345.67,
    budgetSource: "estimate",
    budgetRef: "cat:c1,item:i9",
  },
  {
    id: "b",
    name: "Superstructure",
    discipline: "STRUCTURAL",
    status: "NOT_STARTED",
    start: "2026-03-02",
    end: "2026-04-01",
    progressPct: 0,
    dependsOn: ["a"],
    // No budget on purpose — must come back NULL, never 0.
  },
];

async function cleanup() {
  await prisma.projectSchedule.deleteMany({ where: { projectId: PID } });
  await prisma.purchaseOrder.deleteMany({ where: { poNumber: { in: [PO_A, PO_B] } } });
}

async function main() {
  await cleanup();

  await saveSchedule({
    projectId: PID,
    projectNumber: PID,
    projectName: "Budget Round-Trip",
    client: "C",
    manager: "M",
    tasks,
  });

  const back = await getSchedule(PID);
  const a = back?.tasks.find((t) => t.id === "a");
  const b = back?.tasks.find((t) => t.id === "b");

  check("schedule reads back", !!back);
  check("budgetAmount survives as the exact amount", a?.budgetAmount === 12345.67, a?.budgetAmount);
  check("budgetSource survives", a?.budgetSource === "estimate", a?.budgetSource);
  check("budgetRef survives", a?.budgetRef === "cat:c1,item:i9", a?.budgetRef);
  check("an unbudgeted task returns NULL, not 0", b?.budgetAmount === null, b?.budgetAmount);

  // Clearing a budget must persist as cleared.
  await saveSchedule({
    projectId: PID,
    projectNumber: PID,
    projectName: "Budget Round-Trip",
    client: "C",
    manager: "M",
    tasks: [{ ...tasks[0], budgetAmount: null, budgetSource: null, budgetRef: null }, tasks[1]],
  });
  const cleared = (await getSchedule(PID))?.tasks.find((t) => t.id === "a");
  check("a cleared budget stays cleared", cleared?.budgetAmount === null, cleared?.budgetAmount);

  // Restore the budget for the rollup assertions below.
  await saveSchedule({
    projectId: PID,
    projectNumber: PID,
    projectName: "Budget Round-Trip",
    client: "C",
    manager: "M",
    tasks,
  });

  // ── Commitments ──────────────────────────────────────────────────────────
  const currency = "AWG";
  const created = await prisma.purchaseOrder.createMany({
    data: [
      {
        poNumber: PO_A,
        projectId: PID,
        vendorName: "Vendor A",
        status: "ISSUED",
        currency,
        lineItems: [{ description: "Rebar", quantity: 10, unit: "t", unitPrice: 100, receivedQty: 4 }],
        subtotal: 1000,
        taxPercentage: 0,
        shipping: 100,
        total: 1100,
      },
      {
        poNumber: PO_B,
        projectId: PID,
        vendorName: "Vendor B",
        status: "ISSUED",
        currency,
        lineItems: [{ description: "Cement", quantity: 5, unit: "bag", unitPrice: 40 }],
        subtotal: 200,
        taxPercentage: 0,
        shipping: 0,
        total: 200,
      },
    ],
  });
  check("two purchase orders created", created.count === 2, created.count);

  const { updated } = await setCommitmentTask({ purchaseOrderId: await idOf(PO_A), projectId: PID, taskKey: "a" });
  check("purchase order attributed to a task", updated === 1, updated);

  const commitments = await getProjectCommitments(PID);
  check("both commitments read back", commitments.length === 2, commitments.length);

  const roll = rollupBudget({
    tasks: (await getSchedule(PID))!.tasks,
    commitments,
    currency,
  });
  const rowA = roll.rows.find((r) => r.taskId === "a");
  check("budget lands on the task", toMajor(rowA!.budget!) === 12345.67, rowA?.budget);
  check("committed lands on the task", toMajor(rowA!.committed) === 1100, toMajor(rowA!.committed));
  // 4 of 10 units received = 400 of 1000 in lines; shipping apportioned pro-rata → 440.
  check("received is pro-rata of the order total", toMajor(rowA!.received) === 440, toMajor(rowA!.received));
  check("the unattributed order is in the unassigned bucket", roll.unassigned.count === 1, roll.unassigned.count);
  check("unassigned money is reported, not dropped", toMajor(roll.unassigned.committed) === 200, toMajor(roll.unassigned.committed));
  check("unassigned money is NOT in the task totals", toMajor(roll.totals.committed) === 1100, toMajor(roll.totals.committed));

  // Clearing an attribution puts the money back in the unassigned bucket.
  await setCommitmentTask({ purchaseOrderId: await idOf(PO_A), projectId: PID, taskKey: null });
  const roll2 = rollupBudget({ tasks: (await getSchedule(PID))!.tasks, commitments: await getProjectCommitments(PID), currency });
  check("clearing an attribution returns it to unassigned", roll2.unassigned.count === 2, roll2.unassigned.count);

  // Cross-project writes must be refused.
  const wrong = await setCommitmentTask({ purchaseOrderId: await idOf(PO_A), projectId: "ZZZ-OTHER-PROJECT", taskKey: "a" });
  check("a cross-project attribution is refused", wrong.updated === 0, wrong.updated);
}

async function idOf(poNumber: string): Promise<string> {
  const row = await prisma.purchaseOrder.findFirstOrThrow({ where: { poNumber } });
  return row.id;
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    try {
      await cleanup();
      console.log("cleanup: test schedule + purchase orders deleted");
    } catch (e) {
      console.error("cleanup failed:", e);
    }
    await prisma.$disconnect();
    if (failures > 0) {
      console.error(`\n${failures} check(s) FAILED`);
      process.exit(1);
    } else console.log("\nAll schedule budget round-trip checks passed ✓");
  });
