"use client";

/**
 * Loose files on the case: the stamped application form, the fee receipt, a
 * photo of the site notice, a drawing extract.
 *
 * NOT the letters — a letter's PDF belongs to its letter and is listed there.
 * Those rows carry `correspondenceId`, and this section filters them out so the
 * same file is never shown in two places.
 *
 * A row can point at an uploaded file OR at a link (a portal URL, a shared
 * folder). One or the other is required; the zod gate refuses a row that points
 * at nothing, because that is a row someone clicks and finds empty.
 */

import { useRef, useState } from "react";
import { ExternalLink, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { validatePermitFile } from "@/lib/building-permits/letter-file";
import { militaryDate } from "@/lib/building-permits/register";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  type BuildingPermitDocumentCategory,
  type BuildingPermitDocumentDTO,
} from "@/lib/building-permits/types";
import {
  addDocumentAction,
  createDocumentUploadTicketAction,
  deleteDocumentAction,
} from "@/app/(app)/design/building-permits/actions";

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

/** Kilobytes, or megabytes once it is worth saying so. */
function fileSize(bytes: number | null): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function PermitDocuments({
  permitId,
  documents,
  today,
  onChanged,
}: {
  permitId: string;
  documents: BuildingPermitDocumentDTO[];
  today: string;
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<BuildingPermitDocumentCategory>("APPLICATION_FORM");
  const [documentDate, setDocumentDate] = useState(today);
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // A letter's PDF lives with its letter; see the note at the top.
  const loose = documents.filter((d) => !d.correspondenceId);

  function reset() {
    setName("");
    setExternalUrl("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    void (async () => {
      try {
        let upload: { storageKey: string; filename: string } | null = null;
        if (file) {
          const verdict = validatePermitFile({ name: file.name, size: file.size, type: file.type });
          if (!verdict.ok) throw new Error(verdict.message);
          const ticket = await createDocumentUploadTicketAction(permitId, {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          });
          if (!ticket.ok) throw new Error(ticket.error);
          const put = await fetch(ticket.ticket.uploadUrl, {
            method: "PUT",
            headers: ticket.ticket.headers,
            body: file,
          });
          if (!put.ok) throw new Error(`Storage refused the upload (${put.status}). Try again.`);
          upload = { storageKey: ticket.ticket.storageKey, filename: file.name };
        }
        const res = await addDocumentAction(
          permitId,
          {
            // The file's own name is a sensible title when none was typed.
            name: name.trim() || file?.name || "",
            category,
            externalUrl: externalUrl.trim() || null,
            documentDate: documentDate || null,
          },
          upload,
        );
        if (!res.ok) {
          setError(res.error);
          return;
        }
        reset();
        setOpen(false);
        await onChanged();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "The file was not saved.");
      } finally {
        setPending(false);
      }
    })();
  }

  function remove(id: string) {
    setError(null);
    setPending(true);
    void (async () => {
      const res = await deleteDocumentAction(permitId, id);
      if (!res.ok) setError(res.error);
      setConfirmId(null);
      await onChanged();
      setPending(false);
    })();
  }

  return (
    <div className="space-y-3">
      {loose.length === 0 ? (
        <p className="text-sm text-muted">
          No file on the case yet — the stamped form, the fee receipt, a photo of the site notice.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {loose.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  {d.storageKey ? (
                    <a
                      href={`/design/building-permits/file/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-fg hover:text-brand hover:underline"
                      title={d.filename ?? "Open"}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-brand" />
                      <span className="truncate">{d.name}</span>
                    </a>
                  ) : d.externalUrl ? (
                    <a
                      href={d.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-fg hover:text-brand hover:underline"
                      title={d.externalUrl}
                    >
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted" />
                      <span className="truncate">{d.name}</span>
                    </a>
                  ) : (
                    <span className="truncate text-sm font-medium text-fg">{d.name}</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-faint">
                  {[
                    DOCUMENT_CATEGORY_LABEL[d.category],
                    d.documentDate ? militaryDate(d.documentDate) : null,
                    fileSize(d.sizeBytes) || null,
                    d.uploadedByName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {confirmId === d.id ? (
                <span className="inline-flex shrink-0 items-center gap-2 text-xs">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(d.id)}
                    className="font-medium text-red-600 hover:underline"
                  >
                    Delete{d.storageKey ? " + file" : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-muted hover:underline"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(d.id)}
                  aria-label={`Delete ${d.name}`}
                  className="shrink-0 text-faint transition-colors hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          onSubmit={add}
          className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-3 sm:grid-cols-3"
        >
          <div>
            <label className={label}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BuildingPermitDocumentCategory)}
              className={field}
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {DOCUMENT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Defaults to the file's name"
              className={field}
            />
          </div>
          <div>
            <label className={label}>Document date</label>
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className={field}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>File</label>
            <input
              ref={fileInput}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:text-sm file:font-medium file:text-fg"
            />
          </div>
          <div>
            <label className={label}>…or a link</label>
            <input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://"
              className={field}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              <Paperclip className="h-4 w-4" />
              {pending ? (file ? "Uploading…" : "Saving…") : "Add to the case"}
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
          <Plus className="h-4 w-4" /> Add a file
        </button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
