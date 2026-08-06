# Drawing intake — feasibility

**Question asked:** "drag and drop, and the system detects Sheet Number, Project Name, Dates and adds it in."

**Short answer:** the detection works, and works well, for PDFs that carry a text layer and for files that are named to any recognisable convention. It cannot work at all for scanned PDFs or for DWG in this stack, and those two cases are not edge cases — in most practices they are a third of the archive. The right product answer is therefore *extraction proposes, the user confirms*, not *the system adds it in*.

This document reports what was measured, not what is hoped for. Every number below comes from `npm test` over `lib/drawings/fixtures.ts`; the harness prints the tables on each run so this file cannot drift from the code unnoticed.

---

## 1. What exists today, verified

Before anything else, the starting position, because the request reads like an increment on an existing feature and it is not:

| Claim | Verified |
| --- | --- |
| `components/drawings/drawings-app.tsx` holds state in `useState` only | Yes — no persistence, no mutation, no server action. |
| `lib/data/drawings.ts` is a stub | Yes — a hard-coded array of 13 rows; its own header says a live version would map to `Attachment`. |
| `Attachment` exists with `filename`/`url`/`mimeType`/`sizeBytes` | Yes — `prisma/schema.prisma:532`, with nullable `projectId`. |
| Nothing in the codebase uploads a file | Confirmed. No Supabase Storage client, no upload route, no signed-URL code. The only `supabase` reference in `app/`, `lib/` or `components/` is `lib/server/license.ts`. |
| No PDF, DWG or OCR dependency | Confirmed. `node_modules` contains no `pdf*`, `unpdf`, `tesseract*`, `dxf*` or `dwg*` package — not even transitively. |

So the feature needs a data model, an object store, an upload path and an extraction engine. **This run built the extraction engine and the intake surface only.** No schema change, no migration, no bucket, no OCR, no DWG parsing.

---

## 2. What is detectable, what is best-effort, what is impossible

### Reliably detectable

| Field | Source | Why it is reliable |
| --- | --- | --- |
| **Sheet number** | Filename, or a labelled title block | Sheet numbers are the most rigidly conventional token in the industry: a discipline prefix from a closed set, then 2–4 digits. The pattern is narrow enough to be nearly unambiguous. 55/55 on the fixture set. |
| **Discipline** | Derived from the sheet prefix | Not inferred from the title, not guessed from the folder. It is a table lookup on a prefix already matched, so it is exactly as reliable as the sheet number and never more. |
| **Revision** | Keyword-anchored only (`Rev B`, `REV.02`, `Revision: C`) | When the word is present the value beside it is unambiguous. |
| **Issue date** | ISO, `DD-MM-YYYY`, `DD MMM YYYY`, `MMM DD YYYY`, compact `YYYYMMDD` | Dates validate against the calendar, so `2026-02-30` and `2026-13-01` return nothing instead of a silently normalised wrong date. |
| **Project number** | `XX-YYYY-NNN` style codes | Distinct enough in shape not to collide with sheet numbers. |

### Best-effort — useful, never authoritative

| Field | Why it is weak |
| --- | --- |
| **Sheet title** from a filename | It is whatever text is left after the structured tokens are removed. `A-101_Ground-Floor-Plan.pdf` yields a perfect title; `Copy of A-101 (2).pdf` yields "Copy of (2)", which is garbage that looks like a title. Scored 0.45 confidence at best, and the UI shows it as a proposal in an editable box. |
| **Project name** from a filename | Indistinguishable from the sheet title without a label. When no sheet number is found, the extractor says so in the evidence note rather than picking one. |
| **Bare revisions** (`... - S-301 - B - ...`) | A lone trailing letter is as often a sheet-series suffix as a revision. Deliberately **not** matched. This is the single miss in the adversarial set and it is the right miss: writing a false revision into a register that decides what gets built from is worse than leaving it blank. |
| **Ambiguous numeric dates** (`04-08-2026`) | Day-first per the brief, but `04/08` is equally `8 April` in a US-authored set. Read day-first, scored `medium` (0.60), evidence note reads "Ambiguous: could be MM-DD-YYYY". Never silently resolved. |

### Impossible in this stack

