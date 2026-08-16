# Drawing intake — schema and storage

*Built 2026-08-11/12. This is step 1 of the "recommended next steps" in
`01-FEASIBILITY.md` §12: the `Drawing` model, the private bucket, the signed-URL
flow, and a real `DrawingIntakeRepository`. Uploading a drawing now saves it.*

---

## 1. What changed, in one paragraph

The `/drawings` register was placeholder data — thirteen invented rows in
`lib/data/drawings.ts`, no table behind them. It is now a real table (`drawings`)
whose rows point at files in a private Supabase Storage bucket. The intake
component built in the previous run was already written against an interface;
this run implemented that interface and nothing about the component's contract
changed.

## 2. Why a new `Drawing` model, and not `DesignDeliverable`

The application already had a register: `DesignDeliverable`, behind `/design`.
It was the obvious candidate and it was the wrong one.

- It is keyed `@@unique([companyId, number])` — **one row per document number,
  with no revision dimension.** A drawing register's whole job is to hold
  revision B *and* revision C of `A-101` and know which superseded which.
- It has no bytes. `fileLink` is a text field pointing somewhere else.
- Its discipline enum has three values (`ARCHITECTURE`, `ENGINEERING`,
  `INTERIOR`), narrower than what a sheet prefix can tell you.

Reshaping a shipped table's unique key to fit a new module is a migration with
a blast radius; adding one is not. So the two registers coexist and mean
different things — **`DesignDeliverable` is what a discipline has promised to
produce; `Drawing` is what was actually received, revision by revision.** The
naming risk here is the same one the Service Proposal module documented, and the
same mitigation applies: never call a `Drawing` a deliverable in UI copy. A
cross-link between them is a sensible later addition, not a prerequisite.

## 3. The schema

`prisma/sql/0009_drawings.sql`, applied in a transaction with the new
`scripts/apply-sql.mjs` runner. Purely additive: three enums, one table, one
foreign key to `Project`.

The parts that carry a decision:

| Column | Why it is there |
| --- | --- |
| `@@unique([companyId, projectId, sheetNumber, revision])` | Makes "upload the same revision twice" an error instead of a silent duplicate. **Caveat, as everywhere in this schema: Postgres treats NULLs as distinct, so this does not constrain rows written by an unscoped script (`companyId` NULL). In-app writes always carry one.** |
| `storageKey` | The object key, **not a URL**. A stored URL either expires (and is useless) or does not (and is a copy of the file handed out with no further checks). |
| `sheetDiscipline` | The extractor distinguishes M, E and P; the register filters on `MEP`. Keeping the finer reading means the narrowing is a display choice rather than data loss. |
| `extractionAudit` | What was proposed, and which fields the user changed. §7 of the feasibility doc: **the per-field edit rate in production is the per-field error rate.** One JSON column is what turns "93% on fixtures" into a measured number on this firm's own files. |
| `supersededById` | Set on the OLD row when a newer revision replaces it, in the same transaction that writes the new one. |

`Drawing` is in `TENANT_MODELS` (`lib/db.ts`), so every read and write is
company-scoped by the Prisma extension. Leaving it out would have been a
cross-tenant leak; there is nothing to remember at the call sites.

The register's `Discipline` union was widened at the same time, from six values
to nine (`CIVIL`, `LANDSCAPE`, `GENERAL` added). Those three had no home before,
so `lib/drawings/mapping.ts` was filing them under the nearest wrong heading — a
landscape sheet stored as architecture is a small lie a register then repeats
forever. `LOSSY_DISCIPLINES` now lists only the five that genuinely collapse
into `MEP`.

## 4. Storage

**Bucket `drawings` — private**, created on the live project. No anonymous
policy at all; the anonymous-read check in `scripts/verify-drawing-intake.mjs`
asserts that and fails the run if it ever changes.

**Object key:** `projects/<projectId>/drawings/<uploadId>/<sanitised-filename>`

