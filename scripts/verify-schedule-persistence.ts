/**
 * Round-trip persistence check for the Schedule module (Gantt).
 * Saves a schedule with tasks + a dependency, reads it back, asserts the data
 * survived (incl. dependsOn / category), then deletes the test row.
 *
 * Run: TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
 *      npx ts-node -r tsconfig-paths/register -r dotenv/config scripts/verify-schedule-persistence.ts
 */
import { getSchedule, saveSchedule } from "../lib/data/schedule-db";
import type { ScheduleTask } from "../lib/data/schedule";
import { prisma } from "../lib/db";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}

const PID = "ZZZ-SCHED-TEST";
const tasks: ScheduleTask[] = [
  { id: "a", name: "Design", discipline: "ARCHITECTURE", status: "IN_PROGRESS", start: "2026-02-01", end: "2026-03-01", progressPct: 50, dependsOn: [], category: "design" },
  { id: "b", name: "Build", discipline: "STRUCTURAL", status: "NOT_STARTED", start: "2026-03-02", end: "2026-04-01", progressPct: 0, dependsOn: ["a"] },
];

async function main() {
  // Pre-clean any leftover.
  await prisma.projectSchedule.deleteMany({ where: { projectId: PID } });

  // Seed fallback: a non-existent project returns null.
  check("unknown project → null before save", (await getSchedule(PID)) === null);

  await saveSchedule({ projectId: PID, projectNumber: PID, projectName: "Sched Test", client: "C", manager: "M", tasks });
  const back = await getSchedule(PID);
  check("schedule reads back after save", !!back);
  check("task count persisted", back?.tasks.length === 2);
  check("task keys preserved", back?.tasks.map((t) => t.id).join(",") === "a,b");
  check("dependency preserved", JSON.stringify(back?.tasks.find((t) => t.id === "b")?.dependsOn) === JSON.stringify(["a"]));
  check("category preserved", back?.tasks.find((t) => t.id === "a")?.category === "design");
  check("progress preserved", back?.tasks.find((t) => t.id === "a")?.progressPct === 50);
  check("window derived (start/end)", back?.start === "2026-02-01" && back?.end === "2026-04-01");

  // Re-save with fewer tasks → wholesale replace.
  await saveSchedule({ projectId: PID, projectNumber: PID, projectName: "Sched Test", client: "C", manager: "M", tasks: [tasks[0]] });
  const back2 = await getSchedule(PID);
  check("re-save replaces tasks wholesale", back2?.tasks.length === 1);
}

main()
  .catch((e) => { console.error(e); failures++; })
  .finally(async () => {
    try { await prisma.projectSchedule.deleteMany({ where: { projectId: PID } }); console.log("cleanup: test schedule deleted"); }
    catch (e) { console.error("cleanup failed:", e); }
    await prisma.$disconnect();
    if (failures > 0) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
    else console.log("\nAll schedule persistence checks passed ✓");
  });
