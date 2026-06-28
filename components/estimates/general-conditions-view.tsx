"use client";

import { useRef, useState } from "react";
import { HardHat, Plus, Trash2, Save, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ESTIMATE_UNITS } from "@/lib/data/estimates.types";
import { sumGeneralConditions, type GeneralConditionItem } from "@/lib/data/general-conditions";
import { saveGeneralConditionsAction } from "@/app/(app)/estimates/actions";

const nf0 = (n: number) => Math.round(n).toLocaleString("en-US");
const UNITS = ["ls", "month", "week", "day", "no", ...ESTIMATE_UNITS];

const numCls =
  "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs tabular-nums text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30";

export function GeneralConditionsView({
  items,
  setItems,
  currency,
}: {
  items: GeneralConditionItem[];
  setItems: React.Dispatch<React.SetStateAction<GeneralConditionItem[]>>;
  currency: string;
}) {
  const seq = useRef(1);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<"saved" | string | null>(null);
  // Total project months drives the qty of every "month"-unit item.
  const [projectMonths, setProjectMonths] = useState<number>(
    () => items.find((i) => i.unit === "month")?.qty ?? 6,
  );
  const applyMonths = (m: number) => {
    setProjectMonths(m);
    setItems((a) => a.map((x) => (x.unit === "month" ? { ...x, qty: m } : x)));
  };

  async function onSave() {
    setSaving(true);
    setSaveMsg(null);
    const res = await saveGeneralConditionsAction(items);
    setSaving(false);
    setSaveMsg(res.ok ? "saved" : res.error);
  }

  const patch = (id: string, p: Partial<GeneralConditionItem>) => setItems((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const remove = (id: string) => setItems((a) => a.filter((x) => x.id !== id));
  const add = () => setItems((a) => [...a, { id: `gc-new-${seq.current++}`, name: "", unit: "ls", qty: 1, unitCost: 0, enabled: true }]);

  const total = sumGeneralConditions(items);
  const enabledCount = items.filter((g) => g.enabled).length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <HardHat className="h-4 w-4 text-brand" /> General Conditions / Overhead <span className="text-faint">(Preliminaries)</span>
        </div>
        <p className="text-xs text-muted">
          Project-wide indirect costs — insurance, site facilities, utilities. The enabled total feeds the estimate’s optional “General Conditions / Overhead” line.
        </p>
        <label className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-xs font-medium text-fg">
          <CalendarRange className="h-4 w-4 text-brand" /> Total Project Months
          <input
            type="number"
            min={0}
            value={projectMonths}
            onChange={(e) => applyMonths(Number(e.target.value) || 0)}
            title="Sets the Qty of every month-based item below"
            className="w-14 rounded-md border border-border bg-surface px-2 py-1 text-right text-xs tabular-nums text-fg outline-none focus:border-brand"
          />
        </label>
        <button type="button" onClick={add} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2">
          <Plus className="h-4 w-4" /> Add item
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
        {saveMsg === "saved" ? <span className="text-[11px] font-medium text-green-600">Saved ✓</span> : saveMsg ? <span className="text-[11px] text-red-600" title={saveMsg}>Save failed</span> : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-faint">
                <th className="border-b border-border px-2 py-1.5 text-center text-faint">On</th>
                <th className="border-b border-border px-2 py-1.5 text-left text-faint">Item</th>
                <th className="border-b border-border px-2 py-1.5 text-center text-faint">Unit</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">Qty</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">Unit Cost</th>
                <th className="border-b border-l border-border bg-green-600/20 px-2 py-1.5 text-right text-green-300">Amount</th>
                <th className="border-b border-border px-1 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <tr key={g.id} className={`border-b border-border/70 ${g.enabled ? "odd:bg-surface even:bg-surface-2" : "bg-surface-2 text-faint"}`}>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={g.enabled} onChange={(e) => patch(g.id, { enabled: e.target.checked })} />
                  </td>
                  <td className="px-2 py-1">
                    <input value={g.name} onChange={(e) => patch(g.id, { name: e.target.value })} placeholder="General condition item" className="w-full min-w-[220px] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30" />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <select value={g.unit} onChange={(e) => { const u = e.target.value; patch(g.id, u === "month" ? { unit: u, qty: projectMonths } : { unit: u }); }} className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-fg outline-none hover:border-border focus:ring-1 focus:ring-brand/30">
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input type="number" value={g.qty} onChange={(e) => patch(g.id, { qty: Number(e.target.value) || 0 })} className={numCls} /></td>
                  <td className="px-1 py-1"><input type="number" value={g.unitCost} onChange={(e) => patch(g.id, { unitCost: Number(e.target.value) || 0 })} className={numCls} /></td>
                  <td className="border-l border-green-500/30 bg-green-500/10 px-2 py-1 text-right text-xs font-medium tabular-nums text-green-400">{nf0(g.qty * g.unitCost)}</td>
                  <td className="px-1 py-1 text-center">
                    <button type="button" onClick={() => remove(g.id)} aria-label="Remove" className="inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface text-xs font-bold">
                <td />
                <td className="px-2 py-2 uppercase tracking-wide text-fg" colSpan={4}>General Conditions / Overhead total ({enabledCount} active)</td>
                <td className="border-l border-green-500/30 px-2 py-2 text-right tabular-nums text-green-400">{currency} {nf0(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-faint">
          Toggle items on/off per project. Disabled items are excluded from the total. Activate the line in the estimate’s “Mark-ups & total” to apply it.
        </p>
      </Card>
    </div>
  );
}
