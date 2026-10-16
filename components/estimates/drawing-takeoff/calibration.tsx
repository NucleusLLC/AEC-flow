"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/components/i18n/language-provider";
import { calibrationFrom, distancePt, type Calibration, type Point } from "@/lib/drawings/markup";
import { parseScaleNote } from "@/lib/takeoff";
import { control } from "./conditions";

type CalibrationControlsProps = {
  value: Calibration | null;
  points: Point[];
  locked: boolean;
  onCalibrate: (calibration: Calibration) => void;
};

const scaleNotes = ["1:20", "1:50", "1:100", "1:200", '1/4" = 1\' - 0"', '1/8" = 1\' - 0"'];

export function CalibrationControls({ value, points, locked, onCalibrate }: CalibrationControlsProps) {
  const t = useT();
  const [note, setNote] = useState("1:100");
  const [mm, setMm] = useState("");

  function applyScale() {
    const calibration = parseScaleNote(note);
    if (calibration) {
      onCalibrate(calibration);
    } else {
      toast.error(t("Invalid scale note."));
    }
  }

  function calibratePoints() {
    const scale = calibrationFrom(distancePt(points[0], points[1]), Number(mm));
    if (scale) {
      onCalibrate({ mmPerPoint: scale, reference: `${mm} mm` });
    } else {
      toast.error(t("Enter a positive real length."));
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded border border-border p-2">
      <label className="text-xs">
        {t("Scale note")}
        <input
          className={`${control} block`}
          disabled={locked}
          list="takeoff-scales"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </label>
      <datalist id="takeoff-scales">
        {scaleNotes.map(scale => <option key={scale} value={scale} />)}
      </datalist>
      <button className={control} disabled={locked} onClick={applyScale}>{t("Apply scale")}</button>
      <label className="text-xs">
        {t("Real length (mm)")}
        <input
          className={`${control} block w-32`}
          disabled={locked}
          type="number"
          min="0"
          value={mm}
          onChange={e => setMm(e.target.value)}
        />
      </label>
      <button className={control} disabled={locked || points.length !== 2} onClick={calibratePoints}>
        {t("Calibrate two points")}
      </button>
      <span className="text-xs text-muted">{value?.reference ?? t("Not to scale")}</span>
    </div>
  );
}
