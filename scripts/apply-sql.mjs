/**
 * Apply one of the numbered files in prisma/sql/ to the database, in a
 * transaction.
 *
 *   node scripts/apply-sql.mjs prisma/sql/0009_drawings.sql
 *
 * WHY THIS EXISTS. This repository applies schema changes as reviewed SQL files
 * rather than through `prisma migrate` (there is no migrations directory — see
 * prisma/sql/0001..0008). Until now each one was applied by hand; the risk in
 * that is a half-applied file, so this runner wraps the whole script in BEGIN /
 * COMMIT and rolls back on the first error.
 *
 * It connects on DIRECT_URL (port 5432), not the pooled DATABASE_URL: DDL and
 * the transaction pooler do not mix.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-sql.mjs <path-to-sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DIRECT_URL (or DATABASE_URL) is not set.");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`applied ${file}`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error(`rolled back — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
