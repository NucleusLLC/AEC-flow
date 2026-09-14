/**
 * Check that the Supabase Data API cannot reach the public schema.
 *
 *   node scripts/verify-data-api-lockdown.mjs
 *
 * Read-only. Exits 1 if any public table has RLS off, if `anon` or
 * `authenticated` hold any table/sequence grant or function EXECUTE (directly
 * or through PUBLIC), or if `postgres`'s default privileges would grant them
 * access to the next table created. Run it after applying any prisma/sql file
 * — see prisma/sql/0012_lock_down_data_api.sql for why.
 */
import "dotenv/config";
import { Client } from "pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DIRECT_URL (or DATABASE_URL) is not set.");
  process.exit(1);
}

const checks = [
  {
    name: "public tables with RLS disabled",
    sql: `select c.relname as item
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity`,
  },
  {
    name: "table grants to anon/authenticated",
    sql: `select distinct grantee || ' ' || privilege_type || ' ' || table_name as item
          from information_schema.role_table_grants
          where table_schema = 'public' and grantee in ('anon','authenticated')`,
  },
  {
    name: "sequences usable by anon/authenticated",
    sql: `select c.relname as item
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'S'
            and (has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE')
              or has_sequence_privilege('authenticated', c.oid, 'USAGE,SELECT,UPDATE'))`,
  },
  {
    name: "public functions executable by anon/authenticated",
    sql: `select p.proname as item
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and (has_function_privilege('anon', p.oid, 'EXECUTE')
              or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`,
  },
  {
    name: "postgres default privileges granting anon/authenticated",
    sql: `select d.defaclobjtype::text || ' ' || d.defaclacl::text as item
          from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
          where n.nspname = 'public' and pg_get_userbyid(d.defaclrole) = 'postgres'
            and d.defaclacl::text ~ '(^|[{,])(anon|authenticated)='`,
  },
];

const client = new Client({ connectionString });
await client.connect();
let failed = 0;
try {
  await client.query("begin read only");
  for (const check of checks) {
    const { rows } = await client.query(check.sql);
    if (rows.length === 0) {
      console.log(`ok    ${check.name}`);
    } else {
      failed++;
      console.log(`FAIL  ${check.name} (${rows.length})`);
      for (const r of rows.slice(0, 10)) console.log(`        ${r.item}`);
      if (rows.length > 10) console.log(`        … ${rows.length - 10} more`);
    }
  }
  await client.query("rollback");
} finally {
  await client.end();
}
process.exitCode = failed ? 1 : 0;
