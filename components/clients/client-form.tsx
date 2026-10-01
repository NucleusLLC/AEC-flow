"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  CLIENT_TYPE_LABEL,
  type ClientType,
  type ClientStatus,
  type ClientWriteInput,
} from "@/lib/data/clients.types";
import { saveClient } from "@/app/(app)/clients/actions";
import { useT } from "@/components/i18n/language-provider";
import { validateNewClient, type NewClientErrors, type NewClientField } from "@/lib/clients/new-client";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";
const invalidClass = " border-red-500 focus:border-red-500 focus:ring-red-500/15";

/** The message under a field the server or the mirror check refused. */
function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="mt-1 flex items-start gap-1 text-xs text-red-600">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      {msg}
    </p>
  );
}

const TYPES = Object.keys(CLIENT_TYPE_LABEL) as ClientType[];
const STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PROSPECT: "Prospect",
};
const STATUSES = Object.keys(STATUS_LABEL) as ClientStatus[];

/** Flat, form-shaped values used to prefill the fields in edit mode. */
export type ClientFormValues = {
  name: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  taxNumber: string;
  type: ClientType;
  status: ClientStatus;
  tags: string;
  notes: string;
  addressLabel: string;
  line1: string;
  city: string;
  emirate: string;
  country: string;
};

