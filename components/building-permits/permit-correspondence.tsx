"use client";

/**
 * Letters on a permit file, each carrying its PDF.
 *
 * Attaching a PDF is the drawing-intake path: ask the server for a signed upload
 * URL, PUT the bytes straight to the private bucket, then save the letter with
 * the key the server issued. The bytes never pass through a server action (4.5 MB
 * body limit), and the browser never names the object.
 *
 * WHY `onChanged` AND NOT `router.refresh()`. A refresh after the write did not
 * reliably repaint this page: the letter was in the database and the screen kept
 * the old list until a reload, which reads as a failed save. The parent re-reads
 * the case file instead — see the note in permit-case-file.tsx.
 */

import { useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { ResponseDueBadge } from "@/components/building-permits/badges";
import { validateLetterPdf } from "@/lib/building-permits/letter-file";
import { militaryDate } from "@/lib/building-permits/register";
import {
  CORRESPONDENCE_DIRECTIONS,
  CORRESPONDENCE_DIRECTION_LABEL,
  type BuildingPermitCorrespondenceDTO,
  type BuildingPermitCorrespondenceDirection,
} from "@/lib/building-permits/types";
import {
  addCorrespondenceAction,
  attachLetterPdfAction,
  createLetterUploadTicketAction,
  deleteCorrespondenceAction,
} from "@/app/(app)/design/building-permits/actions";

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

/** Upload one PDF for this permit; resolves to what the save action needs. */
async function uploadLetterPdf(
  permitId: string,
  file: File,
): Promise<{ storageKey: string; filename: string }> {
  const verdict = validateLetterPdf({ name: file.name, size: file.size, type: file.type });
  if (!verdict.ok) throw new Error(verdict.message);
  const res = await createLetterUploadTicketAction(permitId, {
    filename: file.name,
    mimeType: file.type || "application/pdf",
    sizeBytes: file.size,
  });
  if (!res.ok) throw new Error(res.error);
  const put = await fetch(res.ticket.uploadUrl, {
    method: "PUT",
    headers: res.ticket.headers,
    body: file,
  });
  if (!put.ok) throw new Error(`Storage refused the upload (${put.status}). Try again.`);
  return { storageKey: res.ticket.storageKey, filename: file.name };
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function PermitCorrespondence({
  permitId,
  letters,
  today,
  onChanged,
}: {
  permitId: string;
  letters: BuildingPermitCorrespondenceDTO[];
  today: string;
  /** Re-read the case file. See the note in permit-case-file.tsx. */
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [direction, setDirection] = useState<BuildingPermitCorrespondenceDirection>("INCOMING");
  const [letterDate, setLetterDate] = useState(today);
  const [letterRef, setLetterRef] = useState("");
  const [party, setParty] = useState("");
  const [subject, setSubject] = useState("");
  const [requiresResponse, setRequiresResponse] = useState(false);
  const [responseDueAt, setResponseDueAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setLetterRef("");
    setParty("");
    setSubject("");
    setRequiresResponse(false);
    setResponseDueAt("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    void (async () => {
      try {
        await fetch("/favicon.ico", { cache: "no-store" }); // TEMP experiment
        const pdf = file ? await uploadLetterPdf(permitId, file) : null;
        const res = await addCorrespondenceAction(
          permitId,
          {
            direction,
            letterDate: letterDate || null,
            receivedAt: direction === "INCOMING" ? letterDate || null : null,
            letterRef: letterRef || null,
            party: party || null,
            subject,
            requiresResponse,
            responseDueAt: requiresResponse ? responseDueAt || null : null,
          },
          pdf,
        );
        if (!res.ok) {
          setError(res.error);
          return;
        }
        reset();
        setOpen(false);
        await onChanged();
      } catch (err) {
        setError(errorText(err, "The letter was not saved."));
      } finally {
        setPending(false);
      }
    })();
  }

  function attach(letterId: string, picked: File | undefined) {
    if (!picked) return;
    setError(null);
    setBusyId(letterId);
    setPending(true);
    void (async () => {
      try {
        const pdf = await uploadLetterPdf(permitId, picked);
        const res = await attachLetterPdfAction(letterId, pdf);
        if (!res.ok) setError(res.error);
        await onChanged();
      } catch (err) {
        setError(errorText(err, "The PDF was not attached."));
      } finally {
        setBusyId(null);
        setPending(false);
      }
    })();
  }

  function remove(id: string) {
    setError(null);
    setPending(true);
    void (async () => {
      const res = await deleteCorrespondenceAction(permitId, id);
      if (!res.ok) setError(res.error);
      setConfirmId(null);
      await onChanged();
      setPending(false);
    })();
  }

  return (
    <div className="space-y-3">
      {letters.length === 0 ? (
        <p className="text-sm text-muted">No letters on this file yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 pb-1.5 font-medium">Date</th>
                <th className="px-3 pb-1.5 font-medium">Ref.</th>
                <th className="px-3 pb-1.5 font-medium">Subject</th>
                <th className="px-3 pb-1.5 font-medium">Reply</th>
                <th className="px-3 pb-1.5 font-medium">PDF</th>
                <th className="px-3 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {letters.map((l) => {
                const Direction = l.direction === "INCOMING" ? ArrowDownLeft : ArrowUpRight;
                return (
                  <tr key={l.id} className="border-t border-border/60 align-top even:bg-surface-2/40">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Direction
                          className={`h-3.5 w-3.5 ${l.direction === "INCOMING" ? "text-violet-600" : "text-faint"}`}
                          aria-label={CORRESPONDENCE_DIRECTION_LABEL[l.direction]}
                        />
                        {militaryDate(l.letterDate ?? l.receivedAt)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{l.letterRef ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-fg">{l.subject}</div>
                      {l.party ? <div className="text-[11px] text-faint">{l.party}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      {l.respondedAt ? (
                        <span className="font-mono text-xs text-muted">Answered {militaryDate(l.respondedAt)}</span>
                      ) : l.requiresResponse ? (
                        <ResponseDueBadge dueAt={l.responseDueAt} today={today} />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.pdf ? (
                        <a
                          href={`/design/building-permits/file/${l.pdf.documentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-fg hover:text-brand hover:underline"
                          title={l.pdf.filename ?? "Open PDF"}
                        >
                          <FileText className="h-4 w-4 text-red-600" /> Open PDF
                        </a>
                      ) : (
                        <label
                          className={`inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-brand hover:underline ${
                            busyId === l.id ? "pointer-events-none opacity-60" : ""
                          }`}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {busyId === l.id ? "Uploading…" : "Attach PDF"}
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="sr-only"
                            onChange={(e) => attach(l.id, e.target.files?.[0])}
                          />
                        </label>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {confirmId === l.id ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => remove(l.id)}
                            className="font-medium text-red-600 hover:underline"
                          >
                            Delete letter{l.pdf ? " + PDF" : ""}
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="text-muted hover:underline">
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(l.id)}
                          aria-label="Delete letter"
                          className="text-faint transition-colors hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <form onSubmit={add} className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-3 sm:grid-cols-4">
          <div>
            <label className={label}>Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as BuildingPermitCorrespondenceDirection)}
              className={field}
            >
              {CORRESPONDENCE_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {CORRESPONDENCE_DIRECTION_LABEL[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Letter date</label>
            <input type="date" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Letter ref.</label>
            <input value={letterRef} onChange={(e) => setLetterRef(e.target.value)} className={`${field} font-mono`} />
          </div>
          <div>
            <label className={label}>{direction === "INCOMING" ? "From" : "To"}</label>
            <input
              value={party}
              onChange={(e) => setParty(e.target.value)}
              placeholder="e.g. DOW / Public Works"
              className={field}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Subject</label>
            <input required value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Letter (PDF)</label>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:text-sm file:font-medium file:text-fg"
            />
          </div>
          {direction === "INCOMING" ? (
            <>
              <label className="flex items-center gap-2 text-sm text-fg sm:col-span-2">
                <input
                  type="checkbox"
                  checked={requiresResponse}
                  onChange={(e) => setRequiresResponse(e.target.checked)}
                />
                Needs a reply
              </label>
              {requiresResponse ? (
                <div className="sm:col-span-2">
                  <label className={label}>Reply due</label>
                  <input type="date" value={responseDueAt} onChange={(e) => setResponseDueAt(e.target.value)} className={field} />
                </div>
              ) : null}
            </>
          ) : null}
          <div className="flex items-center gap-2 sm:col-span-4">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? (file ? "Uploading…" : "Saving…") : "Save letter"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <Plus className="h-4 w-4" /> Add letter
        </button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
