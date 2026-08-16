# Drawing intake — reading the title block

*Built 2026-08-16. This is step 2 of `01-FEASIBILITY.md` §12: `npm install unpdf`
and wire the reader into a server path. It also makes the register reachable
from the design module, and replaces the faux preview with the real file.*

---

## 1. What changed, in one paragraph

Intake read the FILENAME and nothing else. `extractDrawingMetadata` was called
with `{ filename }`, so a PDF's own title block — the thing the whole feature
exists to read — was never opened. It now is: the bytes are staged to storage,
the server reads page 1 with `unpdf`, narrows to the title-block region with
`selectTitleBlockText()`, and re-runs the extractor with
`{ filename, titleBlockText, pdfHadTextLayer }`. The proposal that comes back
replaces the filename guesses in the same confirmation form, with the same
confidence chips and evidence lines. **The confirmation step is unchanged.
Extraction proposes; the user confirms. Nothing was auto-accepted.**

## 2. Where the parse happens, and why the file uploads first

The order is now:

```
drop → validate → filename proposal (instant)
     → stage bytes to storage (signed PUT, straight from the browser)
     → server reads the object back and parses page 1
     → better proposal replaces the untouched fields
     → USER CONFIRMS
     → register row written
```

**The upload moved before the confirmation, and that is the load-bearing
decision here.** Three alternatives were considered:

| Option | Why not |
| --- | --- |
| Parse in the browser | `unpdf` is repackaged pdf.js — 1.5 MB of server chunk. Shipping that to a browser to read six strings would be the largest asset in the application, and `lib/drawings/pdf-text.ts` exists specifically to keep it out. |
| Post the bytes to a server action for parsing | A serverless function's request body is capped (4.5 MB on Vercel; this project sets 4 MB for Server Actions). The upload ceiling is 50 MB. It would fail on ordinary sheets. |
| Upload twice — once for parsing, once for keeping | Doubles the transfer of every drawing to save a design decision. |

So the bytes go to storage once, over the signed URL that already existed, and
the server reads them back with the service-role client. **The browser never
sends a drawing twice and never receives a service key.**

**Staging is not saving.** Nothing reaches the register until confirm; removing
a row deletes its staged object (`discardUpload`); `registerDrawing` still
re-checks that the object landed and still takes size and MIME from storage
rather than from the client.

**The cost, stated plainly:** a user who drops files and then closes the tab
leaves unreferenced objects in the bucket. They are invisible to the register
and cost storage. A periodic sweep of `projects/*/drawings/*` keys with no
matching `Drawing.storageKey` row is the fix; it is not written. **Decision for
the lead: whether to add that sweep before this ships widely.**

## 3. Failure is not an error

Every path that cannot read a title block degrades to the filename proposal and
says which one it was, in a line under the file name:

| Case | What the user sees | `audit.inputs.titleBlockText` |
| --- | --- | --- |
| PDF with a text layer | *"Read from the title block on page 1."* | `true` |
| PDF, title block not in the usual corners | *"Read from the whole page — no title block was found in the usual corners."* | `true` |
| **Scanned PDF** (no text layer) | *"No text layer — this is a scan. Only the filename could be read."* plus the existing OCR warning in the field list | `false` |
| PDF with text but nothing in the region | *"The PDF has text, but nothing was found in the title-block region."* | `false` |
| **DWG / DXF / RVT** | *"Filename only — a CAD file's contents cannot be read here."* No parse is attempted. | `false` |
| **Corrupt / encrypted / timed-out PDF** | *"The PDF could not be parsed (…) — only the filename was used."* | `false` |
| Storage unreachable | *"The file could not be read back for scanning…"* | `false` |

`readTitleBlock` never rejects, and `analyseDrawingAction` returns
`{ ok: false }` rather than throwing. The intake component treats a failed read
as a missing improvement, never as a failed upload — **a drawing that saves with
weaker metadata beats an upload that fails.**

`inputs.titleBlockText` is now true only when text was really read and fed to
the extractor. It used to be hard-coded `false`. That flag is what makes the
stored audit measurable later (feasibility doc §7), so it had to stop lying in
both directions.