1. **Scanned PDFs.** A scan is a raster image in a PDF wrapper. There is no text to extract, so no amount of parsing helps. See §4.
2. **DWG.** See §5.
3. **RVT.** Revit files are a proprietary compound document. Same answer as DWG, more so.
4. **Text converted to outlines on plot.** Some offices plot with fonts converted to curves. Byte-identical problem to a scan, and undetectable from the outside except that the text layer comes back empty — which is exactly what `hasTextLayer: false` reports.
5. **Reading the *drawing* rather than the title block** — inferring a title from the geometry, detecting that a plan is a "Ground Floor Plan" because it has a ground floor in it. Not attempted, not feasible, not needed.

---

## 3. Measured accuracy

Two filename fixture sets, both in `lib/drawings/fixtures.ts`, scored by `lib/drawings/extraction.test.ts`.

**`expected: null` counts as a hit.** Correctly finding nothing is a success — a register needs blanks more than it needs guesses, and a parser scored only on recall will happily invent a sheet number for `DSC00123.pdf`.

### 3a. Designed set — 35 fixtures

Written to cover the conventions the brief names plus the ones this codebase already emits (`A-101`, `A101`, `ID-501`, `M-401`, `ZA-2026-121-A-101`, `Rev-B`, `Rev 02`, ISO / `DD-MM-YYYY` / `DD MMM YYYY` / `MMM DD YYYY` / compact dates), and including four cases that must find nothing.

| Field | Hit rate |
| --- | --- |
| sheetNumber | **100%** (35/35) |
| discipline | **100%** (35/35) |
| projectNumber | **100%** (35/35) |
| revision | **100%** (35/35) |
| issueDate | **100%** (35/35) |
| title | **100%** (35/35) |

**Read this number sceptically.** The same person wrote the fixtures and the rules, so it measures self-consistency. It is an upper bound: a firm with an enforced naming standard should see something close to it, and nobody else should expect it.

### 3b. Adversarial set — 20 fixtures

Written the other way round: messy names of the kind that actually accumulate on a project server — Windows copy suffixes, mixed case, tender wrappers, bare revisions, sheet ranges, `Ph2_`, `[SUPERSEDED]`, lock-file leftovers. `expected` is **what a competent human would type into the form**, not what the parser happens to produce. **The rules were not adjusted afterwards to make these pass.**

| Field | Hit rate | Misses |
| --- | --- | --- |
| sheetNumber | **100%** (20/20) | — |
| discipline | **100%** (20/20) | — |
| projectNumber | **100%** (20/20) | — |
| revision | **95%** (19/20) | `Emirates Hills Villa - Structural GA - S-301 - B - 05.03.2026.pdf` — bare `B`, deliberately not matched (§2). |
| issueDate | **100%** (20/20) | — |
| title | **80%** (16/20) | `Copy of A-101 (2).pdf` → "Copy of (2)"; `210 - Plans.pdf` → "210 Plans"; the Emirates Hills name keeps a stray "B"; `Ph2_A-101.pdf` → nothing, because "Ph2" has no three-letter alphabetic run. |

### 3c. Combined filename figure — 55 fixtures

| Field | Hit rate |
| --- | --- |
| sheetNumber | **100%** (55/55) |
| discipline | **100%** (55/55) |
| projectNumber | **100%** (55/55) |
| issueDate | **100%** (55/55) |
| revision | **98%** (54/55) |
| title | **93%** (51/55) |

### 3d. Title-block interpretation — 7 fixtures

| Field | Hit rate |
| --- | --- |
| sheetNumber / projectNumber / projectName / revision / issueDate / title | **100%** (7/7 each) |

**This number is the weakest claim in the document and must be read with its caveat.** No PDF library is installed, so these fixtures are hand-authored text in the shape pdf.js emits for a title block — US National CAD Standard same-line labels, a CAD export with the label above the value, an ISO 7200 all-caps block, a house sheet code the blind scanner would refuse, an unlabelled block, a page of general notes, and an empty text layer. **They measure the interpreter, not the pipeline.** The reader is the untested half, and the untested risk is text extraction quality, not interpretation — see §6.

### What the numbers do *not* cover

- No real PDF has been parsed end to end. Nothing in this run proves that pdf.js will return usable positioned text for a specific office's title-block template.
- The fixture set has no non-Latin filenames, no RTL text, and no multi-sheet PDF where the title block differs per page.
- Nothing here is a sample of the owner's actual files. §7 describes the mechanism to replace these numbers with real ones inside a month of production use.

---

