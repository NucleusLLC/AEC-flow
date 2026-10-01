"use client";

/**
 * Client picker that can create the client. See `components/forms/creatable-select`
 * for why this pattern exists at all.
 *
 * MINIMUM VIABLE CLIENT. A new client must carry CLIENT NAME, EMAIL and CELL
 * NUMBER (`lib/clients/new-client.ts`, enforced again by `saveClient`);
 * everything else on `ClientWriteInput` has a sensible default that the full
 * `/clients/new` form uses anyway (type PRIVATE, status ACTIVE, no addresses).
 * So this asks for those three and nothing else — the user is halfway through
 * booking a schedule, and a second full client form is not an improvement. The
 * record is a real client row, editable in full at `/clients/<id>` later.
 * `onCreated` hands back the email and cell too, so a host with its own
 * recipient field (a document's "Their email") can fill it in.
 *
 * `by` exists because two conventions coexist in the codebase: `ProjectForm`
 * submits a client NAME which the server resolves (`resolveClientId`), while
 * `NewProjectPanel` tracks the id. Rather than change either, the picker knows
 * which key the host wants back.
 */

import { saveClient } from "@/app/(app)/clients/actions";
import { CreatableSelect } from "@/components/forms/creatable-select";
import { useT } from "@/components/i18n/language-provider";
import { validateNewClient } from "@/lib/clients/new-client";

export type ClientOption = { id: string; name: string };
/** What `onCreated` reports: the new row plus the contact it was created with. */
export type CreatedClient = ClientOption & { email: string; mobile: string };

export function ClientSelect({
  clients,
  value,
  onChange,
  by = "id",
  label,
  hint,
  id,
  className,
  labelClassName,
  allowEmpty,
  placeholder,
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
  /** The client link is optional on this form — see `CreatableSelect`. */
  allowEmpty?: boolean;
  placeholder?: string;
  onCreated?: (client: CreatedClient) => void;
}) {
  const t = useT();
  return (
    <CreatableSelect
      id={id}
      label={label ?? t("Client")}
      hint={hint}
      className={className}
      labelClassName={labelClassName}
      allowEmpty={allowEmpty}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      options={clients.map((c) => ({ value: by === "id" ? c.id : c.name, label: c.name }))}
      addLabel={t("＋ Add a new client")}
      create={{
        title: t("New client"),
        hint: t("Saved as an active client — fill in the rest on the client page later."),
        submitLabel: t("Add client"),
        fields: [
          {
            name: "name",
            label: t("CLIENT NAME"),
            placeholder: t("e.g. Emaar Developments"),
            required: true,
            wide: true,
          },
          // One per row: these pickers often sit in a narrow column (a document's
          // "Who and what" card), where two-up squeezes an address to nothing.
          {
            name: "email",
            label: t("EMAIL"),
            type: "email",
            placeholder: "projects@client.ae",
            required: true,
            wide: true,
          },
          {
            name: "mobile",
            label: t("CELL NUMBER"),
            type: "tel",
            placeholder: "+297 560 0000",
            required: true,
            wide: true,
          },
        ],
        validate: (draft) => {
          const checked = validateNewClient(draft);
          return checked.ok ? null : checked.errors;
        },
        submit: async (draft) => {
          const res = await saveClient("new", {
            name: draft.name,
            companyName: null,
            contactPerson: null,
            email: draft.email || null,
            phone: null,
            mobile: draft.mobile || null,
            website: null,
            taxNumber: null,
            type: "PRIVATE",
            status: "ACTIVE",
            tags: [],
            notes: null,
            addresses: [],
          });
          if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };
          // `onCreated` reports the real id even when the host tracks names, so
          // a caller keeping its own copy of the list does not have to guess it.
          // Email and cell come back as the server will have stored them.
          const stored = validateNewClient(draft);
          onCreated?.({
            id: res.id,
            name: stored.ok ? stored.name : draft.name,
            email: stored.ok ? stored.email : draft.email,
            mobile: stored.ok ? stored.mobile : draft.mobile,
          });
          return {
            ok: true,
            option: { value: by === "id" ? res.id : draft.name, label: draft.name },
          };
        },
      }}
    />
  );
}
