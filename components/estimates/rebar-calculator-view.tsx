"use client";

import { useState } from "react";
import { Grid2x2, AlertTriangle, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  REBAR_DIAMETERS,
  REBAR_ELEMENTS,
  FUTURE_ELEMENTS,
  DEFAULT_REBAR_WEIGHTS,
  calcStripFoundation,
  validateStrip,
  calculateColumnRebarKgPerM3,
  validateColumn,
  calculateBeam,
  validateBeam,
  calculateSlabRebarKgPerM3,
  validateSlab,
  type RebarDiameter,
  type RebarWeights,
  type StripInput,
  type StripType,
  type ColumnInput,
  type BeamInput,
  type SlabInput,
  type SlabDirectionInput,
  type SlabCalculationResult,
  type SlabDirectionResult,
} from "@/lib/calc/rebar";

const f3 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const f2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STRIP_PRESETS: Record<string, StripInput> = {
  "strip-1": { cover: 0.04, width: 0.45, height: 0.2, stirrupDia: 8, stirrupSpacing: 0.15, stirrupOverlap: 0.3, mainDia: 10, mainCount: 3, lengthBasis: 1 },
  "strip-2": { cover: 0.04, width: 0.6, height: 0.2, stirrupDia: 8, stirrupSpacing: 0.15, stirrupOverlap: 0.3, mainDia: 10, mainCount: 6, lengthBasis: 1 },
};
const COLUMN_PRESET: ColumnInput = { cover: 0.05, widthA: 0.3, widthB: 0.3, stirrupDia: 8, stirrupSpacing: 0.2, stirrupOverlap: 0.3, mainDia: 10, mainCount: 4, barLengthBasis: 0.7 };
const makeBeam = (): BeamInput => ({
  cover: 0.03, width: 0.38, height: 0.38, stirrupDia: 8, stirrupSpacing: 0.2, stirrupOverlap: 0.3,
  zones: [
    { label: "A", dia: 12, quantity: 3, lengthFactor: 1 },
    { label: "B", dia: 8, quantity: 2, lengthFactor: 1 },
    { label: "C", dia: 8, quantity: 2, lengthFactor: 1 },
    { label: "D", dia: 0, quantity: 0, lengthFactor: 1 },
    { label: "E", dia: 16, quantity: 4, lengthFactor: 1 },
  ],
});
const slabDir = (): SlabDirectionInput => ({ dia: 8, spacing: 0.15, barLengthBasis: 1, overlapEnabled: false, overlapLength: 0 });
const makeSlab = (): SlabInput => ({
  cover: 0.025, thickness: 0.12, area: 1,
  bottomX: slabDir(), bottomY: slabDir(), topEnabled: false, topX: slabDir(), topY: slabDir(),
});