## 4. Scanned PDFs — OCR is required and is not present

A scanned sheet is a JPEG in a PDF container. `pdf.js` returns zero text items. The extractor detects this explicitly rather than reporting a thin result: `PdfDocumentText.hasTextLayer` is false when fewer than 16 non-whitespace characters are found across the pages read, and `extractDrawingMetadata({ pdfHadTextLayer: false })` prepends the warning *"This PDF has no text layer — it is a scan or a plot with outlined text. Only the filename could be read; everything else needs OCR, which is not available."*

The distinction matters: **"we could not look" and "we looked and found nothing" have different fixes.**

### What adding OCR would cost

| Option | Shape | Cost | Verdict |
| --- | --- | --- | --- |
| `tesseract.js` in a serverless function | WASM, ~12 MB of core + language data, must be fetched or bundled | 5–30 s per full-size sheet, well past a Vercel serverless timeout on the default plan; accuracy on a 1:100 architectural title block at 200 dpi is poor without deskew and region cropping | Not viable as-is |
| `tesseract` native in a worker container | Real binary, a queue, a worker host | New infrastructure: a container host, a job queue, retry/observability. Weeks, not days | Viable, but it is a project |
| Hosted OCR (AWS Textract, Google Document AI, Azure Document Intelligence) | HTTP call with the page image | Roughly USD 1.50–50 per 1,000 pages depending on service and mode; needs a rasterisation step first (pdf.js render to canvas, or `pdftoppm`), which is exactly the piece a serverless runtime makes awkward | Best value if OCR is wanted |
| A vision LLM on the cropped title block | One image, one structured-output call | `@anthropic-ai/sdk` is **already a dependency**. Crop to the title-block region, send the crop, ask for the six fields as JSON. Accuracy on a legible title block is high and it degrades gracefully. Still needs rasterisation, and it costs a call per sheet | The pragmatic option here |

**Recommendation:** do not add OCR now. Ship the text-layer path, measure how many uploads actually come back `hasTextLayer: false`, and only then decide. If the answer turns out to be large, the vision-LLM route reuses a dependency that is already installed and skips the entire OCR-engine problem — but it changes this from a deterministic parser into a billed inference call per sheet, and that is a product decision, not a technical one.

---

## 5. DWG — needs native code, out of reach here

DWG is a closed, versioned binary format. Reading it means one of:

- **Autodesk RealDWG** — the official SDK. C++, per-seat commercial licensing, Windows/Linux native. Cannot run in a Node serverless function.
- **Open Design Alliance (ODA) Drawings SDK** — the credible third-party implementation. Also native, also a paid membership.
- **LibreDWG** — GPL, C, incomplete for recent DWG versions, and the GPL is a licensing problem for a commercial SaaS.
- A pure-JS DWG parser — **does not exist** in any state worth depending on. The JS ecosystem parses **DXF** (`dxf-parser`, `three-dxf`), which is a different, documented, text-based format.

There is no path from a Next.js serverless runtime to a parsed DWG.

### Realistic alternatives, best first

1. **Ask for a PDF.** Every issue set is already plotted to PDF; that is what gets shared, marked up and archived. Register the PDF and attach the DWG as the source file. This is not a workaround — it matches how drawings are actually issued.
2. **Accept DXF as well as DWG.** DXF is parseable in JavaScript and AutoCAD exports it natively. Only useful if the practice will export it, which most will not without a reason.
3. **Filename only for DWG.** What is implemented. The intake UI labels every non-PDF row *"filename only — the content cannot be read"*, so nobody assumes a DWG got the same treatment as a PDF. Given the measured filename accuracy this is genuinely useful, not a consolation prize.
4. **A conversion service.** Autodesk Platform Services (Model Derivative) will translate DWG→SVF/PDF and expose properties. Per-call cost, an OAuth integration, an async job model, and drawings leave the tenant boundary. Only worth it if DWG-native handling becomes a selling point.

`.rvt` gets the same treatment as `.dwg`, with less hope.

---

## 6. The PDF text reader — decision and justification

**Checked first: `pdfjs-dist` is not present, not even as a transitive dependency.** Nothing in `node_modules` matches `pdf*`. Adding PDF reading means adding a dependency.

### Evaluation

