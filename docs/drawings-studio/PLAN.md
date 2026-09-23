# Drawing Studio — plan

Upload a set of plans, have the system read what they are, then review, mark up
and redline them as a team without leaving the app.

This is the plan for that. It is written in stages that each ship on their own,
because a half-built review tool is worse than none — people put their comments
somewhere else and never come back.

---

## Where this starts from (23 SEP 2026)

| Already built | State |
| --- | --- |
| `Drawing` table + private Supabase bucket, signed URLs | Live in production |
| Intake: upload, read the title block, propose metadata, confirm | Live; 7 fixtures, 100% on six fields |
| Register `/drawings`, project-keyed | Live |
| `/drawings/annotate` | **A toy.** A sketchpad over an uploaded image; nothing is stored and nothing is attached to a drawing row |
| `/projects/[id]/drawings` | **A placeholder card** that bounces to the global register |
| `/design/architecture` | Deliverables only — no drawings |

Two facts shape everything below:

1. **The PDF reader already reports page geometry** (`width`/`height` in points,
   `lib/drawings/pdf-text.ts`) and nothing reads it. Paper size is therefore a
   pure function away, not a research project.
2. **The Supabase Data API is locked out** (`prisma/sql/0012`), deliberately.
   That rules out Supabase Realtime for live cursors, because Realtime
   authenticates as `anon`. Collaboration in stages 2–3 is therefore
   *asynchronous* — everyone sees everyone's markup, nobody sees a moving
   cursor. Live presence is a separate decision with a security cost attached,
   written up in §Realtime below, and it is not in this plan.

---

## Stages

### DS-0 — Know what was uploaded ✅ shipped

The system reads, from the file itself:

- **Plot paper size** — A0…A4, ANSI A…E, ARCH A…E, or "custom", with
  orientation, from the page geometry. Millimetres, not guesses.
- **Page number** — which sheet of how many, for a multi-sheet PDF, plus the
  sheet number off the title block (already built).
- **Type of drawing** — floor plan, site plan, section, elevation, detail,
  schedule, RCP, and the rest, from the sheet title, the sheet number and the
  title-block text. English, Dutch and Spanish keywords, because the practice
  is in Aruba and receives all three.
- **AI as the tie-break, never the first move.** The deterministic classifier
  runs first and is what the accuracy harness measures. Claude is asked only
  when the rules come back low-confidence, only with the title-block text, and
  a failure or a missing key costs nothing — the rules' answer stands.

### DS-1 — A real viewer ✅ shipped

The stored PDF, rendered: page navigation, zoom, fit-to-width, rotate, and a
sheet thumbnail rail for a multi-sheet set. Signed URL per open, never a public
object.

### DS-2 — Markup and redline ✅ shipped

Vector markup stored per drawing and per page, never burned into the source
PDF — the original is evidence and stays untouched.

Tools: freehand, line, arrow, rectangle, ellipse, **revision cloud**, text,
callout with leader, highlight, measurement (calibrated against a known
dimension), and stamps (`FOR REVIEW`, `APPROVED`, `REVISE AND RESUBMIT`,
`AS BUILT`). Per-author colour, per-author layer, show/hide by author.

### DS-3 — Review and collaboration ✅ shipped, except revision compare

- Comment threads **pinned to a point on a sheet**, with replies, @mentions,
  assignment, and resolve/reopen.
- Review rounds on top of the existing `DRAFT → ISSUED → SUPERSEDED` states:
  send for review, comment, issue back.
- **Revision compare** — this revision over the last one, a difference
  highlight, so a reviewer sees what moved instead of hunting for it.
- An activity trail per sheet, and an email when somebody is assigned or
  mentioned (the app already sends through Resend).

### DS-4 — Issue it *(next)*

Flatten the markup onto a copy of the PDF for transmittal, keeping the original
object untouched. A markup register per sheet, printed in the house style, and
the existing transmittal gains a "with comments" variant.

### DS-5 — Put it where the work is ✅ shipped

- `/projects/[id]/drawings` becomes the project's real drawing set.
- `/design/architecture` gains a drawings area beside its deliverables, so an
  architectural project shows what was promised and what has actually landed.

---

## Decisions taken up front

**The source PDF is immutable.** Every markup, comment and stamp is a row
pointing at it. Flattening produces a NEW object. A practice that cannot
produce the file it was sent, unaltered, has lost the argument before it starts.

**Markup geometry is stored in PDF user space** — points, origin bottom-left,
per page — not in screen pixels. Screen coordinates are a function of zoom and
device pixel ratio, and a comment that lands three metres from where it was
made is worse than no comment.

**Nothing is rendered client-side from the bucket without a signed URL**, and
the TTL stays at 5 minutes (`DOWNLOAD_URL_TTL_SECONDS`).

**Every new table is tenant-scoped** (`TENANT_MODELS` in `lib/db.ts`) and ships
with `ENABLE ROW LEVEL SECURITY`, per `prisma/sql/0012`.

**Confidence and evidence travel with every detected value**, the contract
`lib/drawings/types.ts` already sets: no API in this module hands back a bare
string, because the register has to be able to show a user *why* a value was
proposed before they accept it.

## Realtime, and why it is not here

Live cursors and instant markup would need Supabase Realtime, which
authenticates as `anon` — the role `0012` deliberately stripped of every grant
after the Data API audit. Turning it back on for one feature would reopen the
hole that audit closed, so live presence needs its own design (a scoped
Realtime-only role, or a server-side broadcast channel) and its own review. The
stages above are built so that adding presence later changes the transport, not
the data model.

## Not in scope

DWG/DXF/RVT rendering (no browser parser worth depending on — see
`docs/drawings-intake/01-FEASIBILITY.md` §5), OCR for scanned sheets, automatic
sheet-set splitting of a bound PDF into separate rows (DS-0 reports the page
count and reads page 1; splitting is DS-1's job), and clash detection.

---

## What shipped, and what is still open (23 SEP 2026)

Shipped: DS-0, DS-1, DS-2, DS-5, and DS-3 except revision compare. Verified in a
real browser against a local Postgres and a stand-in storage server: an A1 sheet
rendered from its PDF, a revision cloud and a freehand redline drawn with the
pointer, both still on the same rooms after a reload and after the view was
fitted from 100% to 37%, a comment pinned to a point and resolved, and the
intake screen reading `A-101`, `Ground Floor Plan`, `A1 landscape` and
`FLOOR_PLAN` off the file.

Still open:

- **DS-4**: flattening markup onto a copy for issue, and a printed markup
  register.
- **Revision compare** (DS-3's last piece).
- **Email on assignment or mention** — the app already sends through Resend;
  the studio does not call it yet.
- **A pre-existing 500 on `/drawings/intake`**, reproduced on `main` with none
  of this work applied: the shell's sidebar calls `useSession` during the
  server render of that one route and the document returns 500 before React
  recovers on the client. The page works; the status code and the logged error
  do not. Worth its own fix.