export function RebarCalculatorView() {
  const [elementKey, setElementKey] = useState("strip-1");
  const [weights, setWeights] = useState<RebarWeights>({ ...DEFAULT_REBAR_WEIGHTS });
  const [stripInput, setStripInput] = useState<StripInput>({ ...STRIP_PRESETS["strip-1"] });
  const [columnInput, setColumnInput] = useState<ColumnInput>({ ...COLUMN_PRESET });
  const [beamInput, setBeamInput] = useState<BeamInput>(makeBeam());
  const [slabInput, setSlabInput] = useState<SlabInput>(makeSlab());

  const element = REBAR_ELEMENTS.find((e) => e.key === elementKey) ?? REBAR_ELEMENTS[0];
  const isColumn = element.kind === "column";
  const isBeam = element.kind === "beam";
  const isSlab = element.kind === "slab";

  const onElement = (key: string) => {
    setElementKey(key);
    const el = REBAR_ELEMENTS.find((e) => e.key === key);
    if (el?.kind === "strip" && STRIP_PRESETS[key]) setStripInput({ ...STRIP_PRESETS[key] });
    if (el?.kind === "column") setColumnInput({ ...COLUMN_PRESET });
    if (el?.kind === "beam") setBeamInput(makeBeam());
    if (el?.kind === "slab") setSlabInput(makeSlab());
  };
  const setStrip = <K extends keyof StripInput>(k: K, v: StripInput[K]) => setStripInput((p) => ({ ...p, [k]: v }));
  const setCol = <K extends keyof ColumnInput>(k: K, v: ColumnInput[K]) => setColumnInput((p) => ({ ...p, [k]: v }));
  const setBeam = <K extends keyof BeamInput>(k: K, v: BeamInput[K]) => setBeamInput((p) => ({ ...p, [k]: v }));
  const setZone = (i: number, patch: Partial<BeamInput["zones"][number]>) =>
    setBeamInput((p) => ({ ...p, zones: p.zones.map((z, idx) => (idx === i ? { ...z, ...patch } : z)) }));
  const setSlab = <K extends keyof SlabInput>(k: K, v: SlabInput[K]) => setSlabInput((p) => ({ ...p, [k]: v }));
  const setSlabDir = (dir: "bottomX" | "bottomY" | "topX" | "topY", patch: Partial<SlabDirectionInput>) =>
    setSlabInput((p) => ({ ...p, [dir]: { ...p[dir], ...patch } }));

  const v = isSlab ? validateSlab(slabInput) : isBeam ? validateBeam(beamInput) : isColumn ? validateColumn(columnInput) : validateStrip(stripInput);
  const slabRes = isSlab ? calculateSlabRebarKgPerM3(slabInput, weights) : null;
  const r = isSlab
    ? null
    : isBeam
      ? calculateBeam(beamInput, weights)
      : isColumn
        ? calculateColumnRebarKgPerM3(columnInput, weights)
        : calcStripFoundation((element.type ?? "type1") as StripType, stripInput, weights);
  const { errors, warnings } = v;
  const totalValue = isSlab ? slabRes?.totalKgPerM3 ?? 0 : r?.totalKgPerM3 ?? 0;
  const totalDisplay = errors.length ? "—" : Math.round(totalValue).toFixed(2); // rounded to whole, shown 2dp

  return (
    <div className="space-y-4">
      {/* Element selector */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg"><Grid2x2 className="h-4 w-4 text-brand" /> Rebar Calculator</div>
        <label className="ml-auto inline-flex items-center gap-2 text-xs">
          <span className="font-medium uppercase tracking-wide text-faint">Concrete Element</span>
          <select value={elementKey} onChange={(e) => onElement(e.target.value)} className="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-fg outline-none focus:ring-1 focus:ring-brand/30">
            {REBAR_ELEMENTS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </label>
        <span className="w-full text-[11px] text-faint sm:w-auto">Coming next: {FUTURE_ELEMENTS.join(" · ")}</span>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Inputs */}
        <Card className="p-5">
          {isSlab ? (
            <>
              <Section title="General">
                <Num label="Concrete cover" unit="m" step={0.005} value={slabInput.cover} onChange={(x) => setSlab("cover", x)} />
                <Num label="Slab thickness" unit="m" step={0.01} value={slabInput.thickness} onChange={(x) => setSlab("thickness", x)} />
                <Num label="Calculation area" unit="m²" step={0.5} value={slabInput.area} onChange={(x) => setSlab("area", x)} />
              </Section>
              <SlabDirSection title="Bottom Reinforcement X" data={slabInput.bottomX} weights={weights} onPatch={(p) => setSlabDir("bottomX", p)} factorLabel="Bar length basis" />
              <SlabDirSection title="Bottom Reinforcement Y" data={slabInput.bottomY} weights={weights} onPatch={(p) => setSlabDir("bottomY", p)} factorLabel="Bar length basis" />
              <Section title="Top Reinforcement (optional)">
                <button type="button" onClick={() => setSlab("topEnabled", !slabInput.topEnabled)} className={`inline-flex h-9 w-full items-center justify-between rounded-lg border px-3 text-sm font-medium transition-colors ${slabInput.topEnabled ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg"}`}>
                  <span>{slabInput.topEnabled ? "Top reinforcement enabled" : "Add top reinforcement"}</span>
                  <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${slabInput.topEnabled ? "bg-brand" : "bg-surface-2"}`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-surface shadow transition-transform ${slabInput.topEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
                  </span>
                </button>
              </Section>
              {slabInput.topEnabled ? (
                <>
                  <SlabDirSection title="Top Reinforcement X" data={slabInput.topX} weights={weights} onPatch={(p) => setSlabDir("topX", p)} factorLabel="Length factor" />
                  <SlabDirSection title="Top Reinforcement Y" data={slabInput.topY} weights={weights} onPatch={(p) => setSlabDir("topY", p)} factorLabel="Length factor" />
                </>
              ) : null}
            </>
          ) : isBeam ? (
            <>
              <Section title="General">
                <Num label="Concrete cover" unit="m" step={0.005} value={beamInput.cover} onChange={(x) => setBeam("cover", x)} />
                <Num label="Beam width" unit="m" step={0.05} value={beamInput.width} onChange={(x) => setBeam("width", x)} />
                <Num label="Beam height" unit="m" step={0.05} value={beamInput.height} onChange={(x) => setBeam("height", x)} />
              </Section>
              <Section title="Stirrups">
                <Dia label="Stirrup Ø" value={beamInput.stirrupDia} onChange={(x) => setBeam("stirrupDia", x)} weights={weights} />
                <Num label="Stirrup spacing (O.C.)" unit="m" step={0.025} value={beamInput.stirrupSpacing} onChange={(x) => setBeam("stirrupSpacing", x)} />
                <Num label="Stirrup overlap" unit="m" step={0.05} value={beamInput.stirrupOverlap} onChange={(x) => setBeam("stirrupOverlap", x)} />
              </Section>
              <Section title="Rebar Zones">
                <div className="grid grid-cols-[24px_1fr_56px_64px] items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-faint">
                  <span>Zone</span><span>Diameter</span><span className="text-right">Qty</span><span className="text-right">L·factor</span>
                </div>
                {beamInput.zones.map((z, i) => {
                  const off = z.dia === 0 || z.quantity === 0;
                  return (
                    <div key={z.label} className={`grid grid-cols-[24px_1fr_56px_64px] items-center gap-2 ${off ? "opacity-50" : ""}`}>
                      <span className="text-xs font-semibold text-fg">{z.label}</span>
                      <select value={z.dia} onChange={(e) => setZone(i, { dia: Number(e.target.value) as RebarDiameter | 0 })} className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-fg outline-none focus:ring-1 focus:ring-brand/30">
                        <option value={0}>None</option>
                        {REBAR_DIAMETERS.map((d) => <option key={d} value={d}>Ø{d}</option>)}
                      </select>
                      <input type="number" min={0} step={1} value={z.quantity} onChange={(e) => setZone(i, { quantity: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className="rounded-lg border border-border bg-surface px-2 py-1 text-right text-sm tabular-nums text-fg outline-none focus:ring-1 focus:ring-brand/30" />
                      <input type="number" min={0} step={0.05} value={z.lengthFactor} onChange={(e) => setZone(i, { lengthFactor: Math.max(0, Number(e.target.value) || 0) })} className="rounded-lg border border-border bg-surface px-2 py-1 text-right text-sm tabular-nums text-fg outline-none focus:ring-1 focus:ring-brand/30" />
                    </div>
                  );
                })}
              </Section>
            </>
          ) : isColumn ? (
            <>
              <Section title="General">
                <Num label="Concrete cover" unit="m" step={0.005} value={columnInput.cover} onChange={(x) => setCol("cover", x)} />
                <Num label="Width A" unit="m" step={0.05} value={columnInput.widthA} onChange={(x) => setCol("widthA", x)} />
                <Num label="Width B" unit="m" step={0.05} value={columnInput.widthB} onChange={(x) => setCol("widthB", x)} />
              </Section>
              <Section title="Stirrups">
                <Dia label="Stirrup Ø" value={columnInput.stirrupDia} onChange={(x) => setCol("stirrupDia", x)} weights={weights} />
                <Num label="Stirrup spacing (O.C.)" unit="m" step={0.025} value={columnInput.stirrupSpacing} onChange={(x) => setCol("stirrupSpacing", x)} />
                <Num label="Stirrup overlap" unit="m" step={0.05} value={columnInput.stirrupOverlap} onChange={(x) => setCol("stirrupOverlap", x)} />
              </Section>
              <Section title="Major Reinforcement">
                <Dia label="Main rebar Ø" value={columnInput.mainDia} onChange={(x) => setCol("mainDia", x)} weights={weights} />
                <Num label="Number of main rebars" step={1} min={4} value={columnInput.mainCount} onChange={(x) => setCol("mainCount", x)} integer />
                <Num label="Bar length basis" unit="m" step={0.05} value={columnInput.barLengthBasis} onChange={(x) => setCol("barLengthBasis", x)} />
              </Section>
            </>
          ) : (
            <>
              <Section title="General">
                <Num label="Concrete cover" unit="m" step={0.005} value={stripInput.cover} onChange={(x) => setStrip("cover", x)} />
                <Num label="Foundation width" unit="m" step={0.05} value={stripInput.width} onChange={(x) => setStrip("width", x)} />
                <Num label="Foundation height" unit="m" step={0.05} value={stripInput.height} onChange={(x) => setStrip("height", x)} />
              </Section>
              <Section title="Stirrups">
                <Dia label="Stirrup Ø" value={stripInput.stirrupDia} onChange={(x) => setStrip("stirrupDia", x)} weights={weights} />
                <Num label="Stirrup spacing (O.C.)" unit="m" step={0.025} value={stripInput.stirrupSpacing} onChange={(x) => setStrip("stirrupSpacing", x)} />
                <Num label="Stirrup overlap" unit="m" step={0.05} value={stripInput.stirrupOverlap} onChange={(x) => setStrip("stirrupOverlap", x)} />
              </Section>
              <Section title="Longitudinal / Major Reinforcement">
                <Dia label="Main rebar Ø" value={stripInput.mainDia} onChange={(x) => setStrip("mainDia", x)} weights={weights} />
                <Num label="Number of main rebars" step={1} value={stripInput.mainCount} onChange={(x) => setStrip("mainCount", x)} integer />
                <Num label="Rebar length basis" unit="lin. m" step={0.5} value={stripInput.lengthBasis} onChange={(x) => setStrip("lengthBasis", x)} />
              </Section>
            </>
          )}
        </Card>

        {/* Illustration */}
        <Card className="flex flex-col p-5">
          <div className="mb-2 text-sm font-semibold text-fg">{element.label}</div>
          <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-surface-2/40 p-3">
            {isSlab ? <SlabIllustration input={slabInput} /> : isBeam ? <BeamIllustration input={beamInput} /> : isColumn ? <ColumnIllustration input={columnInput} /> : <StripIllustration type={(element.type ?? "type1") as StripType} />}
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-blue-600" /> Stirrup</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-600" /> Main bars</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-slate-300" /> Concrete</span>
          </div>
        </Card>
      </div>

      {/* Rebar weight settings */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-2.5">
          <div className="text-sm font-semibold text-fg">Rebar Weight Settings</div>
          <span className="text-[11px] text-faint">kg per linear metre · editable · used globally</span>
          <button type="button" onClick={() => setWeights({ ...DEFAULT_REBAR_WEIGHTS })} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 text-xs font-medium text-muted hover:text-fg">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-7">
          {REBAR_DIAMETERS.map((d) => (
            <label key={d} className="flex items-center justify-between gap-2 bg-surface px-3 py-2">
              <span className="text-xs font-medium text-fg">Ø{d}</span>
              <input type="number" step={0.001} min={0} value={weights[d]} onChange={(e) => setWeights((w) => ({ ...w, [d]: Math.max(0, Number(e.target.value) || 0) }))} className="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs tabular-nums text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30" />
            </label>
          ))}
        </div>
      </Card>

      {/* Validation */}
      {errors.length ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <div className="mb-1 inline-flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Fix these inputs</div>
          <ul className="ml-5 list-disc space-y-0.5 text-xs">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      ) : null}
      {warnings.length ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
          <span className="font-semibold">Check:</span> {warnings.join(" · ")}
        </div>
      ) : null}

      {/* Breakdown */}
      {isSlab && slabRes ? <SlabBreakdown res={slabRes} input={slabInput} /> : null}
      {!isSlab && r ? (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-fg">Stirrups (Ø{(isBeam ? beamInput.stirrupDia : isColumn ? columnInput.stirrupDia : stripInput.stirrupDia)})</h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Line label="1 stirrup length" value={`${f2(r.stirrupLength)} m`} />
            <Line label="Stirrups per linear metre" value={String(r.stirrupCountPerM)} />
            <Line label="Total stirrup length / m" value={`${f2(r.totalStirrupLengthPerM)} m`} />
            <Line label="Total stirrup kg / m" value={`${f2(r.stirrupKgPerM)} kg`} />
            <Line label="Concrete volume / m" value={`${f3(r.concreteVolumeM3)} m³`} />
            <Line label="Stirrup kg per m³" value={`${f2(r.stirrupKgPerM3)} kg/m³`} strong />
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-fg">Main Reinforcement</h3>
          {isBeam && r.zones ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-faint">
                    <th className="border-b border-border py-1 text-left">Zone</th>
                    <th className="border-b border-border py-1 text-center">Ø</th>
                    <th className="border-b border-border py-1 text-right">Qty</th>
                    <th className="border-b border-border py-1 text-right">L·f</th>
                    <th className="border-b border-border py-1 text-right">Len</th>
                    <th className="border-b border-border py-1 text-right">kg/m</th>
                    <th className="border-b border-border py-1 text-right">kg/m³</th>
                  </tr>
                </thead>
                <tbody>
                  {r.zones.map((z) => (
                    <tr key={z.label} className={`border-b border-border/60 ${z.dia === 0 || z.quantity === 0 ? "text-faint" : "text-fg"}`}>
                      <td className="py-1 font-medium">{z.label}</td>
                      <td className="py-1 text-center">{z.dia ? `Ø${z.dia}` : "—"}</td>
                      <td className="py-1 text-right tabular-nums">{z.quantity}</td>
                      <td className="py-1 text-right tabular-nums">{f2(z.lengthFactor)}</td>
                      <td className="py-1 text-right tabular-nums">{f2(z.totalLength)}</td>
                      <td className="py-1 text-right tabular-nums">{f2(z.kgPerM)}</td>
                      <td className="py-1 text-right tabular-nums">{f2(z.kgPerM3)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-fg">
                    <td className="py-1.5" colSpan={4}>Total main</td>
                    <td className="py-1.5 text-right tabular-nums">{f2(r.mainRebarLengthPerM)}</td>
                    <td className="py-1.5 text-right tabular-nums">{f2(r.mainRebarKgPerM)}</td>
                    <td className="py-1.5 text-right tabular-nums">{f2(r.mainRebarKgPerM3)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <dl className="mt-3 space-y-1.5 text-sm">
              <Line label="Number of main rebars" value={String(r.mainCount)} />
              <Line label={isColumn ? "Main rebar total length" : "Total main rebar length / m"} value={`${f2(r.mainRebarLengthPerM)} m`} />
              <Line label={isColumn ? "Main rebar kg" : "Main rebar kg / m"} value={`${f2(r.mainRebarKgPerM)} kg`} />
              <Line label="Concrete volume / m" value={`${f3(r.concreteVolumeM3)} m³`} />
              <Line label="Main rebar kg per m³" value={`${f2(r.mainRebarKgPerM3)} kg/m³`} strong />
            </dl>
          )}
        </Card>
      </div>
      ) : null}

      {/* TOTAL */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-600 px-6 py-4 text-white shadow-sm">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-red-100">Total rebar weight</div>
          <div className="text-[11px] text-red-200">{element.label} · stirrups + main reinforcement</div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold tabular-nums">{totalDisplay}</span>
          <span className="ml-1 text-sm font-medium text-red-100">kg / m³</span>
        </div>
      </div>

      <div className="text-[11px] text-faint">Calculation by ZENARCH · metric units (m · kg · kg/m³)</div>
    </div>
  );
}

/* ---------------- small UI helpers ---------------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Num({ label, value, onChange, step = 0.05, unit, integer, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string; integer?: boolean; min?: number }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            const safe = Number.isFinite(n) ? Math.max(min, integer ? Math.round(n) : n) : 0;
            onChange(safe);
          }}
          className="w-24 rounded-lg border border-border bg-surface px-2 py-1 text-right text-sm tabular-nums text-fg outline-none focus:ring-1 focus:ring-brand/30"
        />
        {unit ? <span className="w-10 text-[11px] text-faint">{unit}</span> : <span className="w-10" />}
      </span>
    </label>
  );
}
function Dia({ label, value, onChange, weights }: { label: string; value: RebarDiameter; onChange: (v: RebarDiameter) => void; weights: RebarWeights }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value) as RebarDiameter)} className="w-[136px] rounded-lg border border-border bg-surface px-2 py-1 text-sm text-fg outline-none focus:ring-1 focus:ring-brand/30">
        {REBAR_DIAMETERS.map((d) => <option key={d} value={d}>Ø{d} · {weights[d]} kg/m</option>)}
      </select>
    </label>
  );
}
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "border-t border-border pt-1.5 font-semibold text-fg" : "text-muted"}`}>
      <span>{label}</span>
      <span className="tabular-nums text-fg">{value}</span>
    </div>
  );
}

/* ---------------- illustrations ---------------- */
const BLUE = "#2563eb";
const RED = "#dc2626";

function StripIllustration({ type }: { type: StripType }) {
  return (
    <svg viewBox="0 0 400 250" className="h-auto w-full max-w-[420px]">
      <rect x="70" y="45" width="260" height="130" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
      {type === "type1" ? (
        <path d="M95 62 V158 H305 V62" fill="none" stroke={BLUE} strokeWidth="3" strokeLinejoin="round" />
      ) : (
        <rect x="95" y="62" width="210" height="96" fill="none" stroke={BLUE} strokeWidth="3" rx="3" />
      )}
      {[110, 200, 290].map((x) => <circle key={`b${x}`} cx={x} cy="150" r="6" fill={RED} />)}
      {type === "type2" ? [110, 200, 290].map((x) => <circle key={`t${x}`} cx={x} cy="70" r="6" fill={RED} />) : null}
      <line x1="70" y1="45" x2="95" y2="62" stroke="#0f172a" strokeWidth="0.8" />
      <text x="34" y="42" fontSize="10" fill="#334155">cover</text>
      <line x1="70" y1="195" x2="330" y2="195" stroke="#334155" strokeWidth="1" />
      <text x="200" y="210" fontSize="11" fill="#334155" textAnchor="middle">Width (W)</text>
      <line x1="50" y1="45" x2="50" y2="175" stroke="#334155" strokeWidth="1" />
      <text x="20" y="115" fontSize="11" fill="#334155" textAnchor="middle" transform="rotate(-90 20 115)">Height (H)</text>
      <text x="312" y="60" fontSize="10" fill={BLUE}>{type === "type1" ? "open U-stirrup" : "closed stirrup"}</text>
      <text x="200" y="240" fontSize="10" fill={RED} textAnchor="middle">major / longitudinal bars</text>
    </svg>
  );
}

function columnBars(n: number, sx: number, sy: number, ex: number, ey: number): [number, number][] {
  const out: [number, number][] = [[sx, sy], [ex, sy], [ex, ey], [sx, ey]];
  const extra = Math.max(0, n - 4);
  const top = Math.ceil(extra / 2);
  const bottom = extra - top;
  for (let i = 1; i <= top; i++) out.push([sx + ((ex - sx) * i) / (top + 1), sy]);
  for (let i = 1; i <= bottom; i++) out.push([sx + ((ex - sx) * i) / (bottom + 1), ey]);
  return out;
}

function ColumnIllustration({ input }: { input: ColumnInput }) {
  const a = Math.max(input.widthA, 0.05);
  const b = Math.max(input.widthB, 0.05);
  const scale = 150 / Math.max(a, b);
  const wpx = a * scale, hpx = b * scale;
  const x0 = 70, y0 = 30;
  const cov = Math.max(0, input.cover) * scale;
  const sx = x0 + cov, sy = y0 + cov, ex = x0 + wpx - cov, ey = y0 + hpx - cov;
  const bars = sx < ex && sy < ey ? columnBars(Math.max(4, input.mainCount), sx, sy, ex, ey) : [];
  return (
    <svg viewBox="0 0 300 230" className="h-auto w-full max-w-[360px]">
      <rect x={x0} y={y0} width={wpx} height={hpx} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
      {sx < ex && sy < ey ? <rect x={sx} y={sy} width={ex - sx} height={ey - sy} fill="none" stroke={BLUE} strokeWidth="3" rx="3" /> : null}
      {bars.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="5.5" fill={RED} />)}
      <line x1={x0} y1={y0} x2={sx} y2={sy} stroke="#0f172a" strokeWidth="0.8" />
      <text x={x0 - 34} y={y0 - 2} fontSize="10" fill="#334155">cover</text>
      <line x1={x0} y1={y0 + hpx + 18} x2={x0 + wpx} y2={y0 + hpx + 18} stroke="#334155" strokeWidth="1" />
      <text x={x0 + wpx / 2} y={y0 + hpx + 34} fontSize="11" fill="#334155" textAnchor="middle">Width A</text>
      <line x1={x0 - 16} y1={y0} x2={x0 - 16} y2={y0 + hpx} stroke="#334155" strokeWidth="1" />
      <text x={x0 - 26} y={y0 + hpx / 2} fontSize="11" fill="#334155" textAnchor="middle" transform={`rotate(-90 ${x0 - 26} ${y0 + hpx / 2})`}>Width B</text>
      <text x={x0 + wpx + 6} y={y0 + 12} fontSize="10" fill={BLUE}>closed stirrup</text>
    </svg>
  );
}

function rowBars(n: number, sx: number, ex: number, y: number): [number, number][] {
  if (n <= 0) return [];
  if (n === 1) return [[(sx + ex) / 2, y]];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([sx + ((ex - sx) * i) / (n - 1), y]);
  return out;
}

function BeamIllustration({ input }: { input: BeamInput }) {
  const w = Math.max(input.width, 0.05);
  const h = Math.max(input.height, 0.05);
  const scale = 175 / Math.max(w, h);
  const wpx = w * scale, hpx = h * scale;
  const x0 = 115, y0 = 26;
  const cov = Math.max(0, input.cover) * scale;
  const sx = x0 + cov, sy = y0 + cov, ex = x0 + wpx - cov, ey = y0 + hpx - cov;
  const ok = sx < ex && sy < ey;
  const active = (i: number) => input.zones[i].dia !== 0 && input.zones[i].quantity > 0;
  // 5 zone layers stacked top (A) to bottom (E).
  const zoneY = (i: number) => sy + (ey - sy) * (0.08 + (0.84 * i) / 4);
  return (
    <svg viewBox="0 0 300 250" className="h-auto w-full max-w-[280px]">
      {/* concrete outline + closed stirrup */}
      <rect x={x0} y={y0} width={wpx} height={hpx} fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
      {ok ? <rect x={sx} y={sy} width={ex - sx} height={ey - sy} fill="none" stroke={BLUE} strokeWidth="2.5" /> : null}
      {/* in-figure labels */}
      {ok ? <text x={(sx + ex) / 2} y={(zoneY(0) + zoneY(1)) / 2} fontSize="8" fontWeight="bold" fill={BLUE} textAnchor="middle">STIRRUPS</text> : null}
      {ok ? <text x={(sx + ex) / 2} y={(zoneY(1) + zoneY(2)) / 2} fontSize="7" fontWeight="bold" fill={RED} textAnchor="middle">MAJOR REINFORCING REBAR</text> : null}
      {/* zones A–E: each a layer of bars across the section */}
      {ok ? input.zones.map((z, i) => {
        const y = zoneY(i);
        return (
          <g key={z.label} opacity={active(i) ? 1 : 0.3}>
            {rowBars(Math.max(0, z.quantity), sx, ex, y).map(([cx], j) => <circle key={j} cx={cx} cy={y} r="4.5" fill={RED} />)}
            <text x={(sx + ex) / 2} y={y + 4} fontSize="11" fontWeight="bold" fill={RED} textAnchor="middle">{z.label}</text>
          </g>
        );
      }) : null}
      {/* width dimension (top) */}
      <line x1={x0} y1={y0 - 10} x2={x0 + wpx} y2={y0 - 10} stroke="#334155" strokeWidth="0.8" />
      <line x1={x0} y1={y0 - 13} x2={x0} y2={y0 - 7} stroke="#334155" strokeWidth="0.8" />
      <line x1={x0 + wpx} y1={y0 - 13} x2={x0 + wpx} y2={y0 - 7} stroke="#334155" strokeWidth="0.8" />
      <text x={x0 + wpx / 2} y={y0 - 14} fontSize="10" fill="#334155" textAnchor="middle">width</text>
      {/* cover (top-right) */}
      <line x1={x0 + wpx} y1={sy} x2={ex} y2={sy} stroke="#0f172a" strokeWidth="0.8" />
      <text x={x0 + wpx + 5} y={sy + 4} fontSize="9" fill="#334155">cover</text>
      {/* height dimension (left) */}
      <line x1={x0 - 18} y1={y0} x2={x0 - 18} y2={y0 + hpx} stroke="#334155" strokeWidth="0.8" />
      <text x={x0 - 28} y={y0 + hpx / 2} fontSize="10" fill="#334155" textAnchor="middle" transform={`rotate(-90 ${x0 - 28} ${y0 + hpx / 2})`}>HEIGHT</text>
      <text x={150} y={245} fontSize="9" fill="#334155" textAnchor="middle">TYPE: RING BEAM</text>
    </svg>
  );
}

/* ---------------- slab: direction fields, breakdown, illustration ---------------- */
function SlabDirSection({ title, data, weights, onPatch, factorLabel }: { title: string; data: SlabDirectionInput; weights: RebarWeights; onPatch: (p: Partial<SlabDirectionInput>) => void; factorLabel: string }) {
  return (
    <Section title={title}>
      <Dia label="Rebar Ø" value={data.dia} onChange={(x) => onPatch({ dia: x })} weights={weights} />
      <Num label="Spacing (O.C.)" unit="m" step={0.025} value={data.spacing} onChange={(x) => onPatch({ spacing: x })} />
      <Num label={factorLabel} unit="m" step={0.05} value={data.barLengthBasis} onChange={(x) => onPatch({ barLengthBasis: x })} />
      <label className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">Enable lap / overlap</span>
        <input type="checkbox" checked={data.overlapEnabled} onChange={(e) => onPatch({ overlapEnabled: e.target.checked })} className="accent-brand" />
      </label>
      {data.overlapEnabled ? <Num label="Lap / overlap length" unit="m" step={0.05} value={data.overlapLength} onChange={(x) => onPatch({ overlapLength: x })} /> : null}
    </Section>
  );
}

function SlabBreakdown({ res, input }: { res: SlabCalculationResult; input: SlabInput }) {
  const dirs = (
    [
      { title: "Bottom Reinforcement X", d: res.bottomX },
      { title: "Bottom Reinforcement Y", d: res.bottomY },
      { title: "Top Reinforcement X", d: res.topX },
      { title: "Top Reinforcement Y", d: res.topY },
    ] as { title: string; d: SlabDirectionResult | undefined }[]
  ).filter((x): x is { title: string; d: SlabDirectionResult } => Boolean(x.d));
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-fg">General</h3>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Line label="Slab thickness" value={`${f2(input.thickness)} m`} />
          <Line label="Calculation area" value={`${f2(input.area)} m²`} />
          <Line label="Concrete volume" value={`${f3(res.concreteVolumeM3)} m³`} strong />
        </dl>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {dirs.map(({ title, d }) => (
          <Card key={title} className="p-5">
            <h3 className="text-sm font-semibold text-fg">{title}</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Line label="Diameter" value={`Ø${d.dia}`} />
              <Line label="Spacing O.C." value={`${f2(d.spacing)} m`} />
              <Line label="Bars per metre" value={f2(d.barsPerMeter)} />
              <Line label="Total bar length / m²" value={`${f2(d.totalBarLengthPerM2)} m`} />
              <Line label="kg per m²" value={`${f2(d.kgPerM2)} kg`} />
              <Line label="kg per m³" value={`${f2(d.kgPerM3)} kg/m³`} strong />
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlabIllustration({ input }: { input: SlabInput }) {
  const x0 = 55, y0 = 78, w = 230, h = 60;
  const top = input.topEnabled;
  const botY = y0 + h - 14, botYline = y0 + h - 22;
  const topY = y0 + 14, topYline = y0 + 22;
  const barsX = rowBars(7, x0 + 16, x0 + w - 16, botY);
  const topBarsX = rowBars(7, x0 + 16, x0 + w - 16, topY);
  return (
    <svg viewBox="0 0 320 205" className="h-auto w-full max-w-[360px]">
      <rect x={x0} y={y0} width={w} height={h} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
      {/* bottom mesh: Y as a line, X as dots */}
      <line x1={x0 + 12} y1={botYline} x2={x0 + w - 12} y2={botYline} stroke={RED} strokeWidth="2" opacity="0.65" />
      {barsX.map(([cx], i) => <circle key={i} cx={cx} cy={botY} r="4" fill={RED} />)}
      {top ? (
        <>
          <line x1={x0 + 12} y1={topYline} x2={x0 + w - 12} y2={topYline} stroke={RED} strokeWidth="2" opacity="0.65" />
          {topBarsX.map(([cx], i) => <circle key={`t${i}`} cx={cx} cy={topY} r="4" fill={RED} />)}
          <text x={x0 + w / 2} y={topY - 8} fontSize="9" fill={RED} textAnchor="middle">Top X (•) · Y (—)</text>
        </>
      ) : null}
      <text x={x0 + w / 2} y={botY + 16} fontSize="9" fill={RED} textAnchor="middle">Bottom X (•) · Y (—)</text>
      {/* thickness (left) */}
      <line x1={x0 - 14} y1={y0} x2={x0 - 14} y2={y0 + h} stroke="#334155" strokeWidth="1" />
      <line x1={x0 - 17} y1={y0} x2={x0 - 11} y2={y0} stroke="#334155" strokeWidth="1" />
      <line x1={x0 - 17} y1={y0 + h} x2={x0 - 11} y2={y0 + h} stroke="#334155" strokeWidth="1" />
      <text x={x0 - 24} y={y0 + h / 2} fontSize="9" fill="#334155" textAnchor="middle" transform={`rotate(-90 ${x0 - 24} ${y0 + h / 2})`}>thickness {f2(input.thickness)} m</text>
      {/* cover */}
      <line x1={x0 + w} y1={y0 + h} x2={x0 + w} y2={botY} stroke="#0f172a" strokeWidth="0.8" />
      <text x={x0 + w + 5} y={botY + 3} fontSize="9" fill="#334155">cover</text>
      {/* spacing O.C. */}
      {barsX.length >= 2 ? (
        <>
          <line x1={barsX[0][0]} y1={botY + 24} x2={barsX[1][0]} y2={botY + 24} stroke="#334155" strokeWidth="0.8" />
          <text x={(barsX[0][0] + barsX[1][0]) / 2} y={botY + 35} fontSize="8.5" fill="#334155" textAnchor="middle">spacing O.C. {f2(input.bottomX.spacing)} m</text>
        </>
      ) : null}
    </svg>
  );
}