| Candidate | Server-side without a browser? | Positioned text? | Size | Verdict |
| --- | --- | --- | --- | --- |
| **`unpdf`** | Yes — ships a serverless build of pdf.js with no `canvas` and no worker file to host; runs in Node, Workers and edge | Yes — re-exports `getDocumentProxy`, so `getTextContent()` items with their transform matrices are available | ~1 MB installed, ~350 KB of it reachable; **server-only, never in the client bundle** | **Chosen** |
| `pdfjs-dist` (`legacy/build/pdf.mjs`) | Yes, but needs the legacy build, a worker path configured, and an optional `canvas` peer that pulls native deps if rendering is ever added | Yes | Larger install, more configuration surface | Fallback |
| `pdf-parse` | Yes | **No** — returns a flat string only | Small | **Rejected.** Without coordinates the title-block region cannot be isolated (§ below), and a whole-sheet string is mostly noise. |
| `pdf-lib` | Yes | No text extraction at all | Small | Rejected — wrong tool. |
| `pdf2json` | Yes | Yes | Medium | Rejected — thin maintenance, awkward output shape, no advantage over `unpdf`. |
| Headless Chrome / Puppeteer | Yes, but | Yes | ~300 MB Chromium | Rejected outright. The brief asked to prefer something that runs server-side without a headless browser, and it is right to. |

**Decision: `unpdf`, executed server-side only.**

**It has not been installed.** Deliberately, for two reasons:
1. The uncertain part of this feature is whether the six values can be *interpreted* out of a title block. That question is answered by pure code and 62 tests without any PDF library. Binding one in would have made the interesting half depend on megabytes of binary fixtures.
2. `package-lock.json` is shared state, and another agent is mid-migration in this tree. Rewriting the lockfile to satisfy an I/O leaf was not worth the collision risk.

So `lib/drawings/pdf-text.ts` ships the interface, a fake for tests, and a factory that takes the module as an injected loader. **Wiring the real reader is three lines at a server entry point:**

```ts
// npm install unpdf
import { createUnpdfReader, selectTitleBlockText, extractDrawingMetadata } from "@/lib/drawings";

const reader = createUnpdfReader(() => import("unpdf"));
const doc = await reader.read(new Uint8Array(await file.arrayBuffer()), { maxPages: 1 });
const draft = extractDrawingMetadata({
  filename: file.name,
  titleBlockText: doc.pages[0] ? selectTitleBlockText(doc.pages[0]).text : undefined,
  pdfHadTextLayer: doc.hasTextLayer,
});
```

The default export `unavailablePdfTextReader` **fails closed** with an error naming the fix, rather than returning empty text — because empty text is the signature of a scan, and conflating "no reader installed" with "this is a scan" would send someone down the OCR road for a missing `npm install`.

### Why the region step exists

A full-size sheet carries hundreds of text items: room numbers, dimensions, keynote legends, general notes. Feeding all of it to the interpreter buries the six values in noise — every room number on a plan is `\d{2,3}`-shaped. `selectTitleBlockText()` (pure, in `lib/drawings/region.ts`) keeps the union of the right-hand 32% strip and the bottom 18% strip, per ISO 7200 / NCS convention, falling back to the whole page when those come back nearly empty. It also reassembles items from PDF **draw order** into **reading order** by clustering baselines, which is what makes `LABEL: value` pairs land on one line for the interpreter to find. Both behaviours are unit-tested with a synthetic A1 sheet.

---

## 7. The UX contract: extraction proposes, the user confirms

**A drawing register with a wrong sheet number is worse than one with a blank sheet number.** A blank gets chased by whoever needs the sheet. A wrong one gets filed, indexed, searched, superseded against, transmitted, and eventually built from. The blank has a cost of minutes; the wrong one has a cost that surfaces on site.

Every measured field above is between 93% and 100%, which sounds like enough to auto-accept. It is not, for three reasons:

1. **Those rates are on fixtures, not on this firm's files.** Nothing here has touched a real project server.
2. **The failure mode is silent.** A wrongly extracted `A-101` looks exactly like a correctly extracted `A-101`. There is no visible defect to catch later.
3. **The confirmation step is cheap and the correction is not.** Glancing at six pre-filled fields costs a few seconds per sheet. Finding and repairing a mis-registered sheet three months later costs an order of magnitude more, and only after someone notices.

So `components/drawings/drawing-intake.tsx` implements:

