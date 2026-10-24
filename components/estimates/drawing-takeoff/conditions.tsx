"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/language-provider";
import type { TakeoffCondition, TakeoffKind, TakeoffMeasurement, ConditionRollup } from "@/lib/takeoff";
import type { NormSetTask } from "@/lib/data/estimate-presets";

export const control = "rounded border border-border bg-surface px-2 py-1 text-xs text-fg disabled:opacity-40";
const palette = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

type ConditionsProps = {
  conditions: TakeoffCondition[];
  measurements: TakeoffMeasurement[];
  totals: ConditionRollup[];
  normSet: NormSetTask[];
  active: string;
  selected: string;
  locked: boolean;
  onActivate: (condition: TakeoffCondition) => void;
  onChange: (condition: TakeoffCondition) => void;
  onDelete: (id: string) => void;
  onSelect: (measurement: TakeoffMeasurement) => void;
  onRemove: (id: string) => void;
};

export function Conditions({
  conditions,
  measurements,
  totals,
  normSet,
  active,
  selected,
  locked,
  onActivate,
  onChange,
  onDelete,
  onSelect,
  onRemove,
}: ConditionsProps) {
  const t = useT();
  const [editing, setEditing] = useState<TakeoffCondition | null>(null);
  const [confirm, setConfirm] = useState("");
  const kindName = (kind: TakeoffKind) => kind === "AREA" ? t("Area") : kind === "LINEAR" ? t("Length") : t("Count");

  return (
    <aside className="space-y-3 rounded border border-border bg-surface p-3 lg:w-72 lg:shrink-0">
      <div className="flex justify-between">
        <b>{t("Conditions")}</b>
        <button
          className={control}
          disabled={locked}
          onClick={() => setEditing({
            id: crypto.randomUUID(),
            name: "",
            kind: "AREA",
            colour: palette[conditions.length % palette.length],
            wastePct: 0,
          })}
        >
          {t("Add condition")}
        </button>
      </div>
      {editing && (
        <form
          className="space-y-2"
          onSubmit={event => {
            event.preventDefault();
            if (!locked && editing.name.trim()) {
              onChange({ ...editing, name: editing.name.trim() });
              setEditing(null);
            }
          }}
        >
          <label className="block text-xs">
            {t("Condition name")}
            <input
              required
              className={`${control} w-full`}
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label className="block text-xs">
            {t("Kind")}
            <select
              className={`${control} w-full`}
              value={editing.kind}
              disabled={measurements.some(m => m.conditionId === editing.id)}
              onChange={e => setEditing({
                ...editing,
                kind: e.target.value as TakeoffKind,
                heightMm: undefined,
                depthMm: undefined,
              })}
            >
              {(["AREA", "LINEAR", "COUNT"] as const).map(kind => (
                <option key={kind} value={kind}>{kindName(kind)}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            {t("Colour")}
            <select
              className={`${control} w-full`}
              value={editing.colour}
              style={{ color: editing.colour }}
              onChange={e => setEditing({ ...editing, colour: e.target.value })}
            >
              {palette.map((colour, i) => <option key={colour} value={colour}>{i + 1}</option>)}
            </select>
          </label>
          {editing.kind !== "COUNT" && (
            <label className="block text-xs">
              {editing.kind === "LINEAR" ? t("Wall height (mm)") : t("Depth (mm)")}
              <input
                className={`${control} w-full`}
                type="number"
                min="0.001"
                step="any"
                value={(editing.kind === "LINEAR" ? editing.heightMm : editing.depthMm) ?? ""}
                onChange={e => setEditing({
                  ...editing,
                  [editing.kind === "LINEAR" ? "heightMm" : "depthMm"]:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })}
              />
            </label>
          )}
          <label className="block text-xs">
            {t("Waste %")}
            <input
              required
              className={`${control} w-full`}
              type="number"
              min="0"
              step="any"
              value={editing.wastePct}
              onChange={e => setEditing({ ...editing, wastePct: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs">
            {t("Norm task")}
            <select
              className={`${control} w-full`}
              value={editing.normId ?? ""}
              onChange={e => setEditing({ ...editing, normId: e.target.value || undefined })}
            >
              <option value="">{t("None")}</option>
              {normSet.map(norm => <option key={norm.id} value={norm.id}>{norm.task}</option>)}
            </select>
          </label>
          <button className={control} disabled={locked}>{t("Save")}</button>{" "}
          <button type="button" className={control} onClick={() => setEditing(null)}>{t("Cancel")}</button>
        </form>
      )}
      {conditions.map(condition => {
        const total = totals.find(row => row.conditionId === condition.id);
        const quantity = total?.qty == null
          ? t("Not to scale")
          : total.qty.toLocaleString("en-US", { maximumFractionDigits: 2 });
        return (
          <section
            key={condition.id}
            className={`rounded border p-2 ${active === condition.id ? "border-brand" : "border-border"}`}
          >
            <button
              className="flex w-full items-center gap-2 text-left text-sm"
              onClick={() => onActivate(condition)}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: condition.colour }} />
              {condition.name}
            </button>
            <p className="text-xs text-muted">
              {kindName(condition.kind)} · {quantity} {total?.unit}
            </p>
            <div className="mt-1 flex gap-1">
              <button className={control} disabled={locked} onClick={() => setEditing(condition)}>
                {t("Edit")}
              </button>
              <button
                className={control}
                disabled={locked}
                onClick={() => measurements.some(m => m.conditionId === condition.id)
                  ? setConfirm(condition.id)
                  : onDelete(condition.id)}
              >
                {t("Delete")}
              </button>
            </div>
            {confirm === condition.id && (
              <div role="alert" className="mt-2 text-xs">
                {t("Delete this condition and its measurements?")}{" "}
                <button
                  className={control}
                  disabled={locked}
                  onClick={() => {
                    onDelete(condition.id);
                    setConfirm("");
                  }}
                >
                  {t("Delete")}
                </button>{" "}
                <button className={control} onClick={() => setConfirm("")}>{t("Cancel")}</button>
              </div>
            )}
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
              {measurements.filter(m => m.conditionId === condition.id).map((measurement, i) => (
                <li
                  key={measurement.id}
                  className={`flex gap-1 text-xs ${selected === measurement.id ? "text-brand" : ""}`}
                >
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(measurement)}>
                    {i + 1} · {measurement.drawingId.slice(0, 8)} · {t("Page")} {measurement.page}
                  </button>
                  <button
                    className={control}
                    aria-label={t("Delete measurement")}
                    disabled={locked}
                    onClick={() => onRemove(measurement.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}
