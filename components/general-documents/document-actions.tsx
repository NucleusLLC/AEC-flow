"use client";

/**
 * What can still be done to a document, given where it stands.
 *
 * The rules are the data layer's, and they are repeated here only to decide
 * which buttons to show — never to decide what is allowed. A draft can be
 * edited, issued or deleted. Anything issued can be signed, superseded or
 * voided, and never edited: the record of what the practice put its name to on
 * a date stays as it was.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Copy, FileSignature, Send, Trash2 } from "lucide-react";
import {
  deleteDocumentAction,
  issueDocumentAction,
  markSignedAction,
  supersedeDocumentAction,
  voidDocumentAction,
} from "@/app/(app)/documents/general/actions";
import type { GeneralDocumentDTO } from "@/lib/general-documents/types";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-60";

export function DocumentActions({
  document: doc,
  today,
}: {
  document: GeneralDocumentDTO;
  today: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<null | "sign" | "void" | "delete">(null);
  const [signedAt, setSignedAt] = useState(today);
  const [voidReason, setVoidReason] = useState("");

  const isDraft = doc.status === "DRAFT";
  const isLive = doc.status === "ISSUED" || doc.status === "SIGNED";

  function run(fn: () => Promise<{ ok: true; id: string } | { ok: false; error: string }>, then?: (id: string) => void) {
    setError(null);
    setPending(true);
    void (async () => {
      const res = await fn();
      setPending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAsking(null);
      if (then) then(res.id);
      else router.refresh();
    })();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/print/documents/general/${doc.id}`} className={BTN}>
          Print / PDF
        </Link>

        {isDraft ? (
          <>
            <Link href={`/documents/general/${doc.id}/edit`} className={BTN}>
              Edit
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => issueDocumentAction(doc.id, doc.issueDate ?? today))}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Issue
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAsking("delete")}
              className={`${BTN} text-red-600`}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </>
        ) : null}

        {isLive ? (
          <>
            {doc.status === "ISSUED" ? (
              <button type="button" disabled={pending} onClick={() => setAsking("sign")} className={BTN}>
                <FileSignature className="h-4 w-4" /> Mark signed
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => supersedeDocumentAction(doc.id), (id) => router.push(`/documents/general/${id}/edit`))}
              className={BTN}
              title="Create a new draft from this document; this one becomes superseded"
            >
              <Copy className="h-4 w-4" /> Supersede
            </button>
            <button type="button" disabled={pending} onClick={() => setAsking("void")} className={`${BTN} text-red-600`}>
              <Ban className="h-4 w-4" /> Void
            </button>
          </>
        ) : null}
      </div>

      {asking === "sign" ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2/40 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Signed on</label>
            <input
              type="date"
              value={signedAt}
              onChange={(e) => setSignedAt(e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markSignedAction(doc.id, signedAt))}
            className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
          >
            Record it
          </button>
          <button type="button" onClick={() => setAsking(null)} className={BTN}>
            Cancel
          </button>
        </div>
      ) : null}

      {asking === "void" ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2/40 p-3">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">
              Why is it being withdrawn?
            </label>
            <input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Superseded by a notarised version"
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => voidDocumentAction(doc.id, voidReason))}
            className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
          >
            Void it
          </button>
          <button type="button" onClick={() => setAsking(null)} className={BTN}>
            Cancel
          </button>
          <p className="w-full text-[11px] text-faint">
            The text stays readable — voiding records that it no longer applies, it does not erase
            what was sent.
          </p>
        </div>
      ) : null}

      {asking === "delete" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/40 p-3">
          <span className="text-sm text-fg">Delete this draft?</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteDocumentAction(doc.id), () => router.push("/documents/general"))}
            className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
          >
            Delete
          </button>
          <button type="button" onClick={() => setAsking(null)} className={BTN}>
            Keep it
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
