/**
 * Dev utility — set a known password on every seeded user so the (already-built)
 * credentials login actually works.
 *
 * Standalone on purpose: it does NOT touch prisma/seed.ts (owned by another
 * session). Run:  node -r dotenv/config prisma/set-dev-passwords.mjs
 *
 * NOTE: re-running prisma/seed.ts resets passwordHash to null (its upsert
 * `update` block sets it), so re-run this after any re-seed.
 *
 * DEV_PASSWORD IS REQUIRED — there is deliberately no default. This script points
 * at whatever DIRECT_URL points at, which in this project is the PRODUCTION
 * database; a hardcoded fallback meant a known password sat on every seeded
 * account, written out in plaintext in the docs, until it was rotated on
 * 2026-08-12. A password that lives in the repository is a password everyone has.
 *
 *   DEV_PASSWORD='choose-something' node -r dotenv/config prisma/set-dev-passwords.mjs
 *
 * It also sets the SAME password on every seeded user, which is fine for a local
 * demo and wrong for anything else. To give one person a password, use the app:
 * Settings → Members & Roles → Set password.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const PASSWORD = process.env.DEV_PASSWORD;
if (!PASSWORD || PASSWORD.length < 10) {
  console.error(
    "DEV_PASSWORD must be set to at least 10 characters. Refusing to write a default password.",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

const hash = await bcrypt.hash(PASSWORD, 10);
const users = await prisma.user.findMany({ select: { id: true, email: true } });
for (const u of users) {
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
}
console.log(`Set password "${PASSWORD}" on ${users.length} users:`);
for (const u of users) console.log("  -", u.email);
await prisma.$disconnect();
