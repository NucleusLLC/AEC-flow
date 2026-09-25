/**
 * End-to-end check of the billing bridge: approved work → invoice → stamps →
 * release.
 *
 * WHY THIS IS NOT A UNIT TEST. `lib/finance/billing.ts` is pure and already has
 * unit tests; what they cannot reach is the part that actually prevents a
 * double bill — a conditional `updateMany` inside a transaction, and the
 * release that a void performs. Those are database behaviours, so they are
 * proved against a database.
 *
 * NEVER POINT THIS AT PRODUCTION. It writes and deletes rows. Run it against a
 * throwaway Postgres:
 *
 *   DATABASE_URL=postgres://aec:aec@127.0.0.1:54332/aecflow \
 *   VERIFY_COMPANY_ID=<company> VERIFY_USER_ID=<user> \
 *   npx ts-node --project scripts/tsconfig.verify.json \
 *     -r tsconfig-paths/register scripts/verify-work-billing.ts
 *
 * It refuses to start against a host that is not local.
 */
import { prisma } from "../lib/db";
import {
  billedWorkFor,
  projectsWithUnbilledWork,
  raiseInvoiceFromWork,
  releaseWork,
  unbilledWork,
  WorkBillingError,
} from "../lib/data/work-billing";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) {
    failures += 1;
    if (detail !== undefined) console.log("      ", detail);
  }
}

const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL is not a local host.");
  console.error("This script writes and deletes rows. Point it at a throwaway database.");
  process.exit(2);
}

const COMPANY = process.env.VERIFY_COMPANY_ID!;
const USER = process.env.VERIFY_USER_ID!;
const TAG = "ZZZ-WORKBILL";
const day = (n: number) => new Date(`2026-09-${String(n).padStart(2, "0")}T00:00:00.000Z`);

async function seed() {
  await cleanup();

  // Prisma, not raw SQL: the models carry their own @@map, and a hand-written
  // table name in a throwaway script is one more thing to keep in step with
  // the schema.
  await prisma.company.upsert({
    where: { id: COMPANY },
    update: {},
    create: { id: COMPANY, name: `${TAG} Company` },
  });
  await prisma.user.upsert({
    where: { id: USER },
    update: { status: "ACTIVE", companyId: COMPANY },
    create: {
      id: USER,
      name: `${TAG} Director`,
      email: `${TAG.toLowerCase()}@example.invalid`,
      role: "DIRECTOR",
      status: "ACTIVE",
      companyId: COMPANY,
    },
  });

  const client = await prisma.client.create({
    data: { id: `${TAG}-C1`, name: `${TAG} Client`, companyId: COMPANY },
  });

  const project = await prisma.project.create({
    data: {
      id: `${TAG}-P1`,
      projectNumber: `${TAG}-001`,
      name: `${TAG} Villa`,
      currency: "AWG",
      // The relation form, not the scalar: Prisma treats a create as either
      // checked or unchecked, and `client` is a required relation. companyId
      // is left to the tenant extension in lib/db.ts, which is what a real
      // request does too.
      client: { connect: { id: client.id } },
      manager: { connect: { id: USER } },
    },
  });

  // Two people, three days, one rate change — so the grouping, the weighted
  // rate and the mixed-rate flag are all exercised on real rows.
  const time = [
    { id: `${TAG}-T1`, userId: "u-dana", userName: "Dana Director", date: day(21), hours: 8, chargeRate: 175, costRate: 60 },
    { id: `${TAG}-T2`, userId: "u-dana", userName: "Dana Director", date: day(22), hours: 4, chargeRate: 175, costRate: 60 },
    { id: `${TAG}-T3`, userId: "u-dana", userName: "Dana Director", date: day(23), hours: 2, chargeRate: 200, costRate: 60 },
    { id: `${TAG}-T4`, userId: "u-sam", userName: "Sam Staff", date: day(22), hours: 6, chargeRate: 120, costRate: 45 },
    { id: `${TAG}-T5`, userId: "u-sam", userName: "Sam Staff", date: day(23), hours: 4, chargeRate: 120, costRate: 45 },
  ];
  for (const t of time) {
    await prisma.timeEntry.create({
      data: {
        ...t,
        companyId: COMPANY,
        projectId: project.id,
        projectName: project.name,
        billable: true,
        status: "APPROVED",
        currency: "AWG",
        description: "Permit drawings",
      },
    });
  }

  // One that must NOT be billed, so "excluded, and why" is proved rather than
  // assumed: a draft row sitting in the same project.
  await prisma.timeEntry.create({
    data: {
      id: `${TAG}-TD`,
      companyId: COMPANY,
      userId: "u-sam",
      userName: "Sam Staff",
      projectId: project.id,
      projectName: project.name,
      date: day(24),
      hours: 3,
      chargeRate: 120,
      costRate: 45,
      billable: true,
      status: "DRAFT",
      currency: "AWG",
    },
  });

  await prisma.expense.create({
    data: {
      id: `${TAG}-E1`,
      companyId: COMPANY,
      userId: USER,
      userName: `${TAG} Director`,
      projectId: project.id,
      projectName: project.name,
      date: day(22),
      category: "PRINTING",
      description: "A0 plots",
      vendor: "Copy Center",
      amount: 240,
      markupPercent: 10,
      billable: true,
      status: "APPROVED",
      currency: "AWG",
    },
  });

  return project;
}

