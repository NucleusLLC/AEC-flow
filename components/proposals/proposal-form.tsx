"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2, AlertCircle, ChevronUp, ChevronDown, Eye } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SectionHeader } from "@/components/proposals/ui";
import { ProposalPreviewModal } from "@/components/proposals/proposal-preview";
import {
  PROPOSAL_STATUS_LABEL,
  DISCIPLINE_LABEL,
  type ProposalStatus,
  type Discipline,
  type ProposalRecord,
  type ProposalWriteInput,
} from "@/lib/data/proposals.types";
import { saveProposal } from "@/app/(app)/proposals/actions";
import { formatCurrency, getSystemCurrency } from "@/lib/format";

type LineItemForm = {
  description: string;
  discipline: Discipline | "";
  amount: number;
  isOptional: boolean;
};
type MilestoneForm = { name: string; percentage: number };

export type ProposalFormValues = {
  title: string;
  clientId: string;
  owner: string;
  status: ProposalStatus;
  currency: string;
  validUntil: string;
  estimatedDuration: string;
  scopeSummary: string;
  exclusions: string;
  terms: string;
  lineItems: LineItemForm[];
  milestones: MilestoneForm[];
};

const OWNERS = ["Layla Hassan", "Omar Farouk", "Sara Khan", "Ahmed Nabil"];
const CURRENCIES = ["AWG", "AED", "USD", "EUR", "GBP"];

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";
const errCls = "mt-1 text-xs text-red-600";

function defaults(): ProposalFormValues {
  return {
    title: "",
    clientId: "",
    owner: OWNERS[0],
    status: "DRAFT",
    currency: getSystemCurrency(),
    validUntil: "",
    estimatedDuration: "",
    scopeSummary: "",
    exclusions: "",
    terms: "",
    lineItems: [{ description: "", discipline: "", amount: 0, isOptional: false }],
    milestones: [{ name: "Appointment", percentage: 30 }],
  };
}

