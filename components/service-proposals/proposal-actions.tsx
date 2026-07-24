"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Send, CopyPlus, Check, X } from "lucide-react";
import {
  deleteServiceProposalAction,
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

  const canIssue = canTransition(status, "SENT");
  const canAccept = canTransition(status, "ACCEPTED");
  const canReject = canTransition(status, "REJECTED");

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <button type="button" disabled={pending} className={btn} onClick={() => run(() => reviseServiceProposalAction(id))}>
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
