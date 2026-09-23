"use client";

/**
 * The review conversation beside the sheet.
 *
 * ─── A COMMENT IS EITHER ABOUT A PLACE OR ABOUT THE SHEET ───────────────────
 * Pinned comments carry a point and show a numbered dot on the drawing;
 * unpinned ones are about the sheet as a whole ("the north elevation is
 * missing"). Both are real and the panel says which is which, because "where
 * exactly?" is the first question a reviewer gets asked.
 *
 * ─── RESOLVING IS OPEN TO ANYBODY ───────────────────────────────────────────
 * The person who fixes a thing is usually not the person who raised it. A
 * workflow that makes the reviewer come back to tick a box is a workflow full
 * of stale comments nobody trusts.
 *
 * ─── ONE LEVEL OF REPLIES ───────────────────────────────────────────────────
 * A tree of replies on a drawing is a conversation nobody can read on a site.
 */

import { useMemo, useState, useTransition } from "react";
import { Check, CornerDownRight, MapPin, RotateCcw, Trash2, UserPlus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { CommentDTO } from "@/lib/data/drawing-studio";
import type { Point } from "@/lib/drawings/markup";
import {
  assignCommentAction,
  removeCommentAction,
  setCommentStatusAction,
} from "@/app/(app)/drawings/studio/actions";

const CONTROL =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-fg placeholder:text-faint " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function CommentPanel({
  comments,
  team,
  page,
  pendingPin,
  onCancelPin,
  onAdd,
  onChanged,
  currentUserId,
}: {
  comments: CommentDTO[];
  team: { id: string; name: string }[];
  page: number;
  /** A point the user just clicked with the comment tool, awaiting its words. */
  pendingPin: Point | null;
  onCancelPin: () => void;
  onAdd: (
    body: string,
    at: Point | null,
    assignedToId: string | null,
    parentId?: string | null,
  ) => Promise<boolean>;
  onChanged: () => void | Promise<void>;
  currentUserId: string;
}) {
  const [filter, setFilter] = useState<"OPEN" | "ALL">("OPEN");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [pending, startTransition] = useTransition();

  const threads = useMemo(
    () => comments.filter((c) => (filter === "OPEN" ? c.status === "OPEN" : true)),
    [comments, filter],
  );

  const openOnThisPage = comments.filter((c) => c.page === page && c.status === "OPEN").length;

  function run(work: () => Promise<unknown>) {
    startTransition(async () => {
      await work();
      await onChanged();
    });
  }

  return (
    <Card className="flex max-h-[calc(100vh-14rem)] flex-col">
      <CardHeader
        title="Review"
        subtitle={`${openOnThisPage} open on this page · ${comments.filter((c) => c.status === "OPEN").length} on the sheet`}
        action={
          <div className="flex items-center gap-1 text-xs">
            {(["OPEN", "ALL"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-lg px-2 py-1 transition-colors",
                  filter === f ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2",
                )}
              >
                {f === "OPEN" ? "Open" : "All"}
              </button>
            ))}
          </div>
        }
      />

      <CardBody className="space-y-3 border-b border-border">
        {pendingPin ? (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700">
            <MapPin className="h-3.5 w-3.5" /> Pinned to a point on page {page}.
            <button type="button" onClick={onCancelPin} className="ml-auto underline">
              unpin
            </button>
          </p>
        ) : null}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={
            pendingPin
              ? "What is wrong here?"
              : "A note about the whole sheet — or use the pin tool to put it somewhere."
          }
          className={CONTROL}
        />

        <div className="flex items-center gap-2">
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            aria-label="Assign to"
            className="h-9 flex-1 rounded-lg border border-border bg-surface px-2 text-sm text-fg"
          >
            <option value="">Nobody in particular</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={() =>
              startTransition(async () => {
                const ok = await onAdd(body.trim(), pendingPin, assignee || null);
                if (ok) {
                  setBody("");
                  setAssignee("");
                }
              })
            }
            className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
          >
            Comment
          </button>
        </div>
      </CardBody>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {threads.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {filter === "OPEN" ? "Nothing open on this drawing." : "No comments yet."}
          </p>
        ) : (
          threads.map((c) => (
            <div
              key={c.id}
              className={cn(
                "rounded-lg border px-3 py-2",
                c.status === "RESOLVED" ? "border-border bg-surface-2/50" : "border-border bg-surface",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-fg">{c.body}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                    {c.authorName} · {formatDate(c.createdAt.slice(0, 10))} · page {c.page}
                    {c.x !== null ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" /> pinned
                      </span>
                    ) : null}
                    {c.assignedToName ? <Badge tone="blue">{c.assignedToName}</Badge> : null}
                    {c.status === "RESOLVED" ? (
                      <Badge tone="green">resolved{c.resolvedByName ? ` · ${c.resolvedByName}` : ""}</Badge>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setCommentStatusAction(c.id, c.status === "OPEN"))}
                    aria-label={c.status === "OPEN" ? "Resolve" : "Reopen"}
                    title={c.status === "OPEN" ? "Resolve" : "Reopen"}
                    className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-green-600"
                  >
                    {c.status === "OPEN" ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  </button>
                  {c.canEdit ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => removeCommentAction(c.id))}
                      aria-label="Delete comment"
                      title="Delete"
                      className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {c.replies.length > 0 ? (
                <ul className="mt-2 space-y-1.5 border-l border-border pl-3">
                  {c.replies.map((r) => (
                    <li key={r.id} className="text-sm text-muted">
                      <span className="text-fg">{r.body}</span>
                      <span className="ml-1.5 text-[11px] text-faint">— {r.authorName}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {replyTo === c.id ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Reply"
                    className={CONTROL}
                  />
                  <button
                    type="button"
                    disabled={pending || !replyBody.trim()}
                    onClick={() =>
                      startTransition(async () => {
                        // A reply inherits its parent's page and pin server-side
                        // (lib/data/drawing-studio.ts) — only the text and the
                        // parent id travel from here.
                        const ok = await onAdd(replyBody.trim(), null, null, c.id);
                        if (ok) {
                          setReplyBody("");
                          setReplyTo(null);
                        }
                      })
                    }
                    className="h-9 shrink-0 rounded-lg border border-border px-3 text-xs text-muted hover:bg-surface-2"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setReplyTo(c.id)}
                    className="inline-flex items-center gap-1 text-muted hover:text-fg"
                  >
                    <CornerDownRight className="h-3 w-3" /> Reply
                  </button>
                  <label className="inline-flex items-center gap-1 text-muted">
                    <UserPlus className="h-3 w-3" />
                    <select
                      value={c.assignedToId ?? ""}
                      disabled={pending}
                      onChange={(e) => run(() => assignCommentAction(c.id, e.target.value || null))}
                      className="bg-transparent text-[11px] text-muted focus:outline-none"
                    >
                      <option value="">assign…</option>
                      {team.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