export function ProposalForm({
  mode,
  clients,
  proposalRef,
  initial,
  backHref,
}: {
  mode: "new" | "edit";
  clients: { id: string; name: string }[];
  proposalRef: string;
  initial?: ProposalFormValues;
  backHref: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [preview, setPreview] = useState<ProposalRecord | null>(null);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ProposalFormValues>({ defaultValues: initial ?? defaults() });

  // Assemble a full record from the current form state so the live preview
  // renders exactly the document the client will receive.
  function buildPreviewRecord(): ProposalRecord {
    const v = getValues();
    const items = (v.lineItems ?? []).map((li, i) => ({
      id: `pv-li-${i}`,
      description: li.description,
      discipline: (li.discipline || null) as Discipline | null,
      amount: Number(li.amount) || 0,
      isOptional: !!li.isOptional,
      sortOrder: i,
    }));
    const committedTotal = items.filter((li) => !li.isOptional).reduce((n, li) => n + li.amount, 0);
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: "preview",
      refNumber: proposalRef,
      title: v.title,
      clientName: clients.find((c) => c.id === v.clientId)?.name ?? "Client to be selected",
      owner: v.owner,
      status: v.status,
      revision: 1,
      totalFee: committedTotal,
      currency: v.currency,
      sentAt: null,
      validUntil: v.validUntil || null,
      followUpDate: null,
      nextAction: null,
      createdAt: today,
      clientId: v.clientId || "",
      scopeSummary: v.scopeSummary || null,
      exclusions: v.exclusions || null,
      assumptions: null,
      terms: v.terms || null,
      estimatedDuration: v.estimatedDuration ? Number(v.estimatedDuration) : null,
      approvedAt: null,
      lastContactDate: null,
      followUpNotes: null,
      orderNumber: null,
      lineItems: items,
      milestones: (v.milestones ?? []).map((m, i) => ({
        id: `pv-ms-${i}`,
        name: m.name,
        percentage: Number(m.percentage) || 0,
        dueWeek: null,
      })),
    };
  }

  const lineItems = useFieldArray({ control, name: "lineItems" });
  const milestones = useFieldArray({ control, name: "milestones" });

  const watchedItems = useWatch({ control, name: "lineItems" });
  const watchedMilestones = useWatch({ control, name: "milestones" });
  const currency = useWatch({ control, name: "currency" });

  const committed = (watchedItems ?? [])
    .filter((li) => !li.isOptional)
    .reduce((n, li) => n + (Number(li.amount) || 0), 0);
  const optional = (watchedItems ?? [])
    .filter((li) => li.isOptional)
    .reduce((n, li) => n + (Number(li.amount) || 0), 0);
  const milestoneTotal = (watchedMilestones ?? []).reduce(
    (n, m) => n + (Number(m.percentage) || 0),
    0,
  );

  function onSubmit(values: ProposalFormValues) {
    setError(null);
    const payload: ProposalWriteInput = {
      ref: proposalRef,
      title: values.title,
      clientId: values.clientId,
      owner: values.owner,
      status: values.status,
      currency: values.currency,
      validUntil: values.validUntil,
      estimatedDuration: values.estimatedDuration ? Number(values.estimatedDuration) : null,
      scopeSummary: values.scopeSummary,
      exclusions: values.exclusions,
      terms: values.terms,
      totalFee: committed,
      lineItems: values.lineItems.map((li, i) => ({
        description: li.description,
        discipline: (li.discipline || null) as Discipline | null,
        amount: Number(li.amount) || 0,
        isOptional: !!li.isOptional,
        sortOrder: i,
      })),
      milestones: values.milestones.map((m) => ({
        name: m.name,
        percentage: Number(m.percentage) || 0,
      })),
    };
    startTransition(async () => {
      const res = await saveProposal(mode, payload);
      if (res.ok) {
        router.push(`/proposals/${res.ref}`);
        router.refresh();
      } else {
        setError(res.error);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-5 py-4">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <AlertCircle className="h-3.5 w-3.5" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-red-800">
              Couldn’t {mode === "new" ? "create" : "update"} the proposal.
            </p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionHeader title="Proposal" subtitle={`Reference ${proposalRef}`} />
            <CardBody className="space-y-4">
              <div>
                <label className={labelCls}>Title</label>
                <input
                  className={inputCls}
                  placeholder="e.g. Marina Heights Tower — Phase 2 Design"
                  {...register("title", { required: "Title is required", minLength: { value: 3, message: "Too short" } })}
                />
                {errors.title ? <p className={errCls}>{errors.title.message}</p> : null}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Client</label>
                  <select className={inputCls} defaultValue="" {...register("clientId", { required: "Select a client" })}>
                    <option value="" disabled>
                      Select a client…
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.clientId ? <p className={errCls}>{errors.clientId.message}</p> : null}
                </div>
                <div>
                  <label className={labelCls}>Owner</label>
                  <select className={inputCls} {...register("owner", { required: true })}>
                    {OWNERS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Scope summary</label>
                <textarea
                  className={`${inputCls} h-auto min-h-[88px] py-2`}
                  placeholder="What the fee covers…"
                  {...register("scopeSummary")}
                />
              </div>
            </CardBody>
          </Card>

          {/* Line items */}
          <Card>
            <SectionHeader
              title="Line Items"
              subtitle={`Committed ${formatCurrency(committed, currency)}${optional > 0 ? ` · +${formatCurrency(optional, currency)} optional` : ""}`}
              action={
                <button
                  type="button"
                  onClick={() => lineItems.append({ description: "", discipline: "", amount: 0, isOptional: false })}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg hover:bg-surface-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add item
                </button>
              }
            />
            <CardBody className="space-y-2">
              {lineItems.fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-12 items-center gap-2">
                  <input
                    className={`${inputCls} col-span-12 sm:col-span-4`}
                    placeholder="Description"
                    {...register(`lineItems.${i}.description` as const, { required: true })}
                  />
                  <select
                    className={`${inputCls} col-span-5 sm:col-span-3`}
                    {...register(`lineItems.${i}.discipline` as const)}
                  >
                    <option value="">Discipline…</option>
                    {(Object.keys(DISCIPLINE_LABEL) as Discipline[]).map((d) => (
                      <option key={d} value={d}>
                        {DISCIPLINE_LABEL[d]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className={`${inputCls} col-span-3 sm:col-span-2 text-right`}
                    placeholder="0"
                    {...register(`lineItems.${i}.amount` as const, { valueAsNumber: true })}
                  />
                  <label className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1 text-[11px] text-muted">
                    <input type="checkbox" {...register(`lineItems.${i}.isOptional` as const)} />
                    opt
                  </label>
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    <button
                      type="button"
                      onClick={() => lineItems.move(i, i - 1)}
                      disabled={i === 0}
                      className="flex h-4 w-5 items-center justify-center rounded text-faint hover:text-fg disabled:opacity-30"
                      aria-label="Move line item up"
                      title="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => lineItems.move(i, i + 1)}
                      disabled={i === lineItems.fields.length - 1}
                      className="flex h-4 w-5 items-center justify-center rounded text-faint hover:text-fg disabled:opacity-30"
                      aria-label="Move line item down"
                      title="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => lineItems.remove(i)}
                    disabled={lineItems.fields.length === 1}
                    className="col-span-1 inline-flex h-9 items-center justify-center rounded-lg text-faint hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove line item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* Milestones */}
          <Card>
            <SectionHeader
              title="Payment Milestones"
              subtitle={milestoneTotal === 100 ? "100% allocated" : `${milestoneTotal}% allocated`}
              action={
                <button
                  type="button"
                  onClick={() => milestones.append({ name: "", percentage: 0 })}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg hover:bg-surface-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add milestone
                </button>
              }
            />
            <CardBody className="space-y-2">
              {milestones.fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-12 items-center gap-2">
                  <input
                    className={`${inputCls} col-span-7 sm:col-span-8`}
                    placeholder="Milestone name"
                    {...register(`milestones.${i}.name` as const, { required: true })}
                  />
                  <div className="col-span-4 sm:col-span-3 flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={`${inputCls} text-right`}
                      placeholder="0"
                      {...register(`milestones.${i}.percentage` as const, { valueAsNumber: true })}
                    />
                    <span className="text-sm text-muted">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => milestones.remove(i)}
                    className="col-span-1 inline-flex h-9 items-center justify-center rounded-lg text-faint hover:text-red-600"
                    aria-label="Remove milestone"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {milestoneTotal !== 100 ? (
                <p className="text-xs text-amber-600">
                  Milestones add up to {milestoneTotal}% — they usually total 100% of the fee.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <SectionHeader title="Commercials" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} {...register("status", { required: true })}>
                    {(Object.keys(PROPOSAL_STATUS_LABEL) as ProposalStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {PROPOSAL_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Currency</label>
                  <select className={inputCls} {...register("currency", { required: true })}>
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Valid until</label>
                <input type="date" className={inputCls} {...register("validUntil")} />
              </div>
              <div>
                <label className={labelCls}>Estimated duration (weeks)</label>
                <input type="number" min={0} className={inputCls} placeholder="e.g. 24" {...register("estimatedDuration")} />
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Total fee</span>
                  <span className="font-semibold text-fg">{formatCurrency(committed, currency)}</span>
                </div>
                {optional > 0 ? (
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted">+ optional add-ons</span>
                    <span className="text-fg">{formatCurrency(optional, currency)}</span>
                  </div>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <SectionHeader title="Terms & Exclusions" />
            <CardBody className="space-y-4">
              <div>
                <label className={labelCls}>Exclusions</label>
                <textarea className={`${inputCls} h-auto min-h-[64px] py-2`} {...register("exclusions")} />
              </div>
              <div>
                <label className={labelCls}>Payment terms</label>
                <textarea className={`${inputCls} h-auto min-h-[64px] py-2`} {...register("terms")} />
              </div>
            </CardBody>
          </Card>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? "Saving…"
                : mode === "new"
                  ? "Create proposal"
                  : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(buildPreviewRecord())}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <Link
              href={backHref}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      <ProposalPreviewModal proposal={preview} open={preview !== null} onClose={() => setPreview(null)} />
    </form>
  );
}
