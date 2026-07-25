"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  ORDER_STATUS_LABEL,
  type OrderStatus,
  type OrderWriteInput,
} from "@/lib/data/orders.types";
import { saveOrder } from "@/app/(app)/orders/actions";
import { getSystemCurrency } from "@/lib/format";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

/** Prefill values for edit mode; shape mirrors OrderRecord's form-relevant fields. */
export type OrderFormValues = {
  /** cuid — used only for back/cancel navigation to the detail route. */
  id?: string;
  /** Business key (ORD-YYYY-NNN) — carried on the payload so updateOrder keys on it. */
  orderNumber?: string;
  title: string;
  clientName: string;
  serviceType: string;
  fee: number;
  status: OrderStatus;
  proposalRef: string;
  expectedStartDate: string;
  expectedEndDate: string;
  scopeSummary: string;
  siteAddress: string;
  notes: string;
};

export function OrderForm({
  clients,
  mode = "new",
  initial,
}: {
  clients: string[];
  mode?: "new" | "edit";
  initial?: OrderFormValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: OrderWriteInput = {
      // In edit mode, carry the unique business key so updateOrder can locate the row.
      orderNumber: mode === "edit" ? (initial?.orderNumber ?? null) : null,
      title: String(fd.get("title") ?? ""),
      clientName: String(fd.get("clientName") ?? ""),
      serviceType: (fd.get("serviceType") as string) || null,
      fee: Number(fd.get("fee")) || 0,
      status: ((fd.get("status") as OrderStatus) || "DRAFT"),
      proposalRef: (fd.get("proposalRef") as string) || null,
      expectedStartDate: (fd.get("expectedStartDate") as string) || null,
      expectedEndDate: (fd.get("expectedEndDate") as string) || null,
      scopeSummary: (fd.get("scopeSummary") as string) || null,
      siteAddress: (fd.get("siteAddress") as string) || null,
      // The form has no notes field; carry the existing value so an edit
      // doesn't blank out notes captured elsewhere.
      notes: mode === "edit" ? (initial?.notes ?? null) : null,
    };

    setError(null);
    startTransition(async () => {
      const res = await saveOrder(mode, input);
      if (res.ok) {
        router.push(`/orders/${res.id}`);
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
              Could not {mode === "edit" ? "update" : "save"} order.
            </p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">Order details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="title">
              Title *
            </label>
            <input id="title" name="title" required className={inputClass} placeholder="e.g. Marina Heights Tower — Phase 3" defaultValue={initial?.title ?? ""} />
          </div>
          <div>
            <label className={labelClass} htmlFor="clientName">
              Client
            </label>
            <select id="clientName" name="clientName" className={inputClass} defaultValue={initial?.clientName ?? clients[0] ?? ""}>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="serviceType">
              Service type
            </label>
            <input id="serviceType" name="serviceType" className={inputClass} placeholder="e.g. Full Design Services" defaultValue={initial?.serviceType ?? ""} />
          </div>
          <div>
            <label className={labelClass} htmlFor="fee">
              Fee ({getSystemCurrency()})
            </label>
            <input id="fee" name="fee" type="number" min="0" step="1000" className={inputClass} placeholder="0" defaultValue={initial?.fee ?? ""} />
          </div>
          <div>
            <label className={labelClass} htmlFor="status">
              Status
            </label>
            <select id="status" name="status" className={inputClass} defaultValue={initial?.status ?? "DRAFT"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="proposalRef">
              Source proposal ref
            </label>
            <input id="proposalRef" name="proposalRef" className={inputClass} placeholder="e.g. PRO-2026-040" defaultValue={initial?.proposalRef ?? ""} />
          </div>
          <div>
            <label className={labelClass} htmlFor="expectedStartDate">
              Expected start
            </label>
            <input id="expectedStartDate" name="expectedStartDate" type="date" className={inputClass} defaultValue={initial?.expectedStartDate ?? ""} />
          </div>
          <div>
            <label className={labelClass} htmlFor="expectedEndDate">
              Expected end
            </label>
            <input id="expectedEndDate" name="expectedEndDate" type="date" className={inputClass} defaultValue={initial?.expectedEndDate ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="siteAddress">
              Site address
            </label>
            <input id="siteAddress" name="siteAddress" className={inputClass} placeholder="e.g. Dubai Marina, Plot D2, Dubai" defaultValue={initial?.siteAddress ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="scopeSummary">
              Scope summary
            </label>
            <textarea
              id="scopeSummary"
              name="scopeSummary"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15"
              placeholder="Scope of services for this engagement…"
              defaultValue={initial?.scopeSummary ?? ""}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link
          href={mode === "edit" && initial?.id ? `/orders/${initial.id}` : "/orders"}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create order"}
        </button>
      </div>
    </form>
  );
}