Guards: `PDF_READ_TIMEOUT_MS` 15 s (a hung parse would otherwise hold a
serverless invocation until the platform kills it) and `PDF_PARSE_MAX_BYTES`
25 MB (the whole buffer must be resident to parse it; a bigger file is an issue
set, and reading page 1 of an issue set is not worth the memory).

## 4. Two interpreter fixes the first real PDF exposed

`lib/drawings/titleblock.ts` had been tested only against hand-authored fixture
text. The first real A1 sheet — plotted to PDF and read back through `unpdf` —
broke it in two ways, both of the worst kind: **a wrong value at high
confidence, which looks exactly like a right one.**

A title block is a GRID, and text extraction flattens it. Side-by-side boxes on
one row arrive as one line:

```
PROJECT              PROJECT NO.          ← headings row
Marina Heights Tower ZA-2026-121          ← values row
DRAWING TITLE        SCALE
Second Floor Plan    1:100
```

1. **A heading was read as a value.** `DRAWING TITLE SCALE` matched the
   `DRAWING TITLE` label and took `SCALE` as the drawing title — 88% confidence,
   completely wrong. The module already had a `looksLikeLabel()` guard for the
   next-line case; it now also applies to the same-line remainder, and it knows
   about headings the extractor does not itself target (`SCALE`, `DRAWN BY`,
   `STATUS`, `CLIENT`, …). Adding a heading to that list can only make the
   parser more cautious; it can never make it invent a value.
