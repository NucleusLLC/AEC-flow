"use client";

import { useState, useTransition } from "react";
import { Plus, AlertTriangle, Loader2, X, Check, Lock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  setMemberRoleAction, setMemberStatusAction, inviteMemberAction,
} from "@/app/(app)/settings/actions";
import { initials } from "@/lib/utils";
import { DEPARTMENT_LABEL } from "@/lib/data/team.types";
import {
  ROLE_LABEL, type Member, type RoleInfo, type UserRole, type Department,
} from "@/lib/data/settings";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const roleTone: Record<UserRole, Tone> = {
  ADMIN: "red", DIRECTOR: "violet", MANAGER: "blue", STAFF: "slate", VIEWER: "neutral",
};
const statusTone: Record<Member["status"], Tone> = {
  ACTIVE: "green", ON_LEAVE: "amber", INACTIVE: "slate",
};

const ROLES: UserRole[] = ["ADMIN", "DIRECTOR", "MANAGER", "STAFF", "VIEWER"];
const STATUSES: Member["status"][] = ["ACTIVE", "ON_LEAVE", "INACTIVE"];
const DEPARTMENTS: Department[] = ["DESIGN", "ENGINEERING", "MANAGEMENT", "ADMIN", "FINANCE"];

const selectCls =
  "h-8 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

export function MembersManager({
  members: initial,
  roles: initialRoles,
  canSave,
}: {
  members: Member[];
  roles: RoleInfo[];
  canSave: boolean;
}) {
  const [members, setMembers] = useState<Member[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [pending, startTransition] = useTransition();

  // Role-summary cards recomputed from the live list so counts track edits.
  const roles: RoleInfo[] = initialRoles.map((r) => ({
    ...r,
    memberCount: members.filter((m) => m.role === r.role).length,
  }));

  function changeRole(id: string, role: UserRole) {
    const prev = members;
    setError(null);
    setBusyId(id);
    setMembers((l) => l.map((m) => (m.id === id ? { ...m, role } : m)));
    startTransition(async () => {
      const res = await setMemberRoleAction(id, role);
      setBusyId(null);
      if (!res.ok) { setMembers(prev); setError(res.error); }
    });
  }

  function changeStatus(id: string, status: Member["status"]) {
    const prev = members;
    setError(null);
    setBusyId(id);
    setMembers((l) => l.map((m) => (m.id === id ? { ...m, status } : m)));
    startTransition(async () => {
      const res = await setMemberStatusAction(id, status);
      setBusyId(null);
      if (!res.ok) { setMembers(prev); setError(res.error); }
    });
  }

  function onInvited(m: Member) {
    setMembers((l) => [...l, m].sort((a, b) => a.name.localeCompare(b.name)));
    setInviting(false);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.role} className="p-4">
            <div className="flex items-center justify-between">
              <Badge tone={roleTone[r.role]}>{r.label}</Badge>
              <span className="text-xs text-faint">{r.memberCount} {r.memberCount === 1 ? "member" : "members"}</span>
            </div>
            <p className="mt-2 text-xs text-muted">{r.description}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Members"
          subtitle={`${members.length} people`}
          action={
            <button
              type="button"
              onClick={() => { setError(null); setInviting(true); }}
              disabled={!canSave}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-2.5 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> Invite member
            </button>
          }
        />

        {!canSave ? (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Lock className="h-3.5 w-3.5 shrink-0" /> Sign in to manage members.
          </div>
        ) : null}
        {error ? (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Member</th>
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Department</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                        {busyId === m.id && pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : initials(m.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-fg">{m.name}</div>
                        <div className="truncate text-xs text-muted">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {canSave ? (
                      <select value={m.role} disabled={pending} onChange={(e) => changeRole(m.id, e.target.value as UserRole)} className={selectCls}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    ) : (
                      <Badge tone={roleTone[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted">
                    {m.department ? DEPARTMENT_LABEL[m.department] : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {canSave ? (
                      <select value={m.status} disabled={pending} onChange={(e) => changeStatus(m.id, e.target.value as Member["status"])} className={selectCls}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ").toLowerCase()}</option>)}
                      </select>
                    ) : (
                      <Badge tone={statusTone[m.status]}>{m.status.replace(/_/g, " ").toLowerCase()}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {inviting ? <InviteDialog onClose={() => setInviting(false)} onInvited={onInvited} /> : null}
    </div>
  );
}

function InviteDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (m: Member) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("STAFF");
  const [department, setDepartment] = useState<Department>("DESIGN");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inputCls =
    "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await inviteMemberAction({ name, email, role, department });
      if (res.ok) onInvited({ id: res.data.id, name: name.trim(), email: email.trim().toLowerCase(), role, department, status: "ACTIVE" });
      else setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-fg">Invite member</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium text-muted">Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Jane Doe" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@zenarch.ae" className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-muted">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={`${inputCls} px-2`}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">Department</span>
              <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={`${inputCls} px-2`}>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-faint">Creates a user with no password set — they sign in once an admin sets a password.</p>
          {error ? <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> {error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2">Cancel</button>
          <button type="button" onClick={submit} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Invite
          </button>
        </div>
      </div>
    </div>
  );
}