- Every proposed value in an **editable control**, pre-filled, never read-only.
- A **confidence chip** per field — `high` / `medium` / `low` with the percentage — so attention goes where it is needed instead of being spread evenly.
- An **evidence line** per field quoting the exact fragment that matched and any caveat: *from "04-08-2026" — Ambiguous: could be MM-DD-YYYY*. The user can check the machine's working rather than trusting it.
- **Alternates surfaced**, not hidden: *"also saw E-102"*.
- **Warnings** for conflicts — two sheet numbers in one filename, two dates, a filename that disagrees with the title block.
- A **required sheet number**: confirm is disabled until every row has one. Blank is allowed *before* saving, never *at* saving.
- Fields marked **`edited`** once changed, and the edit recorded in the audit payload.

That last point is the mechanism that replaces the fixture numbers with real ones. `DrawingExtractionAudit` stores what was proposed alongside what was saved; **the per-field edit rate in production *is* the per-field error rate.** One JSON column buys a measured accuracy figure on the owner's own files instead of a guess. Only once that figure exists, per field, should auto-accept be considered — and then only for the fields that earn it (sheet number and discipline first; title, probably never).

---

## 8. Upload validation — the limits chosen and why

Implemented in `lib/drawings/upload-policy.ts`, pure and unit-tested.

| Limit | Value | Reasoning |
| --- | --- | --- |
| Max file size | **100 MiB** | A PDF sheet is 1–10 MB, a multi-sheet issue set 20–60 MB, a DWG with xrefs bound 30–80 MB. Clears real work with headroom; still stops a mis-dropped Revit central model or a video. |
| Max files per drop | **25** | A discipline issue is typically 10–40 sheets. 25 is a batch a person can genuinely review one at a time, which is the entire point of §7. |
| Min file size | **1 byte** | A zero-byte file is a failed copy, not an upload. |
| Max filename length | **255 characters** | The practical filesystem ceiling and the Supabase Storage object-key ceiling. |
| Accepted extensions | **`.pdf`, `.dwg`, `.dxf`, `.rvt`** | An allowlist. Everything else is refused by default. |
| Accepted MIME types | `application/pdf` and variants for PDF; the CAD set plus `application/octet-stream` and empty for the rest | Browsers and operating systems do not agree on a MIME type for DWG/DXF/RVT, so the extension is authoritative and MIME is used only to *reject* an obvious mismatch — a `.pdf` the browser reports as `text/html`. |
| Executables | Rejected on **any** extension segment | The allowlist already stops `A-101.pdf.exe`. The extra check exists for `A-101.exe.pdf`, where the last segment is fine and an earlier one is not. Denylist covers 40 extensions (`exe bat cmd com scr pif msi dll ps1 vbs js jar sh app apk lnk reg …`). |
| Path separators, control characters | Rejected | Storage-key hygiene. |

**Not done client-side, on purpose:** content sniffing (does the file actually begin `%PDF-`). That needs the bytes and belongs on the server at the point of upload. **A client-side limit is a courtesy, not a control** — every one of these must be re-enforced when `createUploadTicket` is implemented.

---

## 9. Recommended storage shape (not created this run)

No bucket was created and no Supabase Storage code was written. The recommendation:

**Bucket:** `drawings` — **private**, not public. Drawings are client-confidential, and a public bucket URL is forever.

**Object key:** `projects/<projectId>/drawings/<drawingId>/<revision>/<sanitised-filename>` — project-scoped so an RLS policy can be written as a prefix match; revision-scoped so superseding never overwrites, which matters when someone needs to prove what was issued on a date.

**Policies:** no anonymous access at all. Reads and writes go through signed URLs minted server-side after the session's project membership is checked. The bucket policy is the second line of defence, not the first.

**Upload flow:**
1. Client calls a server action with `{ projectId, filename, mimeType, sizeBytes }`.
2. Server re-validates against §8 — **re-validates, does not trust** — checks project membership, generates the key, mints a short-lived signed upload URL (5 minutes is plenty).
3. Client `PUT`s the bytes directly to storage. They never traverse the Next.js server, which is what keeps a 60 MB drawing away from a serverless function's request-body limit.
4. Client calls `registerDrawing` with the storage key and the **confirmed** metadata.
5. Reads are served as short-lived signed download URLs generated per request, never stored on the row.

**Size cap belongs in the bucket configuration too**, so a forged direct upload cannot exceed it.

---

## 10. The persistence interface (defined, not implemented)

