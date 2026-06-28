<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## ⚠️ Shared database — never `prisma db push`
This app's Supabase database (`zouzxwuojnsyjvadvldr`) is **shared with NucleusLicenseOps**
(the licensing/billing system — github.com/greglacle/nucleus-licenseops). 26 of its tables
(`licenses`, `companies`, `usage_*`, `stripe_*`, `floating_sessions`, …) live in this same DB.

- **Do NOT run `prisma db push`** (and never `--accept-data-loss`). It enforces "DB == this
  schema" and will try to **drop/alter** the NucleusLicenseOps tables. Those tables are mapped
  at the bottom of `prisma/schema.prisma` as `@@ignore`d models so push won't drop them, but
  Prisma still can't represent some of their features (partial indexes, RLS) — so push remains
  unsafe.
- **To change this app's schema:** use additive `ALTER TABLE` via `prisma db execute`, or a
  small `$executeRawUnsafe` script through `@/lib/db`. Then update `schema.prisma` to match and
  run `prisma generate` (NOT push).
- If NucleusLicenseOps changes its schema, re-introspect (`prisma db pull --print`) and refresh
  the mapped block. Verify safety any time with:
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
  — it must report **"This is an empty migration."** (no DROP/ALTER of license tables).
