"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SaveControl } from "@/components/development/save-control";
import { computeLandUse, computeAcquisition } from "@/lib/development/calc";
import type { LandUseAllocation, LandAcquisition } from "@/lib/data/development.types";
import { formatCurrency, formatNumber } from "@/lib/format";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-right text-sm tabular-nums text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

function NumRow({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          className={`${inputCls} w-36`}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix ? <span className="w-6 text-xs text-faint">{suffix}</span> : null}
      </span>
    </label>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-semibold ${warn ? "text-red-600" : "text-fg"}`}>{value}</span>
    </div>
  );
}

export function LandCalculator({
  projectId,
  landUse,
  acquisition,
  currency,
  lotCount,
}: {
  projectId: string;
  landUse: LandUseAllocation;
  acquisition: LandAcquisition;
  currency: string;
  lotCount: number;
}) {
  const [land, setLand] = useState(landUse);
  const [acq, setAcq] = useState(acquisition);
  const setL = (k: keyof LandUseAllocation, v: number) => setLand((p) => ({ ...p, [k]: v }));
  const setA = (k: keyof LandAcquisition, v: number) => setAcq((p) => ({ ...p, [k]: v }));

  const lu = useMemo(() => computeLandUse({ ...land, lotCount }), [land, lotCount]);
  const ac = useMemo(() => computeAcquisition(acq, land.grossParcelArea, lu.netSellableLand), [acq, land.grossParcelArea, lu.netSellableLand]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SaveControl url={`/api/development/${projectId}/land`} build={() => ({ landUse: land, acquisition: acq })} label="Save land & acquisition" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Land use */}
      <Card>
        <CardHeader title="Land use / parceling layout" subtitle="Allocate the gross parcel into sellable and non-sellable land" />
        <CardBody className="divide-y divide-border">
          <NumRow label="Gross parcel area" value={land.grossParcelArea} onChange={(v) => setL("grossParcelArea", v)} suffix="m²" />
          <NumRow label="Road area" value={land.roadArea} onChange={(v) => setL("roadArea", v)} suffix="m²" />
          <NumRow label="Sidewalk area" value={land.sidewalkArea} onChange={(v) => setL("sidewalkArea", v)} suffix="m²" />
          <NumRow label="Green area" value={land.greenArea} onChange={(v) => setL("greenArea", v)} suffix="m²" />
          <NumRow label="Utility / transformer" value={land.utilityArea} onChange={(v) => setL("utilityArea", v)} suffix="m²" />
          <NumRow label="Drainage area" value={land.drainageArea} onChange={(v) => setL("drainageArea", v)} suffix="m²" />
          <NumRow label="Common area" value={land.commonArea} onChange={(v) => setL("commonArea", v)} suffix="m²" />
          <NumRow label="Pool / deck area" value={land.poolDeckArea} onChange={(v) => setL("poolDeckArea", v)} suffix="m²" />
          <NumRow label="Retained owner area" value={land.retainedOwnerArea} onChange={(v) => setL("retainedOwnerArea", v)} suffix="m²" />
          <NumRow label="Required green %" value={land.requiredGreenPct} onChange={(v) => setL("requiredGreenPct", v)} suffix="%" />
        </CardBody>
      </Card>

      {/* Land-use results */}
      <Card>
        <CardHeader title="Net sellable land" />
        <CardBody className="space-y-2">
          <Stat label="Non-sellable total" value={`${formatNumber(lu.nonSellableLandTotal)} m²`} />
          <Stat label="Net sellable land" value={`${formatNumber(lu.netSellableLand)} m²`} warn={lu.netSellableLand < 0} />
          <Stat label="Net sellable ratio" value={`${(lu.netSellableRatio * 100).toFixed(1)}%`} warn={lu.netSellableRatio < 0.6} />
          <Stat label="Road %" value={`${lu.roadPct.toFixed(1)}%`} warn={lu.roadPct > 35} />
          <Stat label="Green %" value={`${lu.greenPct.toFixed(1)}%`} />
          <Stat label="Average lot size" value={`${formatNumber(lu.averageLotSize)} m²`} />
          <Stat label="Density" value={`${lu.unitsPerHectare.toFixed(1)} units/ha`} />
          {lu.warnings.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{lu.warnings.join(" ")}</span>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Acquisition */}
      <Card>
        <CardHeader title="Land acquisition" subtitle="Parcel price plus transfer, advisor and setup costs" />
        <CardBody className="divide-y divide-border">
          <NumRow label="Parcel acquisition cost" value={acq.parcelAcquisitionCost} onChange={(v) => setA("parcelAcquisitionCost", v)} />
          <NumRow label="Transfer tax" value={acq.transferTax} onChange={(v) => setA("transferTax", v)} />
          <NumRow label="Notary" value={acq.notaryCost} onChange={(v) => setA("notaryCost", v)} />
          <NumRow label="Kadaster" value={acq.kadasterCost} onChange={(v) => setA("kadasterCost", v)} />
          <NumRow label="Broker commission" value={acq.brokerCommission} onChange={(v) => setA("brokerCommission", v)} />
          <NumRow label="Due diligence" value={acq.dueDiligence} onChange={(v) => setA("dueDiligence", v)} />
          <NumRow label="Topographic survey" value={acq.topographicSurvey} onChange={(v) => setA("topographicSurvey", v)} />
          <NumRow label="Parceling survey / meetbrieven" value={acq.parcelingSurvey} onChange={(v) => setA("parcelingSurvey", v)} />
          <NumRow label="Legal / company setup" value={acq.legalSetup} onChange={(v) => setA("legalSetup", v)} />
          <NumRow label="Financing setup / guarantee" value={acq.financingSetup} onChange={(v) => setA("financingSetup", v)} />
          <NumRow label="Acquisition contingency %" value={acq.contingencyPct} onChange={(v) => setA("contingencyPct", v)} suffix="%" />
        </CardBody>
      </Card>

      {/* Acquisition results */}
      <Card>
        <CardHeader title="Acquisition cost" />
        <CardBody className="space-y-2">
          <Stat label="Subtotal" value={formatCurrency(ac.subtotal, currency)} />
          <Stat label="Contingency" value={formatCurrency(ac.contingency, currency)} />
          <Stat label="Total acquisition cost" value={formatCurrency(ac.totalAcquisitionCost, currency)} />
          <Stat label="Cost per gross m²" value={`${formatCurrency(ac.costPerGrossM2, currency)}/m²`} />
          <Stat label="Cost per net sellable m²" value={`${formatCurrency(ac.costPerNetSellableM2, currency)}/m²`} />
          <p className="pt-1 text-[11px] text-faint">
            Edits recalculate instantly. Use “Save land &amp; acquisition” to persist (requires the database to be live).
          </p>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}
