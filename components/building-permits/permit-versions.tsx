"use client";

/**
 * The versions of an application — one row per trip to the counter.
 *
 * V1 is the first submission; every resubmission is the next version. The
 * register's Version # and Submittal date read off this log, and logging the
 * first version fills in the file's submittal date when it was left blank.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { militaryDate } from "@/lib/building-permits/register";
import {
  SUBMISSION_METHODS,
  SUBMISSION_METHOD_LABEL,
  type BuildingPermitSubmissionDTO,
  type BuildingPermitSubmissionMethod,
} from "@/lib/building-permits/types";
import {
  addSubmissionAction,
  deleteSubmissionAction,
} from "@/app/(app)/design/building-permits/actions";

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

export function PermitVersions({
  permitId,
  submissions,
  today,
}: {
  permitId: string;
  submissions: BuildingPermitSubmissionDTO[];
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [submittedAt, setSubmittedAt] = useState(today);
  const [method, setMethod] = useState<BuildingPermitSubmissionMethod>("COUNTER");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [contents, setContents] = useState("");

  const next = submissions.length + 1;

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addSubmissionAction(permitId, {
        submittedAt,
        method,
        receiptNumber: receiptNumber || null,
        receivedBy: receivedBy || null,
        contents: contents || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setReceiptNumber("");
      setReceivedBy("");
      setContents("");
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const res = await deleteSubmissionAction(permitId, id);
      if (!res.ok) setError(res.error);
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {submissions.length === 0 ? (
        <p className="text-sm text-muted">
          No version logged yet. Log V1 the day the application goes in.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 pb-1.5 font-medium">Version #</th>
                <th className="px-3 pb-1.5 font-medium">Submittal date</th>
                <th className="px-3 pb-1.5 font-medium">Method</th>
                <th className="px-3 pb-1.5 font-medium">Receipt #</th>
                <th className="px-3 pb-1.5 font-medium">Contents</th>
                <th className="px-3 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, i) => (
                <tr key={s.id} className="border-t border-border/60 even:bg-surface-2/40">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">V{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">{militaryDate(s.submittedAt)}</td>
                  <td className="px-3 py-2 text-muted">{SUBMISSION_METHOD_LABEL[s.method]}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{s.receiptNumber ?? "—"}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-muted" title={s.contents ?? ""}>
                    {s.contents ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {confirmId === s.id ? (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => remove(s.id)}
                          className="font-medium text-red-600 hover:underline"
                        >
                          Delete V{i + 1}
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className="text-muted hover:underline">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(s.id)}
                        aria-label={`Delete version ${i + 1}`}
                        className="text-faint transition-colors hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <form onSubmit={add} className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-3 sm:grid-cols-4">
          <div>
            <label className={label}>Version #</label>
            <div className="flex h-9 items-center font-mono text-sm font-semibold">V{next}</div>
          </div>
          <div>
            <label className={label}>Submittal date</label>
            <input type="date" required value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as BuildingPermitSubmissionMethod)}
              className={field}
            >
              {SUBMISSION_METHODS.map((m) => (
                <option key={m} value={m}>
                  {SUBMISSION_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Receipt #</label>
            <input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} className={`${field} font-mono`} />
          </div>
          <div className="sm:col-span-1">
            <label className={label}>Received by</label>
            <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className={field} />
          </div>
          <div className="sm:col-span-3">
            <label className={label}>What went in</label>
            <input
              value={contents}
              onChange={(e) => setContents(e.target.value)}
              placeholder="e.g. Revised drawings A-101 to A-104, structural calcs"
              className={field}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-4">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : `Log V${next}`}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
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
          <Plus className="h-4 w-4" /> {submissions.length === 0 ? "Log V1" : `Log resubmission (V${next})`}
        </button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
