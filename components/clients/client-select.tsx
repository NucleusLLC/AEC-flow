"use client";

/**
 * Client picker that can create the client. See `components/forms/creatable-select`
 * for why this pattern exists at all.
 *
 * MINIMUM VIABLE CLIENT. `saveClient` requires only a name; everything else on
 * `ClientWriteInput` has a sensible default that the full `/clients/new` form
 * uses anyway (type PRIVATE, status ACTIVE, no addresses). So this asks for the
 * name and offers an email, and nothing else — the user is halfway through
 * booking a schedule, and a second full client form is not an improvement. The
 * record is a real client row, editable in full at `/clients/<id>` later.
 *
 * `by` exists because two conventions coexist in the codebase: `ProjectForm`
 * submits a client NAME which the server resolves (`resolveClientId`), while
 * `NewProjectPanel` tracks the id. Rather than change either, the picker knows
 * which key the host wants back.
 */

import { saveClient } from "@/app/(app)/clients/actions";
import { CreatableSelect } from "@/components/forms/creatable-select";

export type ClientOption = { id: string; name: string };

export function ClientSelect({
  clients,
  value,
  onChange,
  by = "id",
  label = "Client",
  hint,
  id,
  className,
  labelClassName,
  onCreated,
}: {
  clients: ClientOption[];
  value: string;
  onChange: (value: string) => void;
  /** Which key the host tracks — record id, or display name for name-resolving actions. */
  by?: "id" | "name";
  label?: string;
  hint?: string;
  id?: string;
  className?: string;
  labelClassName?: string;
  onCreated?: (client: ClientOption) => void;
}) {
  return (
    <CreatableSelect
      id={id}
      label={label}
      hint={hint}
      className={className}
      labelClassName={labelClassName}
      value={value}
      onChange={onChange}
      options={clients.map((c) => ({ value: by === "id" ? c.id : c.name, label: c.name }))}
      addLabel="＋ Add a new client"
      create={{
        title: "New client",
        hint: "Saved as an active client — fill in the rest on the client page later.",
        submitLabel: "Add client",
        fields: [
          { name: "name", label: "Client name", placeholder: "e.g. Emaar Developments", required: true },
          { name: "email", label: "Email", type: "email", placeholder: "projects@client.ae" },
        ],
        submit: async (draft) => {
          const res = await saveClient("new", {
            name: draft.name,
            companyName: null,
            contactPerson: null,
            email: draft.email || null,
            phone: null,
            website: null,
            taxNumber: null,
            type: "PRIVATE",
            status: "ACTIVE",
            tags: [],
            notes: null,
            addresses: [],
          });
          if (!res.ok) return { ok: false, error: res.error };
          // `onCreated` reports the real id even when the host tracks names, so
          // a caller keeping its own copy of the list does not have to guess it.
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
