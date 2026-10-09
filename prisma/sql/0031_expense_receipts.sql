-- 0031 — a receipt on an expense (a photo or a PDF).
--
-- Additive: five nullable columns on "expenses", so every existing expense
-- reads back as "no receipt". Apply BEFORE merging the PR that adds them —
-- Prisma selects every column it knows, so deploying the code first makes the
-- expense register (and the accounting export) fail.
--
-- Numbered 0031 because 0030 is taken by the credit-notes branch; the two are
-- independent and may be applied in either order.
--
-- NO NEW BUCKET. The file lives in the existing private "drawings" bucket
-- (lib/server/storage.ts) under receipts/<expenseId>/<uploadId>/<filename>,
-- the same way permit letters (permits/...) and contract templates
-- (contracts/...) already do. The bucket has no anonymous policy; reads go
-- through a five-minute signed URL minted by a server route that checks the
-- tenant and the person.
--
-- RLS and the 0012 lockdown are per table, so new columns need no grants, and
-- no new table is created here.
--
-- Apply with:
--   node scripts/apply-sql.mjs prisma/sql/0031_expense_receipts.sql
--   node scripts/verify-data-api-lockdown.mjs

alter table "expenses" add column if not exists "receiptStorageKey" text;
alter table "expenses" add column if not exists "receiptFilename" text;
alter table "expenses" add column if not exists "receiptMimeType" text;
alter table "expenses" add column if not exists "receiptSizeBytes" integer;
alter table "expenses" add column if not exists "receiptUploadedAt" timestamp(3);
