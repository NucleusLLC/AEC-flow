"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ProjectSelect } from "@/components/projects/project-select";
import { formatCurrency } from "@/lib/format";
import { materialTotal } from "@/lib/materials/calc";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_STATUSES,
  MATERIAL_STATUS_LABEL,
  type MaterialSelectionDTO,
  type MaterialSelectionInput,
  type MaterialSelectionStatus,
} from "@/lib/materials/types";
import { createMaterialAction, updateMaterialAction } from "@/app/(app)/materials/actions";

type Option = { id: string; name: string };
type PoOption = { id: string; poNumber: string; vendorName: string };

const CURRENCIES = ["USD", "AWG", "EUR", "ANG"];

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

export function MaterialForm({
  projects: projectProp,
  purchaseOrders,
  mode,
  initial,
}: {
  projects: Option[];
  purchaseOrders: PoOption[];
  mode: "new" | "edit";
  initial?: MaterialSelectionDTO;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Grown when a project is created from the picker.
  const [projects, setProjects] = useState(projectProp);

  const [category, setCategory] = useState(initial?.category ?? MATERIAL_CATEGORIES[0]);
  const [productName, setProductName] = useState(initial?.productName ?? "");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [modelNumber, setModelNumber] = useState(initial?.modelNumber ?? "");
  const [finish, setFinish] = useState(initial?.finish ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [specification, setSpecification] = useState(initial?.specification ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [status, setStatus] = useState<MaterialSelectionStatus>(initial?.status ?? "PROPOSED");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 0));
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [unitCost, setUnitCost] = useState(String(initial?.unitCost ?? 0));
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [purchaseOrderId, setPurchaseOrderId] = useState(initial?.purchaseOrderId ?? "");
  const [approvedBy, setApprovedBy] = useState(initial?.approvedBy ?? "");
  const [selectedDate, setSelectedDate] = useState(initial?.selectedDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const total = useMemo(
    () => materialTotal({ quantity: Number(quantity) || 0, unitCost: Number(unitCost) || 0 }),
    [quantity, unitCost],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const project = projects.find((p) => p.id === projectId);
    const input: MaterialSelectionInput = {
      projectId: projectId || null,
      projectName: project?.name ?? null,
      category,
      location: location || null,
      productName,
      manufacturer: manufacturer || null,
      modelNumber: modelNumber || null,
      finish: finish || null,
      specification: specification || null,
      status,
      currency,
      quantity: Number(quantity) || 0,
      unit: unit || null,
      unitCost: Number(unitCost) || 0,
      supplier: supplier || null,
      purchaseOrderId: purchaseOrderId || null,
      approvedBy: approvedBy || null,
      selectedDate: selectedDate || null,
      notes: notes || null,
    };
    start(async () => {
      const res =
        mode === "edit" && initial
          ? await updateMaterialAction(initial.id, input)
          : await createMaterialAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/materials/${res.id}`);
      router.refresh();
    });
  }

  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 2 });

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title="Product" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
              {MATERIAL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Product / material *</label>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} className={field} placeholder="Engineered oak flooring" />
          </div>
          <div>
            <label className={label}>Manufacturer</label>
            <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={field} placeholder="Kährs" />
          </div>
          <div>
            <label className={label}>Model / SKU</label>
            <input value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} className={field} placeholder="153NABEK50KW0" />
          </div>
          <div>
            <label className={label}>Finish / colour</label>
            <input value={finish} onChange={(e) => setFinish(e.target.value)} className={field} placeholder="Natural oil" />
          </div>
          <div>
            <label className={label}>Location / area</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={field} placeholder="Ground floor, living" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Specification</label>
            <input value={specification} onChange={(e) => setSpecification(e.target.value)} className={field} placeholder="15mm, brushed, matte lacquer, EN 13489" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Selection" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          {/* Optional — a material selection need not belong to a project — so "— None —"
              stays a real choice. It is still creatable: wanting to file this
              against a project that does not exist yet is the common case, and
              leaving is the only thing the old select allowed. */}
          <ProjectSelect
            label="Project"
            projects={projects}
            value={projectId}
            onChange={setProjectId}
            onCreated={(p) => setProjects((prev) => [...prev, { id: p.id, name: p.projectName }])}
            allowEmpty
            placeholder="— None —"
          />
          <div>
            <label className={label}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as MaterialSelectionStatus)} className={field}>
              {MATERIAL_STATUSES.map((s) => (
                <option key={s} value={s}>{MATERIAL_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Selected date</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Approved by</label>
            <input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className={field} placeholder="Client / architect" />
          </div>
          <div>
            <label className={label}>Supplier</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={field} placeholder="Acme Supplies" />
          </div>
          <div>
            <label className={label}>Linked purchase order</label>
            <select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} className={field}>
              <option value="">— None —</option>
              {purchaseOrders.map((p) => (
                <option key={p.id} value={p.id}>{p.poNumber} · {p.vendorName}</option>
              ))}
            </select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cost" />
        <CardBody className="grid items-end gap-4 sm:grid-cols-4">
          <div>
            <label className={label}>Quantity</label>
            <input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${field} text-right`} />
          </div>
          <div>
            <label className={label}>Unit</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={field} placeholder="m²" />
          </div>
          <div>
            <label className={label}>Unit cost</label>
            <input type="number" step="any" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={`${field} text-right`} />
          </div>
          <div>
            <label className={label}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4 flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-4 py-2.5 text-sm">
            <span className="text-muted">Extended cost</span>
            <span className="text-base font-semibold tabular-nums text-fg">{money(total)}</span>
          </div>
          <div className="sm:col-span-4">
            <label className={label}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${field} h-auto py-2`} />
          </div>
        </CardBody>
      </Card>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add selection"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
