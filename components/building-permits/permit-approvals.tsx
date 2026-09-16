"use client";

/**
 * Staged approvals on a permit file: concept, zoning, technical, fire, health,
 * utilities, final.
 *
 * Concept approval is a first-class event here AND a date on the case file —
 * the office quotes the concept approval reference months before the permit
 * itself exists, so it cannot only live inside the final decision.
 *
 * Writes go through the same actions as everything else and then ask the parent
 * to re-read the file; see the note in permit-case-file.tsx for why this does
 * not use `router.refresh()`.
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ApprovalStatusBadge } from "@/components/building-permits/badges";
import { militaryDate } from "@/lib/building-permits/register";
import {
  APPROVAL_STAGES,
  APPROVAL_STAGE_LABEL,
  APPROVAL_STATUSES,
  APPROVAL_STATUS_LABEL,
  type BuildingPermitApprovalDTO,
  type BuildingPermitApprovalStage,
  type BuildingPermitApprovalStatus,
} from "@/lib/building-permits/types";
import {
  addApprovalAction,
  deleteApprovalAction,
} from "@/app/(app)/design/building-permits/actions";

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

export function PermitApprovals({
  permitId,
  approvals,
  today,
  onChanged,
}: {
  permitId: string;
  approvals: BuildingPermitApprovalDTO[];
  today: string;
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [stage, setStage] = useState<BuildingPermitApprovalStage>("CONCEPT");
  const [status, setStatus] = useState<BuildingPermitApprovalStatus>("PENDING");
  const [decidedAt, setDecidedAt] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [conditions, setConditions] = useState("");

  function reset() {
    setDecidedAt("");
    setRefNumber("");
    setValidUntil("");
    setConditions("");
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    void (async () => {
      const res = await addApprovalAction(permitId, {
        stage,
        status,
        // A pending stage has no decision date yet; the zod gate insists a
        // decided one does, and says so in the user's own words.
        decidedAt: status === "PENDING" ? null : decidedAt || today,
        refNumber: refNumber || null,
        validUntil: validUntil || null,
        conditions: conditions || null,
      });
      if (res.ok) {
        reset();
        setOpen(false);
        await onChanged();
      } else {
        setError(res.error);
      }
      setPending(false);
    })();
  }

  function remove(id: string) {
    setError(null);
    setPending(true);
    void (async () => {
      const res = await deleteApprovalAction(permitId, id);
      if (!res.ok) setError(res.error);
      setConfirmId(null);
      await onChanged();
      setPending(false);
    })();
  }

  return (
    <div className="space-y-3">
      {approvals.length === 0 ? (
        <p className="text-sm text-muted">
          No approval stage recorded. Add the concept approval the day it lands.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 pb-1.5 font-medium">Stage</th>
                <th className="px-3 pb-1.5 font-medium">Status</th>
                <th className="px-3 pb-1.5 font-medium">Decided</th>
                <th className="px-3 pb-1.5 font-medium">Ref.</th>
                <th className="px-3 pb-1.5 font-medium">Valid until</th>
                <th className="px-3 pb-1.5 font-medium">Conditions</th>
                <th className="px-3 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id} className="border-t border-border/60 align-top even:bg-surface-2/40">
                  <td className="px-3 py-2 font-medium text-fg">{APPROVAL_STAGE_LABEL[a.stage]}</td>
                  <td className="px-3 py-2">
                    <ApprovalStatusBadge status={a.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                    {militaryDate(a.decidedAt)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">{a.refNumber ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted">
                    {militaryDate(a.validUntil)}
                  </td>
                  <td className="max-w-[240px] px-3 py-2 text-muted" title={a.conditions ?? ""}>
                    <span className="line-clamp-2">{a.conditions ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {confirmId === a.id ? (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => remove(a.id)}
                          className="font-medium text-red-600 hover:underline"
                        >
                          Delete
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
                        onClick={() => setConfirmId(a.id)}
                        aria-label={`Delete ${APPROVAL_STAGE_LABEL[a.stage]}`}
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
        <form
          onSubmit={add}
          className="grid gap-3 rounded-lg border border-border bg-surface-2/40 p-3 sm:grid-cols-4"
        >
          <div>
            <label className={label}>Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as BuildingPermitApprovalStage)}
              className={field}
            >
              {APPROVAL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {APPROVAL_STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BuildingPermitApprovalStatus)}
              className={field}
            >
              {APPROVAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {APPROVAL_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          {status === "PENDING" ? (
            <div className="sm:col-span-2 self-end pb-2 text-xs text-muted">
              A pending stage carries no decision date yet.
            </div>
          ) : (
            <>
              <div>
                <label className={label}>Decided</label>
                <input
                  type="date"
                  value={decidedAt}
                  onChange={(e) => setDecidedAt(e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Valid until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className={field}
                />
              </div>
            </>
          )}
          <div>
            <label className={label}>Reference</label>
            <input
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              className={`${field} font-mono`}
            />
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Conditions</label>
            <input
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="What the approval is conditional on"
              className={field}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-4">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save approval"}
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
          <Plus className="h-4 w-4" /> Add approval stage
        </button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
