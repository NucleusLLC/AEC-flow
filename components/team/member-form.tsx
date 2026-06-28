"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  ROLE_LABEL,
  DISCIPLINE_LABEL,
  DEPARTMENT_LABEL,
  type UserRole,
  type Discipline,
  type Department,
  type UserStatus,
  type TeamMemberWriteInput,
} from "@/lib/data/team.types";
import { saveTeamMember } from "@/app/(app)/team/actions";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";

const ROLES = Object.keys(ROLE_LABEL) as UserRole[];
const DISCIPLINES = Object.keys(DISCIPLINE_LABEL) as Discipline[];
const DEPARTMENTS = Object.keys(DEPARTMENT_LABEL) as Department[];

/**
 * Values the form renders/prefills. Only the fields with inputs below are
 * editable; the remaining members of TeamMemberWriteInput (status, utilisation,
 * bio, skills, leave) are carried through unchanged from `initial` on edit so an
 * update never wipes data the form doesn't expose. `skills` is comma-joined.
 */
export type MemberFormValues = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  discipline: Discipline | "";
  department: Department;
  status: UserStatus;
  capacity: number;
  officeLocation: string;
  joiningDate: string;
  utilisation?: number;
  bio?: string | null;
  skills?: string;
  annualLeaveTotal?: number;
  annualLeaveTaken?: number;
};

export function MemberForm({
  mode = "new",
  initial,
}: {
  mode?: "new" | "edit";
  initial?: MemberFormValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: TeamMemberWriteInput = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: (fd.get("phone") as string) || null,
      role: (fd.get("role") as UserRole) || "STAFF",
      discipline: (fd.get("discipline") as Discipline) || null,
      department: (fd.get("department") as Department) || "DESIGN",
      officeLocation: (fd.get("officeLocation") as string) || null,
      capacity: Number(fd.get("capacity")) || 100,
      status: mode === "edit" ? initial?.status ?? "ACTIVE" : "ACTIVE",
    };

    // On edit, carry through fields the form doesn't render so the update
    // doesn't reset them to server defaults.
    if (mode === "edit") {
      payload.id = initial?.id;
      payload.utilisation = initial?.utilisation;
      payload.bio = initial?.bio;
      payload.skills = initial?.skills;
      payload.annualLeaveTotal = initial?.annualLeaveTotal;
      payload.annualLeaveTaken = initial?.annualLeaveTaken;
      payload.joiningDate = initial?.joiningDate || null;
    }

    setError(null);
    startTransition(async () => {
      const res = await saveTeamMember(mode, payload);
      if (res.ok) {
        router.push(`/team/${res.id}`);
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
            <p className="font-medium text-red-800">
              Could not {mode === "edit" ? "update" : "add"} member.
            </p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">Member details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="name">
              Full name *
            </label>
            <input id="name" name="name" required className={inputClass} placeholder="e.g. Mariam Al Suwaidi" defaultValue={initial?.name ?? ""} />
          </div>
          <div>
            <label className={labelClass} htmlFor="email">
              Email *
            </label>
            <input id="email" name="email" type="email" required className={inputClass} placeholder="name@zenarch.net" defaultValue={initial?.email ?? ""} />
          </div>
          <div>
            <label className={labelClass} htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" className={inputClass} placeholder="+971 50 000 0000" defaultValue={initial?.phone ?? ""} />
          </div>
          <div>
            <label className={labelClass} htmlFor="officeLocation">
              Office
            </label>
            <input id="officeLocation" name="officeLocation" className={inputClass} defaultValue={initial?.officeLocation ?? "Dubai"} />
          </div>
          <div>
            <label className={labelClass} htmlFor="role">
              Role
            </label>
            <select id="role" name="role" className={inputClass} defaultValue={initial?.role ?? "STAFF"}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="department">
              Department
            </label>
            <select id="department" name="department" className={inputClass} defaultValue={initial?.department ?? "DESIGN"}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABEL[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="discipline">
              Discipline
            </label>
            <select id="discipline" name="discipline" className={inputClass} defaultValue={initial?.discipline ?? ""}>
              <option value="">— None —</option>
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>
                  {DISCIPLINE_LABEL[d]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="capacity">
              Capacity (%)
            </label>
            <input id="capacity" name="capacity" type="number" min="0" max="100" step="10" className={inputClass} defaultValue={initial?.capacity ?? 100} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link
          href={mode === "edit" && initial?.id ? `/team/${initial.id}` : "/team"}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add member"}
        </button>
      </div>
    </form>
  );
}
