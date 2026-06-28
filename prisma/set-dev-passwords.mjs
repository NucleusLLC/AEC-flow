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
 * Override the password with DEV_PASSWORD=... in the env if desired.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const PASSWORD = process.env.DEV_PASSWORD || "ZenArch2026!";

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
