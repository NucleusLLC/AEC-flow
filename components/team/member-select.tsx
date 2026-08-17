"use client";

/**
 * Team-member picker that can create the member. See
 * `components/forms/creatable-select` for why this pattern exists at all.
 *
 * MINIMUM VIABLE MEMBER. `createTeamMember` needs a name and an email; role,
 * department, status, capacity and leave allowance all have the same defaults
 * the full `/team/new` form applies (STAFF / DESIGN / ACTIVE / 100%). So this
 * asks for two fields. `defaultRole` overrides the role because some pickers
 * only list managers, and a member created from one of those has to land in the
 * role that picker filters on. The row is a real `User`, editable in full at
 * `/team/<id>`.
 *
 * NOTE ON SEATS. `createTeamMember` refuses when the company has no free seat
 * ("No seats available — raise the seat limit…"). That message is surfaced
 * verbatim by the picker; it is a real business rule, not a dead end, and the
 * user can still cancel out and pick an existing member.
 */

import { saveTeamMember } from "@/app/(app)/team/actions";
import { CreatableSelect } from "@/components/forms/creatable-select";
import type { UserRole } from "@/lib/data/team.types";

export type MemberOption = { id: string; name: string };

export function MemberSelect({
  members,
  value,
  onChange,
  by = "id",
  label = "Team member",
  hint,
  allowEmpty,
  placeholder,
  defaultRole = "STAFF",
  id,
  className,
  labelClassName,
  onCreated,
}: {
  members: MemberOption[];
  value: string;
  onChange: (value: string) => void;
  /** Which key the host tracks — record id, or display name for name-resolving actions. */
  by?: "id" | "name";
  label?: string;
  hint?: string;
  /** The member link is optional on this form — see `CreatableSelect`. */
  allowEmpty?: boolean;
  placeholder?: string;
  /**
   * Role for a member created here. A project-manager picker should mint a
   * MANAGER, or the new person would not appear in that picker next time.
   */
  defaultRole?: UserRole;
  id?: string;
  className?: string;
  labelClassName?: string;
  onCreated?: (member: MemberOption) => void;
}) {
  return (
    <CreatableSelect
      id={id}
      label={label}
      hint={hint}
      allowEmpty={allowEmpty}
      placeholder={placeholder}
      className={className}
      labelClassName={labelClassName}
      value={value}
      onChange={onChange}
      options={members.map((m) => ({ value: by === "id" ? m.id : m.name, label: m.name }))}
      addLabel="＋ Add a new team member"
      create={{
        title: "New team member",
        hint: "Added as active staff on the design team — adjust role and capacity on the team page.",
        submitLabel: "Add member",
        fields: [
          { name: "name", label: "Full name", placeholder: "e.g. Mariam Al Suwaidi", required: true },
          { name: "email", label: "Email", type: "email", placeholder: "name@zenarch.net", required: true },
        ],
        submit: async (draft) => {
          const res = await saveTeamMember("new", {
            name: draft.name,
            email: draft.email,
            phone: null,
            role: defaultRole,
            discipline: null,
            department: "DESIGN",
            status: "ACTIVE",
            officeLocation: null,
            capacity: 100,
          });
          if (!res.ok) return { ok: false, error: res.error };
          onCreated?.({ id: res.id, name: draft.name });
          return {
            ok: true,
            option: { value: by === "id" ? res.id : draft.name, label: draft.name },
          };
        },
      }}
    />
  );
}
