/**
 * End-to-end check for beta-tester self-signup. Exercises the real server
 * action against the live DB: rejects a bad code, creates an account with a
 * 12-month window, rejects a duplicate, then deletes the test user.
 *
 * Run: TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
 *      npx ts-node -r tsconfig-paths/register -r dotenv/config scripts/verify-beta-signup.ts
 */
import { registerBetaTester } from "../app/signup/actions";
import { prisma } from "../lib/db";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}

const EMAIL = "zzz-verify-beta@example.com";
const CODE = process.env.BETA_SIGNUP_CODE || "";

async function main() {
  // clean any prior run
  await prisma.user.deleteMany({ where: { email: EMAIL } });

  const base = { name: "ZZZ Verify Tester", email: EMAIL, company: "Test Co", password: "supersecret1" };

  const badCode = await registerBetaTester({ ...base, code: "WRONG-CODE", agreed: true });
  check("wrong code rejected", badCode.ok === false);

  const notAgreed = await registerBetaTester({ ...base, code: CODE, agreed: false });
  check("must agree to feedback", notAgreed.ok === false);

  const ok = await registerBetaTester({ ...base, code: CODE, agreed: true });
  check("valid signup succeeds", ok.ok === true);

  const u = await prisma.user.findUnique({ where: { email: EMAIL } });
  check("user created", Boolean(u));
  check("role is STAFF", u?.role === "STAFF");
  check("has password hash", Boolean(u?.passwordHash));
  const prefs = (u?.preferences ?? {}) as Record<string, unknown>;
  check("flagged as beta tester", prefs.betaTester === true);
  check("feedback agreement recorded", prefs.betaFeedbackAgreed === true);
  const until = typeof prefs.betaAccessUntil === "string" ? new Date(prefs.betaAccessUntil) : null;
  const signed = typeof prefs.betaSignedUpAt === "string" ? new Date(prefs.betaSignedUpAt) : null;
  let months = 0;
  if (until && signed) {
    months = (until.getFullYear() - signed.getFullYear()) * 12 + (until.getMonth() - signed.getMonth());
  }
  check("12-month access window stamped", months === 12);

  const dup = await registerBetaTester({ ...base, code: CODE, agreed: true });
  check("duplicate email rejected", dup.ok === false);

  await prisma.user.deleteMany({ where: { email: EMAIL } });
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