export function ClientForm({
  mode = "new",
  clientId,
  initial,
}: {
  mode?: "new" | "edit";
  clientId?: string;
  initial?: ClientFormValues;
} = {}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // CLIENT NAME, EMAIL and CELL NUMBER are required on CREATE only — a client
  // from before the rule may lack email or cell and must still save on edit.
  const isNew = mode === "new";
  const [fieldErrors, setFieldErrors] = useState<NewClientErrors>({});
  const fieldErr = (f: NewClientField) => fieldErrors[f];
  const invalid = (f: NewClientField) =>
    fieldErrors[f] ? { "aria-invalid": true as const, "aria-describedby": `${f}-error` } : {};

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: ClientWriteInput = {
      id: clientId,
      name: String(fd.get("name") ?? ""),
      companyName: (fd.get("companyName") as string) || null,
      contactPerson: (fd.get("contactPerson") as string) || null,
      email: (fd.get("email") as string) || null,
      phone: (fd.get("phone") as string) || null,
      mobile: (fd.get("mobile") as string) || null,
      website: (fd.get("website") as string) || null,
      taxNumber: (fd.get("taxNumber") as string) || null,
      type: (fd.get("type") as ClientType) || "PRIVATE",
      status: (fd.get("status") as ClientStatus) || "ACTIVE",
      tags: String(fd.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: (fd.get("notes") as string) || null,
      addresses: [
        {
          label: String(fd.get("addressLabel") ?? ""),
          line1: String(fd.get("line1") ?? ""),
          city: (fd.get("city") as string) || null,
          emirate: (fd.get("emirate") as string) || null,
          country: (fd.get("country") as string) || "UAE",
          isPrimary: true,
        },
      ],
    };

    setError(null);
    if (isNew) {
      // Same rules the server applies — shown beside the fields before the trip.
      const checked = validateNewClient(payload);
      if (!checked.ok) {
        const marks: NewClientErrors = {};
        for (const [k, v] of Object.entries(checked.errors) as [NewClientField, string][]) {
          marks[k] = t(v);
        }
        setFieldErrors(marks);
        const first = (["name", "email", "mobile"] as const).find((f) => marks[f]);
        if (first) document.getElementById(first)?.focus();
        return;
      }
    }
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveClient(mode, payload);
      if (res.ok) {
        router.push(`/clients/${res.id}`);
        router.refresh();
      } else if (res.fieldErrors && Object.values(res.fieldErrors).some(Boolean)) {
        setFieldErrors(res.fieldErrors);
      } else {
        setError(res.error);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-5 py-4">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-red-800">{t("Could not save client.")}</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Core */}
      <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">{t("Client details")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="name">
              {t("CLIENT NAME")} *
            </label>
            <input
              id="name"
              name="name"
              required
              className={inputClass + (fieldErr("name") ? invalidClass : "")}
              placeholder={t("e.g. Emaar Developments")}
              defaultValue={initial?.name}
              {...invalid("name")}
            />
            <FieldError id="name-error" msg={fieldErr("name")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="email">
              {t("EMAIL")}
              {isNew ? " *" : null}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              /* Two addresses are normal here: a married couple, two partners in
               * a firm. Without `multiple` the browser refuses the second one. */
              multiple
              required={isNew}
              autoComplete="email"
              className={inputClass + (fieldErr("email") ? invalidClass : "")}
              placeholder="her@example.com, him@example.com"
              defaultValue={initial?.email}
              {...invalid("email")}
            />
            {fieldErr("email") ? (
              <FieldError id="email-error" msg={fieldErr("email")} />
            ) : (
              <p className="mt-1 text-xs text-faint">
                {t("More than one? Separate them with a comma.")}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="mobile">
              {t("CELL NUMBER")}
              {isNew ? " *" : null}
            </label>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              autoComplete="tel"
              required={isNew}
              className={inputClass + (fieldErr("mobile") ? invalidClass : "")}
              placeholder="+297 560 0000"
              defaultValue={initial?.mobile}
              {...invalid("mobile")}
            />
            <FieldError id="mobile-error" msg={fieldErr("mobile")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="companyName">
              {t("Legal / company name")}
            </label>
            <input id="companyName" name="companyName" className={inputClass} placeholder={t("e.g. Emaar Properties PJSC")} defaultValue={initial?.companyName} />
          </div>
          <div>
            <label className={labelClass} htmlFor="contactPerson">
              {t("Primary contact")}
            </label>
            <input id="contactPerson" name="contactPerson" className={inputClass} placeholder={t("e.g. Layla Hassan")} defaultValue={initial?.contactPerson} />
          </div>
          <div>
            <label className={labelClass} htmlFor="phone">
              {t("Phone")}
            </label>
            <input id="phone" name="phone" className={inputClass} placeholder="+971 4 000 0000" defaultValue={initial?.phone} />
          </div>
          <div>
            <label className={labelClass} htmlFor="website">
              {t("Website")}
            </label>
            <input id="website" name="website" className={inputClass} placeholder="client.com" defaultValue={initial?.website} />
          </div>
          <div>
            <label className={labelClass} htmlFor="taxNumber">
              {t("Tax number (TRN)")}
            </label>
            <input id="taxNumber" name="taxNumber" className={inputClass} placeholder="1001234567000XX" defaultValue={initial?.taxNumber} />
          </div>
          <div>
            <label className={labelClass} htmlFor="type">
              {t("Type")}
            </label>
            <select id="type" name="type" className={inputClass} defaultValue={initial?.type ?? "PRIVATE"}>
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(CLIENT_TYPE_LABEL[ty])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="status">
              {t("Status")}
            </label>
            <select id="status" name="status" className={inputClass} defaultValue={initial?.status ?? "ACTIVE"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(STATUS_LABEL[s])}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="tags">
              {t("Tags")}
            </label>
            <input id="tags" name="tags" className={inputClass} placeholder={t("Comma-separated, e.g. Key Account, Developer")} defaultValue={initial?.tags} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="notes">
              {t("Notes")}
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15"
              placeholder={t("Relationship notes, preferences, etc.")}
              defaultValue={initial?.notes}
            />
          </div>
        </div>
      </div>

      {/* Primary address */}
      <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">{t("Primary address")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="addressLabel">
              {t("Label")}
            </label>
            <input id="addressLabel" name="addressLabel" className={inputClass} placeholder={t("e.g. Head Office")} defaultValue={initial?.addressLabel} />
          </div>
          <div>
            <label className={labelClass} htmlFor="line1">
              {t("Address line")}
            </label>
            <input id="line1" name="line1" className={inputClass} placeholder={t("Building, street")} defaultValue={initial?.line1} />
          </div>
          <div>
            <label className={labelClass} htmlFor="city">
              {t("City")}
            </label>
            <input id="city" name="city" className={inputClass} placeholder="Dubai" defaultValue={initial?.city} />
          </div>
          <div>
            <label className={labelClass} htmlFor="emirate">
              {t("State")}
            </label>
            <input id="emirate" name="emirate" className={inputClass} placeholder={t("State / Province")} defaultValue={initial?.emirate} />
          </div>
          <div>
            <label className={labelClass} htmlFor="country">
              {t("Country")}
            </label>
            <input id="country" name="country" className={inputClass} defaultValue={initial?.country ?? "UAE"} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/clients"
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          {t("Cancel")}
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t("Saving…") : mode === "new" ? t("Create client") : t("Save changes")}
        </button>
      </div>
    </form>
  );
}
