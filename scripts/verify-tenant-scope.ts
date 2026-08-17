/**
 * Proves the findUnique tenant-scope fixes against the REAL database, as a signed-in
 * user — the only condition under which the defect exists.
 *
 * THE DEFECT. lib/db.ts scopes tenant models by injecting `companyId` into the WHERE
 * for findMany/findFirst/count/…, but `findUnique` cannot take an extra field in a
 * unique WHERE, so the extension instead checks the ROW that comes back:
 *
 *     return row.companyId === cid ? row : null;
 *
 * When the query used a narrow `select` that omits `companyId`, that field is
 * `undefined`, the comparison is always false, and the call returns null (or throws,
 * for findUniqueOrThrow) for EVERY signed-in user. The fix is findFirst with the same
 * (still unique) WHERE, so the scope is a real database filter.
 *
 * Ordinary scripts cannot see this: they run with `currentCompanyId() === undefined`,
 * where nothing is scoped and the row-guard never executes. Hence the next-auth shim —
 * see scripts/next-auth-session-shim.ts.
 *
 * Run (company context — the interesting case):
 *   VERIFY_COMPANY_ID=<companyId> npx tsx --tsconfig scripts/tsconfig.verify.json scripts/verify-tenant-scope.ts
 *
 * Run the isolation half from a company that owns none of the rows by passing a
 * different VERIFY_COMPANY_ID. Creates only throwaway rows, and deletes them.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const CID = process.env.VERIFY_COMPANY_ID;
const PROBE = "__tenant-scope-probe__";

const raw = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

let pass = 0;
let fail = 0;
let skip = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (ok) pass++;
  else fail++;
};
const skipped = (label: string) => {
  console.log(`SKIP  ${label}`);
  skip++;
};

async function main() {
  if (!CID) {
    console.error("Set VERIFY_COMPANY_ID to a companyId. Without it there is no company context and nothing is scoped.");
    process.exit(1);
  }

  const { currentCompanyId } = await import("@/lib/server/request-company");
  const cid = await currentCompanyId();
  check(
    cid === CID,
    `company context established — currentCompanyId() = ${JSON.stringify(cid)} (a string, as for a signed-in user)`,
  );
  if (cid !== CID) {
    console.error("\nWithout a company on the session the guard never runs and every check below is vacuous.");
    process.exit(1);
  }

  const { prisma } = await import("@/lib/db");

  /* ---------------------------------------------------------------- *
   * Does the extension apply inside $transaction?
   * ---------------------------------------------------------------- */
  const allClients = await raw.client.count();
  const mineClients = await raw.client.count({ where: { companyId: CID } });
  const txFindMany = await prisma.$transaction(async (tx) => tx.client.findMany({ select: { id: true } }));
  check(
    txFindMany.length === mineClients && allClients > mineClients,
    `the extension DOES apply inside $transaction — tx.findMany returned ${txFindMany.length} of ${allClients} clients (this company owns ${mineClients})`,
  );

  const anyClient = await raw.client.findFirst({ where: { companyId: CID }, select: { id: true } });
  if (anyClient) {
    const narrow = await prisma.$transaction(async (tx) =>
      tx.client.findUnique({ where: { id: anyClient.id }, select: { id: true } }),
    );
    const bare = await prisma.$transaction(async (tx) => tx.client.findUnique({ where: { id: anyClient.id } }));
    // These two document the defect itself; they are expected to keep behaving this
    // way until lib/db.ts's guard changes, and are why `tx.` calls need the same care
    // as `prisma.` ones.
    check(narrow === null, "tx.findUnique with a narrow select still returns null (the defect, reproduced directly)");
    check(bare !== null, "tx.findUnique returning all scalars is fine (companyId is present, so the guard works)");
  } else {
    skipped("direct findUnique reproduction — this company owns no Client rows");
  }

  /* ---------------------------------------------------------------- *
   * The fixed call sites, through their real exported functions
   * ---------------------------------------------------------------- */

  // Drawing — getDrawing(). User-visible: the drawing register's detail read.
  const drawing = await raw.drawing.findFirst({ where: { companyId: CID }, select: { id: true, sheetNumber: true } });
  if (drawing) {
    const { getDrawing } = await import("@/lib/data/drawings");
    const got = await getDrawing(drawing.id);
    check(got !== null, `getDrawing(${drawing.sheetNumber}) returns the row — SELECT omits companyId, so findUnique returned null here`);
  } else {
    skipped("getDrawing() — this company owns no Drawing rows");
  }

  // Client — updateClient()'s tx.client.findUnique decides "Client X not found."
  // User-visible: saving the client edit form.
  const { createClient, updateClient, getClient } = await import("@/lib/data/clients");
  const made = await createClient({ name: PROBE, addresses: [{ label: "Primary", line1: "1 Probe St", isPrimary: true }] } as never);
  try {
    let threw: string | null = null;
    try {
      await updateClient({ id: made.id, name: `${PROBE} edited`, addresses: [{ label: "Primary", line1: "2 Probe St", isPrimary: true }] } as never);
    } catch (e) {
      threw = (e as Error).message;
    }
    const after = await getClient(made.id);
    check(
      threw === null && after?.name === `${PROBE} edited`,
      `updateClient() saves the edit${threw ? ` — threw: ${threw}` : ""}`,
    );
  } finally {
    await raw.clientAddress.deleteMany({ where: { clientId: made.id } });
    await raw.client.delete({ where: { id: made.id } }).catch(() => {});
  }

  // ProjectSchedule — saveSchedule()'s upsert. Before the fix the existing-row lookup
  // read null, the CREATE branch ran, and the save died on projectId's unique index.
  const sched = await raw.projectSchedule.findFirst({
    where: { companyId: CID },
    select: { id: true, projectId: true, projectNumber: true, projectName: true },
  });
  if (sched) {
    const { getSchedule, saveSchedule } = await import("@/lib/data/schedule-db");
    const before = await getSchedule(sched.projectId);
    let threw: string | null = null;
    try {
      await saveSchedule({
        projectId: sched.projectId,
        projectNumber: sched.projectNumber,
        projectName: sched.projectName,
        tasks: before?.tasks ?? [],
        config: before?.config,
      });
    } catch (e) {
      threw = (e as Error).message.split("\n").filter(Boolean)[0] ?? "unique constraint";
    }
    const rows = await raw.projectSchedule.count({ where: { projectId: sched.projectId } });
    check(
      threw === null && rows === 1,
      `saveSchedule() updates the existing row instead of colliding on projectId's unique index${threw ? ` — threw: ${threw}` : ""}`,
    );
  } else {
    skipped("saveSchedule() — this company owns no ProjectSchedule rows");
  }

  // CostEstimate — assertUnlocked(), reached through saveEstimate on a LOCKED estimate.
  // Before the fix the lock row read as null, so `row?.locked` was falsy and the
  // server-side freeze was bypassed: a locked version accepted writes.
  const { saveEstimate, setEstimateLock, getEstimateById } = await import("@/lib/data/estimates");
  const probe = await raw.costEstimate.create({
    data: { projectName: PROBE, version: "V1.0", currency: "AWG", client: PROBE, companyId: CID },
  });
  try {
    const est = await getEstimateById(probe.id);
    if (!est) {
      skipped("assertUnlocked() — the probe estimate did not load");
    } else {
      await setEstimateLock(probe.id, true);
      let refused = false;
      try {
        await saveEstimate({ ...est, projectName: "__should-not-land__" }, 999);
      } catch {
        refused = true;
      }
      const onDisk = await raw.costEstimate.findUnique({ where: { id: probe.id }, select: { projectName: true } });
      check(refused && onDisk?.projectName === PROBE, "a LOCKED estimate refuses a save — the server-side freeze fires");
    }
  } finally {
    await raw.costEstimate.delete({ where: { id: probe.id } }).catch(() => {});
  }

  // ProposalTemplate — duplicateTemplate(). Same defect shape; exercised only when
  // the company has a template, which the seed data does not create.
  const tpl = await raw.proposalTemplate.findFirst({ where: { companyId: CID }, select: { id: true } });
  if (tpl) {
    const { duplicateTemplate, deleteTemplate } = await import("@/lib/data/proposal-templates");
    let copyId: string | null = null;
    try {
      const copy = await duplicateTemplate(tpl.id);
      copyId = copy.id;
      check(true, "duplicateTemplate() copies the template");
    } catch (e) {
      check(false, `duplicateTemplate() failed: ${(e as Error).message}`);
    } finally {
      if (copyId) await deleteTemplate(copyId).catch(() => {});
    }
  } else {
    skipped("duplicateTemplate() — this company owns no ProposalTemplate rows");
  }

  /* ---------------------------------------------------------------- *
   * Isolation — the fixes must not have traded a null for a leak
   * ---------------------------------------------------------------- */
  const foreignDrawing = await raw.drawing.findFirst({ where: { companyId: { not: CID } }, select: { id: true } });
  if (foreignDrawing) {
    const { getDrawing } = await import("@/lib/data/drawings");
    check((await getDrawing(foreignDrawing.id)) === null, "getDrawing() on ANOTHER company's id still returns null");
  } else {
    skipped("cross-tenant getDrawing() — no Drawing row belongs to another company");
  }

  const foreignClient = await raw.client.findFirst({ where: { companyId: { not: CID } }, select: { id: true } });
  if (foreignClient) {
    let refused = false;
    try {
      await updateClient({ id: foreignClient.id, name: "__must-not-land__", addresses: [] } as never);
    } catch {
      refused = true;
    }
    const still = await raw.client.findUnique({ where: { id: foreignClient.id }, select: { name: true } });
    check(refused && still?.name !== "__must-not-land__", "updateClient() on ANOTHER company's client is still refused");
  } else {
    skipped("cross-tenant updateClient() — no Client row belongs to another company");
  }

  console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped (skips are missing seed data, not successes)`);
  if (fail) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => raw.$disconnect());