`lib/drawings/persistence.ts`. Types only — this run does not own `prisma/schema.prisma`.

```ts
interface DrawingIntakeRepository {
  createUploadTicket(input: {
    projectId: string; filename: string; mimeType: string; sizeBytes: number;
  }): Promise<UploadTicket>;                       // { uploadUrl, storageKey, expiresAt, headers? }

  registerDrawing(input: RegisterDrawingInput): Promise<{ id: string }>;
  //   { projectId, file: StoredFileRef, metadata: ConfirmedDrawingMetadata,
  //     audit: DrawingExtractionAudit, supersedes?: string }

  findSheets(projectId: string, sheetNumber: string): Promise<ExistingSheet[]>;
  //   newest revision first — so intake can offer "supersede revision B?"
  //   instead of silently creating a duplicate
}
```

`notConfiguredRepository` implements every method as a rejection with an actionable message, and is what the UI holds today. The component renders *"Storage is not connected yet — confirming hands the values to this page without saving"* rather than a dead button.

### What the next run needs from the schema

Minimum viable, on top of the existing `Attachment`:

- A `Drawing` model — `projectId`, `sheetNumber`, `title`, `discipline`, `revision`, `issueDate`, `status`, `attachmentId`, `supersededById`.
- `@@unique([projectId, sheetNumber, revision])` — the constraint that makes `findSheets` meaningful and makes double-uploading a revision an error rather than a silent duplicate.
- An `extractionAudit Json?` column carrying `DrawingExtractionAudit`. Cheap, and it is the only route to a measured accuracy figure on real files (§7).
- `Attachment` already has `projectId`, `filename`, `mimeType`, `sizeBytes` and `url`; `url` holds the storage key, not a public URL.

One mapping wart to fix while there: `lib/drawings/mapping.ts` narrows the eleven sheet disciplines onto the six-value `Discipline` union in `lib/data/drawings.ts`. M/E/P collapse to `MEP` legitimately, but `CIVIL`, `LANDSCAPE` and `GENERAL` have no faithful destination and are currently mapped to the nearest truthful bucket. They are listed in `LOSSY_DISCIPLINES` so they are easy to find.

---

## 11. Files delivered

**Library — `lib/drawings/` (pure, except `pdf-text.ts`)**

| File | Role |
| --- | --- |
| `types.ts` | `Field<T>`, `Evidence`, confidence bands, `DrawingMetadataDraft` |
| `primitives.ts` | Sheet-number / project-number / revision / date scanners |
| `filename.ts` | Filename → draft, with documented supported and unsupported forms |
| `titleblock.ts` | Title-block text → draft; label-anchored pass then blind scan |
| `merge.ts` | Cross-source agreement, disagreement and demotion rules |
| `region.ts` | Title-block region selection and draw-order → reading-order layout |
| `pdf-text.ts` | The only impure module: `PdfTextReader` interface, `unpdf` factory, stub, fail-closed default |
| `upload-policy.ts` | Validation limits (§8) |
| `persistence.ts` | The seam (§10) |
| `mapping.ts` | Sheet discipline → stored `Discipline` |
| `fixtures.ts` | 35 designed + 20 adversarial filenames, 7 title blocks |
| `index.ts` | Public API — `extractDrawingMetadata()` |
| `extraction.test.ts`, `intake.test.ts` | 64 tests including the accuracy harness |

**UI — `components/drawings/drawing-intake.tsx`.** Drop zone plus a real focusable file input, per-file confirmation form, confidence chips, evidence lines, warnings, `aria-live` results, theme tokens only, persistence behind the interface.

Existing drawings components were not modified. Nothing outside `lib/drawings/`, `components/drawings/`, `docs/drawings-intake/` and two named lines in `vitest.config.ts` was touched.

---

## 12. Recommended next steps, in order

1. **Schema + storage.** `Drawing` model, `drawings` bucket, signed-URL flow, `DrawingIntakeRepository` implementation. Unblocks everything else.
2. **`npm install unpdf`** and wire the three lines in §6 into a server action. Do this *after* step 1 so the intake path is end-to-end in one release.
3. **Ship, and watch `editedFields`.** After a month there is a real per-field error rate on real files. Only then revisit auto-accept.
4. **Decide on scans** using the observed `hasTextLayer: false` rate, not a guess (§4).
5. **Leave DWG alone** unless a customer pays for it (§5).