- *project-scoped* so a storage policy can be written as a prefix match;
- *upload-scoped* so nothing ever overwrites anything. Superseding a revision
  must not destroy the file that was issued — "what exactly did we send on the
  4th?" is asked after a dispute, not before one.
- The key is built and validated by `lib/drawings/storage-key.ts` (pure,
  unit-tested, 20 cases). It is **chosen by the server, never by the client**: a
  signed upload URL is a capability to write one object, so a client-named
  object could be someone else's. `registerDrawing` re-checks that any key it is
  handed back looks like one it issued, which is what stops path traversal and
  cross-project writes.

**The flow** (`lib/data/drawing-intake.ts`, called through
`app/(app)/drawings/actions.ts`):

1. `createUploadTicket` — re-runs the upload policy server-side (*a client-side
   limit is a courtesy, not a control*), checks the project belongs to the
   caller's company, chooses the key, mints a signed URL.
2. The browser `PUT`s the bytes **straight to storage**. They never traverse the
   Next.js server, which is what keeps a 50 MB drawing off a serverless
   function's request-body limit. A non-2xx response aborts before step 3 —
   registering after a failed upload would create a register entry pointing at
   nothing.
3. `registerDrawing` — asks storage whether the object really landed and takes
   the **size and MIME type from storage rather than from the client**, then
   writes the row. If the write fails, the orphaned object is deleted.

Downloads are signed per request (5 minutes) by `drawingFileUrlAction`.

## 5. The size limit is 50 MiB, and that is not our choice

The feasibility doc specified 100 MiB, sized for a bound DWG with xrefs.
**Supabase enforces a project-wide upload ceiling of 52428800 bytes (50 MiB) on
this project's plan**, and creating the bucket with a higher limit is rejected
outright (`EntityTooLarge`). A limit we cannot enforce is worse than a lower one
we can: the upload would fail at the storage edge *after* the whole file had
been transferred.

So `MAX_FILE_BYTES` is now 50 MiB and the server reads
`DRAWINGS_MAX_UPLOAD_BYTES` (defaulting to the same). **Large bound CAD files
will be refused.** The way out is a Supabase plan with a higher project limit,
then both numbers; nothing else in the code needs to change.

## 6. What was verified, and how

- `scripts/verify-drawing-intake.mjs` — a live round trip against the real
  project and bucket: sign → upload → object info (size matches) → register row
  → **duplicate revision rejected** → signed download (bytes match) →
  anonymous read refused. It cleans up after itself, including on failure.
- `npx vitest run` — 495 tests green (480 before), the 15 new ones covering
  storage keys and the corrected discipline mapping.
- `tsc --noEmit`, `eslint`, `next build` clean; `npm run golden` unchanged, so
  the protected Estimates/Schedule outputs are untouched.

## 7. What is deliberately still missing

1. ~~**PDF title-block extraction is not wired.**~~ **DONE 2026-08-16** — `unpdf`
   is installed and the server reads the sheet's own title block. See
   `03-TITLE-BLOCK.md`.
2. ~~**Production environment variables are not set.**~~ **DONE 2026-08-12** —
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DRAWINGS_BUCKET` and
   `DRAWINGS_MAX_UPLOAD_BYTES` are all set in the Vercel production project
   (encrypted), so uploads are live. **This line previously said they were
   missing and stayed wrong for four days; it was read as current and repeated
   in a later report.** A stale "not done" is more expensive than no note at
   all — if you finish something listed here, strike it the same day.
3. **`/projects/[id]/drawings` is still a placeholder panel** that links to the
   global register. It could now show that project's sheets; nothing blocks it.
4. **No `Attachment` row is written.** Drawings are their own table; folding
   them into the generic attachment list would only blur what a drawing is.
5. **Auto-accept remains off, by design.** Now that `extractionAudit` records
   proposals against edits, the honest next move is to ship, wait, and read the
   real per-field edit rate — then consider auto-accepting only the fields that
   earn it.
