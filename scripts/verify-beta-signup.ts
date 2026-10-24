/**
 * End-to-end check for beta-tester self-signup. Exercises the real server
 * action against the live DB: rejects a bad code, creates an account with a
 * six-month window, rejects a duplicate, then deletes the test code, user and company.
 *
 * Run (with database credentials in the environment):
 *      npx ts-node --project scripts/tsconfig.json -r tsconfig-paths/register scripts/verify-beta-signup.ts
 * Requires a Next.js request context for the action's headers/cookies calls.
 */
import { registerBetaTester } from "../app/signup/actions";
import { prisma } from "../lib/db";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}

const EMAIL = "zzz-verify-beta@example.com";
const CODE = "AECFLOW-BETA-ZZZZ-VRFY";
const COMPANY = "ZZZ Verify Beta Signup Company";

async function cleanup() {
  await prisma.betaCode.deleteMany({ where: { code: CODE } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.company.deleteMany({ where: { name: COMPANY } });
}

async function main() {
  try {
    // Clean any prior run and create a dedicated, throwaway pool code.
    await cleanup();
    await prisma.betaCode.create({
      data: { code: CODE, keyPrefix: "AECFLOW-BETA-ZZZZ", cohort: "verify" },
    });

    const base = { name: "ZZZ Verify Tester", email: EMAIL, company: COMPANY, password: "supersecret1", acceptedTerms: true };

    const badCode = await registerBetaTester({ ...base, code: "WRONG-CODE", agreed: true });
    check("wrong code rejected", badCode.ok === false);

    const notAgreed = await registerBetaTester({ ...base, code: CODE, agreed: false });
    check("must agree to feedback", notAgreed.ok === false);

    const noTerms = await registerBetaTester({ ...base, code: CODE, agreed: true, acceptedTerms: false });
    check("must accept terms and privacy", noTerms.ok === false);

    const ok = await registerBetaTester({ ...base, code: CODE, agreed: true });
    check("valid signup succeeds", ok.ok === true);

    const u = await prisma.user.findUnique({ where: { email: EMAIL } });
    check("user created", Boolean(u));
    check("role is DIRECTOR", u?.role === "DIRECTOR");
    check("has password hash", Boolean(u?.passwordHash));
    const prefs = (u?.preferences ?? {}) as Record<string, unknown>;
    check("flagged as beta tester", prefs.betaTester === true);
    check("feedback agreement recorded", prefs.betaFeedbackAgreed === true);
    check("terms acceptance recorded", typeof prefs.termsAcceptedAt === "string" && typeof prefs.termsVersion === "string");
    const until = typeof prefs.betaAccessUntil === "string" ? new Date(prefs.betaAccessUntil) : null;
    const signed = typeof prefs.betaSignedUpAt === "string" ? new Date(prefs.betaSignedUpAt) : null;
    let months = 0;
    if (until && signed) {
      months = (until.getFullYear() - signed.getFullYear()) * 12 + (until.getMonth() - signed.getMonth());
    }
    check("six-month access window stamped", months === 6);

    const dup = await registerBetaTester({ ...base, code: CODE, agreed: true });
    check("duplicate email rejected", dup.ok === false);

  } finally {
    await cleanup();
  }
  const gone = await prisma.user.findUnique({ where: { email: EMAIL } });
  check("test user cleaned up", gone === null);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
