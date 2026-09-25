"use client";

/**
 * What can be done to a contract, and when.
 *
 * THE GATES ARE THE DATA LAYER'S; these buttons only stop offering what it
 * would refuse. A DRAFT can be edited, issued or deleted. An ISSUED contract
 * can be signed or voided — never edited, because it is what the practice put
 * in front of a client. A SIGNED one can only be read and printed.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, FileCheck2, PenLine, Printer, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContractStatus } from "@/lib/contracts/types";
import {
  deleteContractAction,
  issueContractAction,
  markSignedAction,
  voidContractAction,
} from "@/app/(app)/documents/contracts/actions";

export function ContractActions({
  id,
  status,
  editing,
  onToggleEdit,
}: {
  id: string;
  status: ContractStatus;
  editing: boolean;
  onToggleEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) setError(result.error ?? "That did not work.");
      else {
        after?.();
        router.refresh();
      }
    });
  }

  const button =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-fg transition-colors hover:bg-surface-2 disabled:opacity-60";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/print/documents/contracts/${id}`} className={button}>
          <Printer className="h-4 w-4" /> Print
        </Link>

        {status === "DRAFT" ? (
          <>
            <button
              type="button"
              onClick={onToggleEdit}
              className={cn(button, editing && "border-brand text-brand")}
            >
              <PenLine className="h-4 w-4" /> {editing ? "Stop editing" : "Edit"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Issue this contract? After that it can only be signed or voided."))
                  return;
                run(() => issueContractAction(id));
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Issue
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Delete this draft?")) return;
                run(() => deleteContractAction(id), () => router.push("/documents/contracts"));
              }}
              className={cn(button, "text-muted hover:text-red-600")}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </>
        ) : null}

        {status === "ISSUED" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const on = window.prompt("Signed on which date? (YYYY-MM-DD, blank for today)")?.trim();
                run(() => markSignedAction(id, on || null));
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
            >
              <FileCheck2 className="h-4 w-4" /> Mark as signed
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const why = window.prompt("Why is this contract being voided?")?.trim();
                if (!why) return;
                run(() => voidContractAction(id, why));
              }}
              className={cn(button, "text-muted hover:text-red-600")}
            >
              <Ban className="h-4 w-4" /> Void
            </button>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
