"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SaveControl } from "@/components/development/save-control";
import { computeUnit, sum } from "@/lib/development/calc";
import type { UnitType, UnitCostComponent } from "@/lib/data/development.types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { uid } from "@/components/projects/dashboard/hooks";

const numInput =
  "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-sm tabular-nums text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";
const cell = "border-b border-border px-2 py-1.5";

function UnitCard({ unit, onChange, onRemove, currency }: { unit: UnitType; onChange: (u: UnitType) => void; onRemove: () => void; currency: string }) {
  const setComp = (id: string, k: keyof UnitCostComponent, v: number | string) =>
    onChange({ ...unit, components: unit.components.map((c) => (c.id === id ? { ...c, [k]: v } : c)) });
  const addComp = () =>
    onChange({ ...unit, components: [...unit.components, { id: uid("comp"), unitTypeId: unit.id, name: "Component", area: 0, constructionCostPerM2: 0, salesPricePerM2: 0, sortOrder: unit.components.length }] });
  const removeComp = (id: string) => onChange({ ...unit, components: unit.components.filter((c) => c.id !== id) });

  const res = useMemo(() => computeUnit(unit), [unit]);

  return (
    <Card>
      <CardHeader
        title={unit.name}
        subtitle={`${unit.quantity} units`}
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              Qty
              <input type="number" min={1} className="h-8 w-16 rounded-lg border border-border bg-surface px-2 text-right text-sm" value={unit.quantity} onChange={(e) => onChange({ ...unit, quantity: Number(e.target.value) })} />
            </label>
            <button type="button" onClick={onRemove} className="text-faint hover:text-red-600" aria-label="Remove unit type"><Trash2 className="h-4 w-4" /></button>
          </div>
        }
      />
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-2 py-2 font-medium">Component</th>
                <th className="px-2 py-2 text-right font-medium">Area m²</th>
                <th className="px-2 py-2 text-right font-medium">Constr. /m²</th>
                <th className="px-2 py-2 text-right font-medium">Sales /m²</th>
                <th className="px-2 py-2 text-right font-medium">Cost</th>
                <th className="px-2 py-2 text-right font-medium">Sales</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {unit.components.map((c) => (
                <tr key={c.id} className="even:bg-surface-2/40">
                  <td className={cell}><input className="h-8 w-32 rounded border border-transparent bg-transparent px-1.5 text-sm hover:border-border focus:border-brand focus:bg-surface focus:outline-none" value={c.name} onChange={(e) => setComp(c.id, "name", e.target.value)} /></td>
                  <td className={cell}><input type="number" className={numInput} value={c.area} onChange={(e) => setComp(c.id, "area", Number(e.target.value))} /></td>
                  <td className={cell}><input type="number" className={numInput} value={c.constructionCostPerM2} onChange={(e) => setComp(c.id, "constructionCostPerM2", Number(e.target.value))} /></td>
                  <td className={cell}><input type="number" className={numInput} value={c.salesPricePerM2} onChange={(e) => setComp(c.id, "salesPricePerM2", Number(e.target.value))} /></td>
                  <td className={`${cell} text-right tabular-nums text-muted`}>{formatCurrency(c.area * c.constructionCostPerM2, currency)}</td>
                  <td className={`${cell} text-right tabular-nums text-fg`}>{formatCurrency(c.area * c.salesPricePerM2, currency)}</td>
                  <td className={cell}><button type="button" onClick={() => removeComp(c.id)} className="text-faint hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addComp} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><Plus className="h-3.5 w-3.5" /> Add component</button>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Area / unit" value={`${formatNumber(res.totalArea)} m²`} />
          <Tile label="Cost / unit" value={formatCurrency(res.constructionCostPerUnit, currency)} />
          <Tile label="Sales / unit" value={formatCurrency(res.salesPricePerUnit, currency)} />
          <Tile label="Profit / unit" value={formatCurrency(res.profitPerUnit, currency)} accent />
          <Tile label="Margin" value={`${res.marginPct.toFixed(1)}%`} />
          <Tile label={`Total cost (×${unit.quantity})`} value={formatCurrency(res.totalConstructionCost, currency)} />
          <Tile label={`Total sales (×${unit.quantity})`} value={formatCurrency(res.totalSalesPrice, currency)} />
          <Tile label="Total profit" value={formatCurrency(res.totalProfit, currency)} accent />
        </div>
      </CardBody>
    </Card>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${accent ? "text-emerald-700" : "text-fg"}`}>{value}</div>
    </div>
  );
}

export function UnitCalculator({ projectId, unitTypes, currency }: { projectId: string; unitTypes: UnitType[]; currency: string }) {
  const [units, setUnits] = useState(unitTypes);
  const update = (u: UnitType) => setUnits((p) => p.map((x) => (x.id === u.id ? u : x)));
  const remove = (id: string) => setUnits((p) => p.filter((x) => x.id !== id));
  const add = () =>
    setUnits((p) => [...p, { id: uid("unit"), projectId, name: "New unit type", quantity: 1, components: [{ id: uid("comp"), unitTypeId: "", name: "Floorplan", area: 0, constructionCostPerM2: 0, salesPricePerM2: 0, sortOrder: 0 }] }]);

  const grandProfit = sum(units.map((u) => computeUnit(u).totalProfit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
        <div className="text-sm">
          <span className="text-muted">Total profit across all unit types: </span>
          <span className="font-semibold text-emerald-700">{formatCurrency(grandProfit, currency)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={add} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"><Plus className="h-4 w-4" /> Add unit type</button>
          <SaveControl url={`/api/development/${projectId}/units`} build={() => ({ unitTypes: units })} label="Save units" />
        </div>
      </div>
      {units.length === 0 ? (
        <Card><CardBody className="py-12 text-center text-sm text-muted">No unit types — add a building product, or this project may be parcel-only.</CardBody></Card>
      ) : (
        units.map((u) => <UnitCard key={u.id} unit={u} onChange={update} onRemove={() => remove(u.id)} currency={currency} />)
      )}
    </div>
  );
}
