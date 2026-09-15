# Building Permit Module — Specification (Release A)

Module 1 (Architecture & Engineering Design). Additive and self-contained: it must
not touch the protected Estimates or Schedule systems (docs/protected-systems.md),
and it must not touch the existing `PermitTask` model, which belongs to the Land
Development module and answers a different question (an entitlement checklist on a
development project, not an authority case file).

## 1. What it is for

An architect runs a building permit as a *case file* that lives for months: a
request number issued by the authority, a submission date, resubmissions, meetings
whose minutes matter later, a concept approval that arrives before the real one,
and letters from Public Works that start a clock. Today that lives in a folder on
someone's desktop. This module is the record of it.

The unit of work is **one permit application for one property**. Everything else
hangs off it.

## 2. Data model

All models are company-owned. Every one of them MUST be added to `TENANT_MODELS`
in `lib/db.ts` — a model left out of that set is a cross-tenant data leak, and a
test asserts the set matches the schema.

### BuildingPermit
The case file.

| field | type | notes |
|---|---|---|
| id | String @id @default(cuid()) | |
| companyId | String? | tenant scope |
| reference | String | our internal reference, auto `BP-YYYY-NNN`, unique per company |
| permitNumber | String? | **the authority's Building Permit request number** |
| title | String | |
| permitType | BuildingPermitType | |
| status | BuildingPermitStatus | |
| projectId | String? | optional relation to Project |
| projectName | String? | denormalised label, as DesignDeliverable does |
| clientId | String? | |
| applicantName | String? | who the application is filed in the name of |
| siteAddress | String? | |
| parcelNumber | String? | "meetbrief" / cadastral number |
| landRegistry | String? | |
| authority | String? | default from settings, e.g. DOW / Public Works |
| authorityContact | String? | |
| description | String? | scope of works |
| lotAreaM2 / builtAreaM2 | Decimal? | |
| estimatedValue | Decimal? | + `currency String @default("AWG")` |
| submittedAt | DateTime? | **date it was submitted** |
| acknowledgedAt | DateTime? | authority confirmed receipt |
| conceptApprovalAt | DateTime? | **concept approval date** |
| conceptApprovalRef | String? | |
| decisionAt | DateTime? | final decision |
| issuedAt | DateTime? | permit issued |
| expiresAt | DateTime? | permit validity horizon |
| targetDecisionAt | DateTime? | what we told the client |
| feeAmount | Decimal? | + feePaidAt DateTime? |
| responsibleId | String? | User |
| notes | String? | |
| createdByName, createdAt, updatedAt | | |

Indexes: `@@index([companyId, status])`, `@@index([companyId, projectId])`,
`@@unique([companyId, reference])`.

### BuildingPermitSubmission
One row per trip to the counter. A resubmission is the normal case, not the
exception, so it is a list and not a field.

`id, permitId, sequence Int, submittedAt DateTime, method BuildingPermitSubmissionMethod,
receivedBy String?, receiptNumber String?, contents String?, notes String?, createdAt`

### BuildingPermitMeeting
`id, permitId, heldAt DateTime, subject String, location String?, attendees String?,
minutes String? (long text), decisions String?, followUp String?, createdByName, createdAt, updatedAt`

Distinct from the app's `MeetingMinute` model on purpose: those are client meetings
in Business Development; these are permit-file minutes that must not leak into the
client meeting register.

### BuildingPermitCorrespondence
Letters — the ones from Public Works above all.

`id, permitId, direction BuildingPermitCorrespondenceDirection (INCOMING|OUTGOING),
letterRef String?, party String? (who wrote/received it), subject String,
letterDate DateTime?, receivedAt DateTime?, summary String?, requiresResponse Boolean,
responseDueAt DateTime?, respondedAt DateTime?, createdAt, updatedAt`

An incoming letter with `requiresResponse` and an unmet `responseDueAt` is what the
list view flags red. That flag is the reason this module exists.

### BuildingPermitApproval
Staged approvals, because concept approval is a first-class event.

`id, permitId, stage BuildingPermitApprovalStage (CONCEPT|TECHNICAL|ZONING|FIRE|HEALTH|FINAL|OTHER),
status BuildingPermitApprovalStatus (PENDING|APPROVED|APPROVED_WITH_CONDITIONS|REJECTED|WITHDRAWN),
decidedAt DateTime?, refNumber String?, validUntil DateTime?, conditions String?, notes String?, createdAt, updatedAt`