async function cleanup() {
  const tagged = { id: { startsWith: TAG } };
  await prisma.invoiceLine.deleteMany({ where: { invoice: { projectId: { startsWith: TAG } } } });
  await prisma.invoice.deleteMany({ where: { projectId: { startsWith: TAG } } });
  await prisma.timeEntry.deleteMany({ where: tagged });
  await prisma.expense.deleteMany({ where: tagged });
  await prisma.project.deleteMany({ where: tagged });
  await prisma.client.deleteMany({ where: tagged });
}

async function main() {
  const project = await seed();

  // ── What is waiting to be billed ─────────────────────────────────────────
  const waiting = await projectsWithUnbilledWork();
  const mine = waiting.find((w) => w.projectId === project.id);
  check("the job appears on the unbilled list", !!mine, waiting);
  // 8×175 + 4×175 + 2×200 + 6×120 + 4×120 = 1400 + 700 + 400 + 720 + 480 = 3700,
  // plus the expense at 240 × 1.10 = 264.
  check("its charge-out value is exact", mine?.total === 3964, mine);
  check("its hours exclude the draft row", mine?.hours === 24, mine);
  check("oldest is the first day worked", mine?.oldest === "2026-09-21", mine);

  const work = await unbilledWork({ projectId: project.id });
  check("one line per person-and-rate plus one per expense", work.lines.length === 4, work.lines.map((l) => l.key));
  const danaLines = work.lines.filter((l) => l.key.startsWith("time:u-dana"));
  check("a mid-job rate change becomes two lines, not one averaged one", danaLines.length === 2, danaLines.map((l) => l.key));
  check(
    "every line with a rate multiplies out exactly",
    work.lines
      .filter((l) => l.quantity !== null && l.unitRate !== null)
      .every((l) => Math.abs(l.quantity! * l.unitRate! - l.amount) < 0.005),
    work.lines,
  );
  check("the draft row is excluded, with a reason", work.excluded.some((x) => x.id === `${TAG}-TD` && x.why === "not approved (draft)"), work.excluded);

  // ── Raising part of it ───────────────────────────────────────────────────
  const raised = await raiseInvoiceFromWork({
    projectId: project.id,
    lineKeys: [...danaLines.map((l) => l.key), `expense:${TAG}-E1`],
    taxName: "BBO",
    taxPercent: 7,
  });
  check("the invoice is raised", !!raised.id, raised);
  check("only the chosen rows are stamped", raised.stampedTime === 3 && raised.stampedExpenses === 1, raised);

  const invoice = await prisma.invoice.findFirst({
    where: { id: raised.id },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  check("it is a draft", invoice?.status === "DRAFT");
  // 2500 net (1400 + 700 + 400 = 2500 for Dana) + 264 expense = 2764; BBO 7% = 193.48.
  check("the stored total is exact to the cent", Number(invoice?.total) === 2957.48, invoice?.total);
  check("each line carries the company", invoice?.lines.every((l) => l.companyId === COMPANY) === true);
  check("a source row names the line it landed on", invoice?.lines.some((l) => l.id === (
    // the first of Dana's rows
    (invoice.lines.find((x) => x.description.startsWith("Dana"))?.id)
  )) === true);

  const stampedDana = await prisma.timeEntry.findFirst({ where: { id: `${TAG}-T1` } });
  check("the stamp names the invoice", stampedDana?.invoiceId === raised.id && stampedDana?.invoiceNumber === invoice?.number, stampedDana);
  check("the stamp names the line", !!stampedDana?.invoiceLineId && invoice?.lines.some((l) => l.id === stampedDana!.invoiceLineId) === true);

  const billed = await billedWorkFor(raised.id);
  check("the invoice can say what it was raised from", billed.hours === 14 && billed.entries === 3 && billed.expenses === 1, billed);

  // ── What is left ─────────────────────────────────────────────────────────
  const after = await unbilledWork({ projectId: project.id });
  check("billed work leaves the unbilled list", after.lines.length === 1 && after.lines[0].key === "time:u-sam@120", after.lines.map((l) => l.key));
  check("what is left is exactly Sam's hours", after.total === 1200, after.total);
  // Deliberate: billed rows vanish rather than pile up as "already invoiced"
  // noise. The invoice number stamped on the row is where that is answered.
  check("billed rows do not clutter the excluded list", after.excluded.every((x) => x.why !== "already on an invoice"), after.excluded);
  check("the draft row is still listed as unapproved", after.excluded.some((x) => x.id === `${TAG}-TD`), after.excluded);

  // ── The double-bill guard ────────────────────────────────────────────────
  // Re-raise using a key that is still visible to a stale browser tab. The
  // grouping no longer produces it, so the call must refuse rather than raise
  // an empty invoice.
  let refused = "";
  try {
    await raiseInvoiceFromWork({ projectId: project.id, lineKeys: danaLines.map((l) => l.key) });
  } catch (e) {
    refused = e instanceof WorkBillingError ? e.message : `wrong error: ${String(e)}`;
  }
  check("a stale tab cannot bill the same hours twice", refused === "Nothing was chosen to bill.", refused);
  const invoiceCount = await prisma.invoice.count({ where: { projectId: project.id } });
  check("and no second invoice was created", invoiceCount === 1, invoiceCount);

  // ── Release ──────────────────────────────────────────────────────────────
  const released = await releaseWork(raised.id);
  check("voiding gives the work back", released.time === 3 && released.expenses === 1, released);
  const restored = await unbilledWork({ projectId: project.id });
  check("all of it is billable again", restored.total === 3964, restored.total);
  check("and nothing is left stamped", restored.excluded.every((x) => x.why !== "already on an invoice"), restored.excluded);

  // ── The race, for real ───────────────────────────────────────────────────
  // The "stale tab" check above passes for the wrong reason: the key had
  // already disappeared from the grouping. This one reproduces the actual
  // race — the page is rendered, a COLLEAGUE bills one of the rows, and only
  // then is the button clicked. The conditional `invoicedAt: null` in the
  // updateMany is the only thing standing between that and a double bill, so
  // it is worth proving rather than trusting. Remove it and this check fails.
  const fresh = await unbilledWork({ projectId: project.id });
  const samLine = fresh.lines.find((l) => l.key.startsWith("time:u-sam"))!;
  const before = await prisma.invoice.count({ where: { projectId: project.id } });

  await prisma.timeEntry.update({
    where: { id: samLine.timeEntryIds[0] },
    data: { invoicedAt: new Date(), invoiceId: "someone-elses-invoice", invoiceNumber: "X-1" },
  });

  let raced = "";
  try {
    await raiseInvoiceFromWork({
      projectId: project.id,
      lineKeys: [samLine.key],
      expectedTotal: samLine.amount,
    });
  } catch (e) {
    raced = e instanceof WorkBillingError ? "refused" : `wrong error: ${String(e)}`;
  }
  check("a row billed by a colleague mid-click stops the whole invoice", raced === "refused", raced);
  // Mutation check: drop `expectedTotal` and the same call succeeds, raising an
  // invoice for less than the screen showed. That is the bug this guards.
  const withoutGuard = await raiseInvoiceFromWork({ projectId: project.id, lineKeys: [samLine.key] });
  check(
    "without the expected-total guard it would quietly bill less",
    withoutGuard.stampedTime === samLine.timeEntryIds.length - 1,
    withoutGuard,
  );
  await releaseWork(withoutGuard.id);
  await prisma.invoice.deleteMany({ where: { id: withoutGuard.id } });
  check(
    "and the transaction rolled back — no half-raised invoice",
    (await prisma.invoice.count({ where: { projectId: project.id } })) === before,
  );
  const untouched = await prisma.timeEntry.findFirst({ where: { id: samLine.timeEntryIds[1] } });
  check("and the rows that were free are still free", untouched?.invoicedAt === null, untouched?.invoicedAt);

  await cleanup();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => {});
  process.exit(1);
});
