"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  LEAVE_TYPE_LABEL,
  type LeaveStatus,
  type LeaveType,
  type LeaveWriteInput,
} from "@/lib/data/leave.types";
import { saveLeaveRequest } from "@/app/(app)/leave/actions";
import { MemberSelect } from "@/components/team/member-select";

export type LeaveFormInitial = {
  id: string;
  userName: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  reason: string;
};

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";

const TYPES = Object.keys(LEAVE_TYPE_LABEL) as LeaveType[];

function workingDaysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  let days = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 5 && dow !== 6) days += 1; // UAE weekend: Fri/Sat
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function LeaveRequestForm({
  // Aliased — the growable list lives in state, see `members` below.
  members: memberNames,
  mode = "new",
  initial,
}: {
  members: string[];
  mode?: "new" | "edit";
  initial?: LeaveFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState(initial?.startDate ?? "");
  const [end, setEnd] = useState(initial?.endDate ?? "");
  const days = workingDaysBetween(start, end);
  // The member select used to render with no options on an empty roster and post
  // userName: "", which only failed once the server rejected it. It is now a
  // creatable picker, so it has to be controlled.
  const [members, setMembers] = useState<string[]>(memberNames);
  const [userName, setUserName] = useState(initial?.userName ?? memberNames[0] ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: LeaveWriteInput = {
      ...(mode === "edit" && initial ? { id: initial.id } : {}),
      userName,
      type: (fd.get("type") as LeaveType) ?? "ANNUAL",
      status: mode === "edit" && initial ? initial.status : "PENDING",
      startDate: start,
      endDate: end,
      days,
      reason: String(fd.get("reason") ?? ""),
    };

    setError(null);
    startTransition(async () => {
      const res = await saveLeaveRequest(mode, payload);
      if (res.ok) {
        router.push("/leave");
        router.refresh();
      } else {
        setError(res.error);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-5 py-4">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-red-800">Could not submit leave request.</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">Leave request</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Leave is filed against a member's display NAME, hence `by="name"`. */}
          <MemberSelect
            id="userName"
            label="Team member"
            by="name"
            members={members.map((m) => ({ id: m, name: m }))}
            value={userName}
            onChange={setUserName}
            onCreated={(m) => setMembers((prev) => [...prev, m.name])}
            labelClassName={labelClass}
          />

          <div>
            <label className={labelClass} htmlFor="type">
              Leave type
            </label>
            <select id="type" name="type" className={inputClass} defaultValue={initial?.type ?? "ANNUAL"}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {LEAVE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="startDate">
              Start date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="endDate">
              End date
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
            Working days requested: <span className="font-semibold text-fg">{days}</span>{" "}
            <span className="text-xs text-faint">(excludes Fri/Sat weekends)</span>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="reason">
              Reason (optional)
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              defaultValue={initial?.reason ?? ""}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15"
              placeholder="Family holiday, medical, etc."
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/leave"
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Submit request"}
        </button>
      </div>
    </form>
  );
}
