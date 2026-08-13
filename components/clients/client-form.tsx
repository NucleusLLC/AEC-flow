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

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      website: (fd.get("website") as string) || null,
      taxNumber: (fd.get("taxNumber") as string) || null,
      type: (fd.get("type") as ClientType) || "PRIVATE",
      status: (fd.get("status") as ClientStatus) || "ACTIVE",
      tags: String(fd.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim())
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
    startTransition(async () => {
      const res = await saveClient(mode, payload);
      if (res.ok) {
        router.push(`/clients/${res.id}`);
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
            <p className="font-medium text-red-800">Could not save client.</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Core */}
      <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">Client details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="name">
              Client name *
            </label>
            <input id="name" name="name" required className={inputClass} placeholder="e.g. Emaar Developments" defaultValue={initial?.name} />
          </div>
          <div>
            <label className={labelClass} htmlFor="companyName">
              Legal / company name
            </label>
            <input id="companyName" name="companyName" className={inputClass} placeholder="e.g. Emaar Properties PJSC" defaultValue={initial?.companyName} />
          </div>
          <div>
            <label className={labelClass} htmlFor="contactPerson">
              Primary contact
            </label>
            <input id="contactPerson" name="contactPerson" className={inputClass} placeholder="e.g. Layla Hassan" defaultValue={initial?.contactPerson} />
          </div>
          <div>
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" className={inputClass} placeholder="projects@client.ae" defaultValue={initial?.email} />
          </div>
          <div>
            <label className={labelClass} htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" className={inputClass} placeholder="+971 4 000 0000" defaultValue={initial?.phone} />
          </div>
          <div>
            <label className={labelClass} htmlFor="website">
              Website
            </label>
            <input id="website" name="website" className={inputClass} placeholder="client.com" defaultValue={initial?.website} />
          </div>
          <div>
            <label className={labelClass} htmlFor="taxNumber">
              Tax number (TRN)
            </label>
            <input id="taxNumber" name="taxNumber" className={inputClass} placeholder="1001234567000XX" defaultValue={initial?.taxNumber} />
          </div>
          <div>
            <label className={labelClass} htmlFor="type">
              Type
            </label>
            <select id="type" name="type" className={inputClass} defaultValue={initial?.type ?? "PRIVATE"}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {CLIENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="status">
              Status
            </label>
            <select id="status" name="status" className={inputClass} defaultValue={initial?.status ?? "ACTIVE"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="tags">
              Tags
            </label>
            <input id="tags" name="tags" className={inputClass} placeholder="Comma-separated, e.g. Key Account, Developer" defaultValue={initial?.tags} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15"
              placeholder="Relationship notes, preferences, etc."
              defaultValue={initial?.notes}
            />
          </div>
        </div>
      </div>

      {/* Primary address */}
      <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">Primary address</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="addressLabel">
              Label
            </label>
            <input id="addressLabel" name="addressLabel" className={inputClass} placeholder="e.g. Head Office" defaultValue={initial?.addressLabel} />
          </div>
          <div>
            <label className={labelClass} htmlFor="line1">
              Address line
            </label>
            <input id="line1" name="line1" className={inputClass} placeholder="Building, street" defaultValue={initial?.line1} />
          </div>
          <div>
            <label className={labelClass} htmlFor="city">
              City
            </label>
            <input id="city" name="city" className={inputClass} placeholder="Dubai" defaultValue={initial?.city} />
          </div>
          <div>
            <label className={labelClass} htmlFor="emirate">
              State
            </label>
            <input id="emirate" name="emirate" className={inputClass} placeholder="State / Province" defaultValue={initial?.emirate} />
          </div>
          <div>
            <label className={labelClass} htmlFor="country">
              Country
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
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "new" ? "Create client" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