### BuildingPermitDocument
`id, permitId, name String, category BuildingPermitDocumentCategory
(APPLICATION_FORM|DRAWING|CALCULATION|LETTER|MINUTES|APPROVAL|PHOTO|RECEIPT|OTHER),
storagePath String?, externalUrl String?, mimeType String?, sizeBytes Int?,
documentDate DateTime?, uploadedByName String?, notes String?, createdAt`

Uploads reuse the drawings-intake storage path exactly (private Supabase bucket,
plain fetch, no SDK) — see docs/drawings-intake. Either `storagePath` or
`externalUrl` is set; a row with neither is a bug.

### Enums
```
BuildingPermitType      NEW_BUILD RENOVATION EXTENSION DEMOLITION CHANGE_OF_USE
                        FENCE_WALL POOL SIGNAGE TEMPORARY SPLIT_PARCEL OTHER
BuildingPermitStatus    DRAFT PREPARING SUBMITTED IN_REVIEW INFO_REQUESTED
                        CONCEPT_APPROVED RESUBMITTED APPROVED APPROVED_WITH_CONDITIONS
                        REJECTED WITHDRAWN ISSUED EXPIRED
BuildingPermitSubmissionMethod  COUNTER EMAIL PORTAL COURIER OTHER
```

## 3. Routes

App (all under Module 1):
- `/design/building-permits` — register (list, filters, search)
- `/design/building-permits/new`
- `/design/building-permits/[id]` — the case file
- `/design/building-permits/[id]/edit`
- `/design/building-permits/file/[documentId]` — opens a stored document (a
  letter's PDF): tenant-scoped lookup, then a 302 to a five-minute signed URL

### The register's columns (owner request, 15 Sep 2026)

In this order, all dates military style (`15 SEP 2026`, `militaryDate` in
`lib/building-permits/register.ts`):

| column | source |
|---|---|
| Building permit # | `permitNumber` (the authority's); our `reference` beneath; "Not yet issued" while null |
| Version # | `permitVersion`: V1 = first submission, +1 per resubmission; the current version's date beneath |
| Submittal date | `submittedAt`, the FIRST submission. Logging V1 fills it in when blank; a resubmission never moves it |
| Correspondence | every letter, newest first: direction arrow, date, ref, one click to its PDF; overdue-reply badge on top; `+N more` links to the case file |
| Lapsed (months) | `lapsedMonths`: calendar months to one decimal, submittal date to permit ready date, or to today while `running` |
| Permit ready date | `issuedAt`; "Target …" from `targetDecisionAt` while not ready |

A letter's PDF is a `BuildingPermitDocument` with `correspondenceId` set
(category LETTER), stored in the private bucket under
`permits/<permitId>/letters/<uploadId>/<file>.pdf`, PDF only, 25 MB max
(`lib/building-permits/letter-file.ts`). Deleting a letter deletes its stored PDF.

Tables are created by `prisma/sql/0014_building_permits.sql` (RLS enabled, per 0012).

Not built yet: the print routes below, email send (§6), and add/edit screens for
meetings, approvals and loose documents (the data layer and actions exist).

Print (A4, both orientations):
- `/print/design/building-permits` — **the list**, `?orientation=portrait|landscape`
  plus the active filters, so what prints is what is on screen
- `/print/design/building-permits/[id]` — the permit file sheet

## 4. UI requirements (explicit owner requests)

- **Zebra rows** on every table: `even:bg-surface-2/40`, the pattern already used
  in `components/development/permit-tracker.tsx` and the construction-admin logs.
- **Shadow bands**: grouped bands (by status, or by month of submission) carry a
  soft elevation so the eye finds the group edge without a hard rule.
- Status pills follow the existing badge vocabulary (`components/ui/badge.tsx`),
  never a new colour system.
- Overdue response = red, the same red the permit tracker already uses.

## 5. Print / preview

Reuse the unified print system (`components/print/print-surface.tsx`,
`lib/documents/sheet-geometry.ts`) — do NOT hand-roll @page CSS. The list print
must:
- offer A4 **portrait and landscape** from the preview toolbar,
- drop columns that cannot fit and say so, the way estimates already warns,
- repeat the table header on every sheet,
- keep the firm identity header/footer boxes shared with the other documents.

## 6. Email

Send the register (or one permit file) by email using the existing send path and
record it in `EmailLog` — the same helper the estimates/proposals send uses. No
second mail transport. A send that fails must say so; never report success for a
message that was not accepted.

## 7. Out of scope for Release A

Automatic reminders/notifications, authority-portal integration, per-condition
sign-off workflow, permit fee invoicing.
