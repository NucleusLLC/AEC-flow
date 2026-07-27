# Construction Administration & Reporting

Project-controls module for construction administration: change orders, RFIs,
progress reports, and lender/owner progress certifications — with live cost
calculations, a real Prisma-backed API, and A4 PDF export.

## Architecture

Real backend, built to the suite's conventions:

- **Schema** — 8 tables in `prisma/schema.prisma` (`ca_reports`, `change_orders`,
  `rfi_logs`, `site_instructions`, `submittal_logs`, `delay_notices`,
  `progress_certifications`, `punch_list_items`) + enums. Self-contained
  (`projectId`/party fields are denormalised strings, no FKs to existing models)
  and portable across Aruba / Netherlands / Colombia / Curaçao / Bonaire / USA.
- **Data layer** — `lib/data/ca/*` Prisma-first repositories. Reads degrade
  gracefully to seed data (`lib/ca/seed-data.ts`) via `caRead()` when the DB is
  unreachable, so the UI works offline; writes have no fallback (they surface a
  503 so a write never silently no-ops).
- **API** — real Next route handlers under `app/api/construction-admin/*`
  (GET/POST/PATCH/DELETE) for change orders, RFIs, reports, certifications.
- **Calculations** — `lib/ca/calc.ts` (change-order compounded total, revised
  contract value, progress-payment/retention). Same functions drive the form
  preview, the API persistence, and the PDF.
- **i18n** — `lib/ca/i18n.ts`: English default with `nl` / `es` / `pap`
  scaffolding and the Dutch/Caribbean terminology (Meerwerk, Voortgangsverklaring,
  Opleverpunten, Termijnstaat …).
- **UI** — `app/(app)/construction-admin/*` (dashboard, change-order register/
  form/detail, RFI log/detail, report generator, progress certification,
  export center). PDF print pages under `app/print/construction-admin/*`
  (`@page { size: A4 }`, "Save as PDF").
- **Nav** — added to the sidebar ("Construction Admin") and the global New menu
  ("New change order").

## Going live (database)

The Supabase database was **paused/unreachable** when the module was built, so
migrations were not applied. The code is deploy-ready. Once the DB is restored:

```bash
# 1. Confirm connectivity
npx prisma migrate status        # should connect (no P1001)

# 2. Create the new tables from the schema (additive, non-destructive)
npx prisma db push

# 3. (optional) load the sample data used by the offline demo
npm install                      # ensures tsconfig-paths is present
npm run db:seed
```

Until then the screens render from `lib/ca/seed-data.ts` and any **create/edit**
returns a clear "Database unavailable — not saved" message.

## MVP delivered

Schema · CRUD APIs (change orders / RFIs / reports / certifications) · dashboard
widgets · change-order register + form (live totals) · RFI log + respond ·
weekly/bi-weekly/daily/monthly report generator · progress certification + bank
draw (live payment calc) · A4 PDF export · seed data.

## Phase 2 — delivered

Full registers (list + create form + detail with inline status workflow + real
Prisma API, seed fallback) for the three previously-stubbed entities:

- **Site Instructions** (`/construction-admin/site-instructions`) — A/E
  instructions to the contractor; Draft → Issued → Acknowledged → Closed, with
  cost/schedule impact levels and optional linked change order. Data layer
  `lib/data/ca/site-instructions.ts`, API `app/api/construction-admin/site-instructions/*`.
- **Submittals** (`/construction-admin/submittals`) — shop drawings / product
  data / samples; Required → Submitted → review disposition (Approved /
  Approved-as-noted / Revise-and-resubmit / Rejected) with reviewer comments.
  `lib/data/ca/submittals.ts`, API `…/submittals/*`. The dashboard's
  **Open Submittals** tile is now live (counts non-final dispositions).
- **Delay Notices** (`/construction-admin/delay-notices`) — notices of delay /
  EOT claims; claimed vs **approved days** determination, cost impact,
  Submitted → Under-review → Accepted/Rejected/Closed. `lib/data/ca/delay-notices.ts`,
  API `…/delay-notices/*`. (`delay_notices` has no currency column — amounts
  present in the org-wide **System Currency** from Settings → Practice.)

All three follow the RFI pattern (DTO in `lib/ca/types.ts`, label/tone maps in
`lib/ca/labels.ts`, badges, seed arrays in `lib/ca/seed-data.ts`, and prisma
`seed.ts` upserts) and are wired into `CaSubNav`.

## Roadmap (remaining)

- **Phase 2 (left)** — Word export; bank-draw workflow; photo upload; PDF print
  pages for the three new registers.
- **Phase 3** — BIM/Revit quantity links (placeholder columns exist on
  `change_orders`); digital signatures; email distribution; client portal; audit
  trail / versioning (a `version` column exists on the versioned documents).
