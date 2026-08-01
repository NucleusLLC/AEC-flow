"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Send, CopyPlus, Copy, Check, X, ClipboardCheck, ThumbsUp } from "lucide-react";
import {
  deleteServiceProposalAction,
  duplicateServiceProposalAction,
  issueServiceProposalAction,
  reviseServiceProposalAction,
  transitionServiceProposalAction,
} from "@/app/(app)/design/service-proposals/actions";
import { canTransition, type ServiceProposalStatus } from "@/lib/proposals/engine/status";

const btn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-fg disabled:opacity-50";

export function ServiceProposalActions({
  id,
  status,
}: {
  id: string;
  status: ServiceProposalStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  /**
   * Duplicate, then open the copy's edit form.
   *
   * The copy already has the next free number, so landing on the editor is what makes the
   * number visible and changeable straight away — which is the whole point of duplicating
   * rather than re-typing the proposal.
   */
  function duplicate() {
    setError(null);
    start(async () => {
      const res = await duplicateServiceProposalAction(id);
      if (!res.ok) {
        setError(res.error ?? "Could not duplicate this proposal.");
        return;
      }
      router.push(`/design/service-proposals/${res.id}/edit`);
      router.refresh();
    });
  }

  const canReview = canTransition(status, "INTERNAL_REVIEW");
  const canApprove = canTransition(status, "APPROVED_FOR_ISSUE");
  const canIssue = canTransition(status, "SENT");
  const canAccept = canTransition(status, "ACCEPTED");
  const canReject = canTransition(status, "REJECTED");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canReview ? (
        <button type="button" disabled={pending} className={btn} onClick={() => run(() => transitionServiceProposalAction(id, "INTERNAL_REVIEW"))}>
          <ClipboardCheck className="h-4 w-4" /> Submit for review
        </button>
      ) : null}
      {canApprove ? (
        <button type="button" disabled={pending} className={btn} onClick={() => run(() => transitionServiceProposalAction(id, "APPROVED_FOR_ISSUE"))}>
          <ThumbsUp className="h-4 w-4" /> Approve for issue
        </button>
      ) : null}
      {canIssue ? (
        <button type="button" disabled={pending} className={btn} onClick={() => run(() => issueServiceProposalAction(id))}>
          <Send className="h-4 w-4" /> Issue to client
        </button>
      ) : null}
      {canAccept ? (
        <button type="button" disabled={pending} className={btn} onClick={() => run(() => transitionServiceProposalAction(id, "ACCEPTED"))}>
          <Check className="h-4 w-4" /> Mark accepted
        </button>
      ) : null}
      {canReject ? (
        <button type="button" disabled={pending} className={btn} onClick={() => run(() => transitionServiceProposalAction(id, "REJECTED"))}>
          <X className="h-4 w-4" /> Mark rejected
        </button>
      ) : null}
      {/* Duplicate sits next to "New revision" on purpose — the two are easily confused, so
        * they are shown together with the distinction spelled out in the tooltips. */}
      <button
        type="button"
        disabled={pending}
        className={btn}
        title="Copy this proposal into a new draft with the next proposal number"
        onClick={duplicate}
      >
        <Copy className="h-4 w-4" /> Duplicate
      </button>
      <button
        type="button"
        disabled={pending}
        className={btn}
        title="Continue this offer as the next revision, superseding the issued one"
        onClick={() => run(() => reviseServiceProposalAction(id))}
      >
        <CopyPlus className="h-4 w-4" /> New revision
      </button>
      <DeleteButton id={id} onError={setError} />
      {error ? <span className="text-sm text-rose-600">{error}</span> : null}
    </div>
  );
}

function DeleteButton({ id, onError }: { id: string; onError: (m: string) => void }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function remove() {
    start(async () => {
      const res = await deleteServiceProposalAction(id);
      if (!res.ok) {
        onError(res.error ?? "Could not delete.");
        setConfirming(false);
        return;
      }
      router.push("/design/service-proposals");
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        <button type="button" onClick={remove} disabled={pending} className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">
          {pending ? "Deleting…" : "Confirm delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium text-muted hover:text-fg">Cancel</button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted transition-colors hover:border-rose-300 hover:text-rose-600">
      <Trash2 className="h-4 w-4" /> Delete
    </button>
  );
}
