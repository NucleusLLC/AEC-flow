"use client";

/**
 * Inline confirm, not a dialog: this repo has no dialog primitive, and the
 * pattern copied here (components/design/deliverable-delete-button.tsx) is the
 * one the rest of the app already asks a destructive question with.
 *
 * The delete is a soft delete server-side — the file stays as the record of
 * what the practice told an authority — so the copy says "remove from the
 * register" rather than promising the file is gone.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deletePermitAction } from "@/app/(app)/design/building-permits/actions";

export function PermitDeleteButton({ id, reference }: { id: string; reference: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    start(async () => {
      const res = await deletePermitAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/design/building-permits");
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Remove {reference} from the register?</span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {pending ? "Removing…" : "Remove"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium text-muted hover:text-fg"
        >
          Cancel
        </button>
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted transition-colors hover:border-rose-300 hover:text-rose-600"
    >
      <Trash2 className="h-4 w-4" /> Delete
    </button>
  );
}