2. **The next column's value was glued onto a name.** `Marina Heights Tower
   ZA-2026-121` as a project name, `Second Floor Plan 1:100` as a title.
   `stripTrailingColumn()` removes a trailing scale ratio or a trailing token
   the project-number scanner positively recognises — never a token it cannot
   identify, and never if too little is left to be a name. The removal is stated
   in the evidence line rather than done silently.

**What was tried and reverted:** treating a whole ROW of headings
(`SHEET NUMBER REVISION DATE`) as "look at the line below". In a three-column
block the value rows are interleaved by baseline clustering, so "the line below"
fetched a date and filed it as a sheet number. Refusing to answer and letting
the blind scan find `A-204` on its own merits at 72% is the better failure. That
case is now a test.

**Known limitation, not fixed:** column flattening still means a value can carry
a neighbour's text when neither is recognisable. The user edits it in the form,
which is what the form is for. Fixing it properly means pairing labels to values
by x-position rather than by line, which is a change to `region.ts` and a
separate piece of work.

## 5. Measured on a real sheet

`scan001.pdf` — a deliberately unhelpful filename on an A1 sheet whose title
block reads *Marina Heights Tower / ZA-2026-121 / Second Floor Plan / A-204 /
Rev C / 2026-08-14*. Uploaded through `/drawings/intake` against a live bucket
and database.

| Field | Before (filename only) | After (title block) |
| --- | --- | --- |
| sheetNumber | *not found* | **A-204** · medium 72% |
| title | *not found* | **Second Floor Plan** · high 80% |
| discipline | *not found* | **ARCHITECTURAL** · medium 72% |
| projectNumber | *not found* | **ZA-2026-121** · medium 70% |
| projectName | *not found* | **Marina Heights Tower** · high 80% |
| issueDate | *not found* | **2026-08-14** · medium 76% |
| revision | *not found* | *not found* |

Six of seven, from nothing. **The revision miss is deliberate and documented**
(feasibility doc §2): the value is a bare `C` on a line with the sheet number,
and a lone trailing letter is as often a sheet-series suffix as a revision.
Writing a false revision into a register that decides what gets built from is
worse than leaving it blank.

The confidences are honest rather than flattering — most of these came from the
blind scan, at a discount, because the multi-column layout defeats the
label-anchored pass. That is the correct reading of the evidence.

## 6. Reachable from the design module

`lib/modules.ts` gave Module 1 a "Documents" section holding only the Document
Generator and Register. **The drawings bin was not in it, which is why the owner
believed it did not exist.**

- The section is now **"Drawings & Documents"** in Module 1 and Module 2, and
  holds `Drawings` (the register) and `Add Drawings` (the intake) ahead of the
  two document tools.
- `lib/nav.ts` — the full/Complete-AEC sidebar — grew a `Drawings & Documents`
  section of its own, taking Drawings and the new Add Drawings out of the tail
  of "Construction Administration" where they were easy to miss.
- Both navigations now import **the same two constants** (`DRAWINGS_REGISTER_ITEM`,
  `DRAWINGS_INTAKE_ITEM`, `DRAWINGS_AND_DOCUMENTS`) from `lib/nav.ts`, so they
  cannot drift apart. `modules.ts` already imports `nav.ts`, so the dependency
  runs the way it already ran.
- Module 3 (Estimates & Schedule) keeps its plain "Documents" section: it does
  not produce drawings. Module 4 reaches them through the shared `navSections`,
  so nothing appears twice.

## 7. A real preview, not a drawn imitation

`components/preview/document-preview.tsx` rendered a hand-drawn "CAD viewport"
with the file's own name in a fake title block. For a row that has bytes, it now
shows the document:

- **PDF** → the signed URL in an `<iframe>`. The browser's own PDF viewer does
  the rendering: nothing to ship, no worker to host, and it is the viewer the
  user already trusts for every other PDF.
- **DWG / DXF / RVT** → a plain statement that the browser cannot render the
  format, and a Download button. **Showing an architect an invented drawing
  labelled with their own sheet number is worse than showing them nothing.**

`PreviewDoc.file` is **a function, not a URL** — `getUrl()` is called when the
preview opens, mints a 5-minute signed URL through `drawingFileUrlAction`, and
is never stored on a row or embedded in the list. A URL held on a row either
expires (and is useless) or does not (and is a copy of the drawing handed out
with no further checks).

The component is shared. Callers that pass no `file` — the documents hub, forms,
templates — get exactly the behaviour they had, faux renderers and all. The one
visible change for them: the toolbar's Download button, which did nothing, is
now disabled with a title saying why.

## 8. A tenancy bug fixed on the way through

`getDrawingFileUrl` and `requireProject` used `prisma.findUnique` with a narrow
`select`. The tenant extension in `lib/db.ts` **cannot scope a `findUnique`** —
a unique `where` has no room for `companyId` — so it guards the returned ROW
instead. With `select: { storageKey: true }` there is no `companyId` on that row,
the guard compares `undefined` to the company id, and **every call returns null
for any signed-in user.** Preview, download and the whole intake path would have
failed in production while working locally.

Both now use `findFirst`, which the extension scopes by injecting `companyId`
into the WHERE clause, so the check runs whatever is selected.

**For the lead: this pattern is not unique to drawings.** `lib/data/clients.ts`,
`lib/data/estimates.ts` (twice) and `lib/data/schedule-db.ts` all call
`findUnique` on a tenant model with a narrow select. They were not touched —
they are outside this change — but each is either dead-returning or
unintentionally unscoped, and they should be looked at.

## 9. Bundle cost

`unpdf@1.8.1` — zero dependencies, 2.4 MB installed. Traced into the two
drawings routes only: **1.52 MB per route**, in one lazily-imported chunk
(`node_modules_unpdf_dist_pdfjs_mjs_*`). It does **not** appear in any client
bundle — `grep -rl getDocumentProxy .next/static` is empty — because the import
is dynamic and lives behind `import "server-only"`. No `serverExternalPackages`
entry was needed; Turbopack bundles it cleanly.

## 10. What is still not done

1. **No sweep for abandoned staged objects** (§2). The only new operational
   cost this change introduces.
2. **OCR is still absent**, by design. The `hasTextLayer: false` rate is now
   observable in `extractionAudit.inputs.titleBlockText`; decide on OCR from
   that number, not from a guess (feasibility doc §4).
3. **Auto-accept remains off.** Unchanged, and it should stay that way until
   `editedFields` has a month of real data behind it.
4. **Label-to-value pairing is still line-based**, not x-position based (§4).
5. **Multi-sheet PDFs** still read page 1 only. A 40-sheet issue set registers
   as one drawing with the first sheet's metadata. Splitting a set into sheets
   is a feature, not a bug fix.
