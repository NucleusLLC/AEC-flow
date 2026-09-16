"use client";

/**
 * Permit-file minutes: the site visit with the plan examiner, the counter
 * meeting about a setback.
 *
 * Deliberately NOT the app's client Meeting Minutes register — a meeting with
 * the authority is not a client meeting, and mixing the two puts one practice's
 * authority notes in front of a client.
 *
 * Minutes are the thing someone quotes a year later, so they are stored whole
 * and shown whole rather than truncated to a line.
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { militaryDate } from "@/lib/building-permits/register";
import type { BuildingPermitMeetingDTO } from "@/lib/building-permits/types";
import {
  addMeetingAction,
  deleteMeetingAction,
} from "@/app/(app)/design/building-permits/actions";

const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const input = `h-9 ${field} py-0`;
const label = "mb-1 block text-xs font-medium text-muted";

export function PermitMeetings({
  permitId,
  meetings,
  today,
  onChanged,
}: {
  permitId: string;
  meetings: BuildingPermitMeetingDTO[];
  today: string;
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [heldAt, setHeldAt] = useState(today);
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState("");
  const [minutes, setMinutes] = useState("");
  const [decisions, setDecisions] = useState("");
  const [followUp, setFollowUp] = useState("");

  function reset() {
    setSubject("");
    setLocation("");
    setAttendees("");
    setMinutes("");
    setDecisions("");
    setFollowUp("");
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    void (async () => {
      const res = await addMeetingAction(permitId, {
        heldAt,
        subject,
        location: location || null,
        attendees: attendees || null,
        minutes: minutes || null,
        decisions: decisions || null,
        followUp: followUp || null,
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
      const res = await deleteMeetingAction(permitId, id);
      if (!res.ok) setError(res.error);
      setConfirmId(null);
      await onChanged();
      setPending(false);
    })();
  }

  return (
    <div className="space-y-3">
      {meetings.length === 0 ? (
        <p className="text-sm text-muted">No meeting recorded on this file yet.</p>
      ) : (
        <ul className="space-y-3">
          {meetings.map((m) => (
            <li key={m.id} className="rounded-lg border border-border bg-surface-2/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs tabular-nums text-fg">
                      {militaryDate(m.heldAt)}
                    </span>
                    <span className="font-medium text-fg">{m.subject}</span>
                    {m.location ? (
                      <span className="text-[11px] text-faint">{m.location}</span>
                    ) : null}
                  </div>
                  {m.attendees ? (
                    <div className="mt-0.5 text-[11px] text-faint">{m.attendees}</div>
                  ) : null}
                </div>
                {confirmId === m.id ? (
                  <span className="inline-flex shrink-0 items-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(m.id)}
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
                    onClick={() => setConfirmId(m.id)}
                    aria-label={`Delete the meeting of ${militaryDate(m.heldAt)}`}
                    className="shrink-0 text-faint transition-colors hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {m.minutes ? (
                <p className="mt-2 whitespace-pre-line text-sm text-fg">{m.minutes}</p>
              ) : null}
              {m.decisions ? (
                <p className="mt-2 whitespace-pre-line text-sm text-muted">
                  <span className="text-faint">Decisions: </span>
                  {m.decisions}
                </p>
              ) : null}
              {m.followUp ? (
                <p className="mt-1 whitespace-pre-line text-sm text-muted">
                  <span className="text-faint">Follow-up: </span>
                  {m.followUp}
                </p>
              ) : null}
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
            <label className={label}>Held on</label>
            <input
              type="date"
              required
              value={heldAt}
              onChange={(e) => setHeldAt(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Subject</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Site visit with the plan examiner"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Attendees</label>
            <input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="Who was there, and for whom"
              className={input}
            />
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Minutes</label>
            <textarea
              rows={5}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="What was said, in enough detail to quote a year from now"
              className={field}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Decisions</label>
            <textarea
              rows={2}
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Follow-up</label>
            <textarea
              rows={2}
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className={field}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save minutes"}
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
          <Plus className="h-4 w-4" /> Record a meeting
        </button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
