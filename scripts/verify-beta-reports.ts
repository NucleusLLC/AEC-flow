/**
 * Round-trip check for the BETA-Report module. Creates a Bug report (with a
 * tiny screenshot data-URL), reads it via the list + screenshot getters,
 * flips its status, then deletes the test row.
 *
 * Run: TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
 *      npx ts-node -r tsconfig-paths/register -r dotenv/config scripts/verify-beta-reports.ts
 */
import {
  createBetaReport,
  getBetaReports,
  getBetaReportScreenshot,
  updateBetaReportStatus,
  summarizeBetaReports,
} from "../lib/data/beta-reports";
import { prisma } from "../lib/db";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}

// 1x1 transparent PNG data-URL — stands in for a real screenshot.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function main() {
  const id = await createBetaReport({
    kind: "BUG",
    title: "ZZZ verify — login button misaligned",
    description: "Steps: open /login on mobile; the submit button overflows.",
    pageUrl: "http://localhost:3000/login",
    userAgent: "verify-script",
    screenshot: TINY_PNG,
    reporterName: "Verify Bot",
    reporterEmail: "verify@example.com",
  });
  check("create returns id", Boolean(id));

  const list = await getBetaReports();
  const row = list.find((r) => r.id === id);
  check("appears in list", Boolean(row));
  check("kind persisted (BUG)", row?.kind === "BUG");
  check("default status NEW", row?.status === "NEW");
  check("hasScreenshot true (image not in list payload)", row?.hasScreenshot === true);
  check("list omits raw screenshot field", !("screenshot" in (row ?? {})));
  check("reporter persisted", row?.reporterName === "Verify Bot");

  const shot = await getBetaReportScreenshot(id);
  check("screenshot fetch returns the data-URL", shot === TINY_PNG);

  const summary = await summarizeBetaReports(list);
  check("summary counts the bug", summary.total >= 1 && summary.bugs >= 1);

  await updateBetaReportStatus(id, "RESOLVED");
  const after = await prisma.betaReport.findUnique({ where: { id }, select: { status: true } });
  check("status update persisted (RESOLVED)", after?.status === "RESOLVED");

  await prisma.betaReport.delete({ where: { id } });
  const gone = await prisma.betaReport.findUnique({ where: { id } });
  check("test row cleaned up", gone === null);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
