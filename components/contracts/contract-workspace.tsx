"use client";

/**
 * The contract on screen: read it, correct it, act on it.
 *
 * ─── EDITING IS STRUCTURED, NOT A CONTENTEDITABLE PAGE ──────────────────────
 * The document is stored as structure (docs/contracts/PLAN.md), so a correction
 * edits the paragraph it belongs to and nothing else. A contenteditable sheet
 * would make the user's keystrokes fight the typesetter, and every save would
 * have to parse HTML back into clauses — which is how a stray <div> ends up in
 * a legal document.
 *
 * ─── THE FIGURES ARE NOT EDITABLE HERE ──────────────────────────────────────
 * Instalment amounts come from the contract sum and the percentages, in cents,
 * and are recomputed on every save. A user who needs different amounts changes
 * the percentages and regenerates — editing a number in place would produce a
 * schedule that no longer adds up to its own contract.
 *
 * ─── THE REVIEW BOX IS NEVER PRINTED ────────────────────────────────────────
 * What the model changed, and what it could not fill, belong to the reviewer,
 * not to the parties.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, ListChecks, Save } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ContractDocument } from "@/components/contracts/contract-document";
import { ContractActions } from "@/components/contracts/contract-actions";
import { saveContractBodyAction } from "@/app/(app)/documents/contracts/actions";
import type { ContractBody, ContractStatus } from "@/lib/contracts/types";

export function ContractWorkspace({
  id,
  number,
  status,
  currency,
  exchangeRate,
  names,
  initialBody,
}: {
  id: string;
  number: string;
  status: ContractStatus;
  currency: string;
  exchangeRate: number;
  names: string[];
  initialBody: ContractBody;
}) {
  const router = useRouter();
  const [body, setBody] = useState<ContractBody>(initialBody);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = status === "DRAFT";

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveContractBodyAction(id, body);
      if (!result.ok) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  function editParagraph(articleIndex: number, paragraphIndex: number, text: string) {
    setBody((b) => ({
      ...b,
      articles: b.articles.map((a, i) =>
        i === articleIndex
          ? { ...a, paragraphs: a.paragraphs.map((p, j) => (j === paragraphIndex ? text : p)) }
          : a,
      ),
    }));
  }

  return (
    <div className="space-y-4">
      <ContractActions
        id={id}
        status={status}
        editing={editing}
        onToggleEdit={() => setEditing((v) => !v)}
      />

      {(body.changes.length > 0 || body.check.length > 0) && !editing ? (
        <Card className="border-amber-500/40">
          <CardHeader
            title="Before you issue this"
            subtitle="What the model filled in, and what it could not. Never printed."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {body.check.length > 0 ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-600">
                  <CircleAlert className="h-3.5 w-3.5" /> Needs a human
                </div>
                <ul className="space-y-1 text-sm text-fg">
                  {body.check.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {body.changes.length > 0 ? (
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-faint">
                  <ListChecks className="h-3.5 w-3.5" /> Filled in
                </div>
                <ul className="space-y-1 text-sm text-muted">
                  {body.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {editing && editable ? (
        <Card>
          <CardHeader
            title="Correcting the contract"
            subtitle="Edit the wording. The instalment amounts are recomputed from the contract sum on save."
            action={
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" /> {pending ? "Saving…" : saved ? "Saved" : "Save"}
              </button>
            }
          />
          <CardBody className="space-y-4">
            {error ? (
              <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="contract-title">
                Title
              </label>
              <input
                id="contract-title"
                value={body.title}
                onChange={(e) => setBody((b) => ({ ...b, title: e.target.value }))}
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
            </div>

            {body.articles.map((article, i) => (
              <div key={`${article.number}-${i}`} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex gap-2">
                  <input
                    value={article.number}
                    onChange={(e) =>
                      setBody((b) => ({
                        ...b,
                        articles: b.articles.map((a, j) =>
                          j === i ? { ...a, number: e.target.value } : a,
                        ),
                      }))
                    }
                    aria-label={`Article ${i + 1} number`}
                    className="h-8 w-16 rounded-lg border border-border bg-surface px-2 text-center font-mono text-xs text-fg"
                  />
                  <input
                    value={article.heading}
                    onChange={(e) =>
                      setBody((b) => ({
                        ...b,
                        articles: b.articles.map((a, j) =>
                          j === i ? { ...a, heading: e.target.value } : a,
                        ),
                      }))
                    }
                    aria-label={`Article ${i + 1} heading`}
                    className="h-8 flex-1 rounded-lg border border-border bg-surface px-2 text-sm font-medium text-fg"
                  />
                </div>
                <div className="space-y-2">
                  {article.paragraphs.map((p, j) => (
                    <textarea
                      key={j}
                      value={p}
                      onChange={(e) => editParagraph(i, j, e.target.value)}
                      rows={Math.min(10, Math.max(2, Math.ceil(p.length / 110)))}
                      aria-label={`Article ${article.number} paragraph ${j + 1}`}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    />
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="bg-white p-8 text-black dark:bg-white">
          <ContractDocument
            body={body}
            currency={currency}
            exchangeRate={exchangeRate}
            names={names}
            contractNumber={number}
            draft={status === "DRAFT"}
          />
        </CardBody>
      </Card>
    </div>
  );
}
