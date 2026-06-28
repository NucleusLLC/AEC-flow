/**
 * Rebar Calculator — calculation engine (UI-free, fully testable).
 *
 * Computes total rebar weight (kg) per m³ of concrete for reinforced-concrete
 * elements. Implemented now: Strip Foundation Type 1 (open U-stirrup) and
 * Type 2 (closed rectangular stirrup). Structure is deliberately element-agnostic
 * so RC Columns / Beams / Slabs / Footings / Retaining Walls slot in later as
 * their own input type + calc function reusing the shared weights + helpers.
 *
 * Units: metres (m), kilograms (kg), kg per linear metre (kg/m), kg per m³.
 */

export type RebarDiameter = 6 | 8 | 10 | 12 | 16 | 20 | 25;
export const REBAR_DIAMETERS: RebarDiameter[] = [6, 8, 10, 12, 16, 20, 25];

/** Editable, configurable rebar unit weights (kg per linear metre). Used globally. */
export type RebarWeights = Record<RebarDiameter, number>;
export const DEFAULT_REBAR_WEIGHTS: RebarWeights = {
  6: 0.222,
  8: 0.395,
  10: 0.617,
  12: 0.888,
  16: 1.58,
  20: 2.464,
  25: 3.853,
};

export type StripType = "type1" | "type2";
export type ElementKind = "strip" | "column" | "beam" | "slab";
export type RebarElementDef = { key: string; kind: ElementKind; type?: StripType; label: string };
export type RebarCalculatorElement = RebarElementDef;

/** Elements available in the calculator + the roadmap for future ones. */
export const REBAR_ELEMENTS: RebarElementDef[] = [
  { key: "strip-1", kind: "strip", type: "type1", label: "Strip Foundation – Type 1" },
  { key: "strip-2", kind: "strip", type: "type2", label: "Strip Foundation – Type 2" },
  { key: "column", kind: "column", label: "Column" },
  { key: "beam", kind: "beam", label: "RC Beam / Ring Beam" },
  { key: "slab", kind: "slab", label: "RC Slab" },
];
export const FUTURE_ELEMENTS = [
  "RC Retaining Wall",
  "Isolated Footing",
  "Raft Foundation",
  "Staircase",
  "Wall Footing",
  "Pile Cap",
];

export type StripInput = {
  cover: number; // m
  width: number; // m
  height: number; // m
  stirrupDia: RebarDiameter;
  stirrupSpacing: number; // m (O.C.)
  stirrupOverlap: number; // m
  mainDia: RebarDiameter;
  mainCount: number;
  lengthBasis: number; // linear metre basis (default 1.00)
};

export type ZoneResult = {
  label: string;
  dia: RebarDiameter | 0;
  quantity: number;
  lengthFactor: number;
  totalLength: number;
  kgPerM: number;
  kgPerM3: number;
};

export type RebarBreakdown = {
  zones?: ZoneResult[]; // present for the beam (per-zone breakdown)
  concreteVolumeM3: number;
  // stirrups
  stirrupLength: number;
  stirrupCountPerM: number;
  totalStirrupLengthPerM: number;
  stirrupKgPerM: number;
  stirrupKgPerM3: number;
  // main / longitudinal
  mainCount: number;
  mainRebarLengthPerM: number;
  mainRebarKgPerM: number;
  mainRebarKgPerM3: number;
  // result
  totalKgPerM3: number;
};

/**
 * Strip-foundation rebar weight per m³.
 * Type 1 = open U-shaped stirrup. Type 2 = closed rectangular stirrup.
 */
export function calcStripFoundation(
  type: StripType,
  input: StripInput,
  weights: RebarWeights = DEFAULT_REBAR_WEIGHTS,
): RebarBreakdown {
  const basis = input.lengthBasis || 1;
  const concreteVolumeM3 = input.width * input.height * basis;

  const innerW = input.width - 2 * input.cover;
  const innerH = input.height - 2 * input.cover;
  const stirrupLength =
    type === "type1"
      ? innerW + innerH + input.stirrupOverlap // open U
      : 2 * innerW + 2 * innerH + input.stirrupOverlap; // closed rectangle

  // Whole stirrups per metre — you can't place a partial stirrup, so round down to complete stirrups.
  const stirrupCountPerM = input.stirrupSpacing > 0 ? Math.floor(basis / input.stirrupSpacing + 1e-9) : 0;
  const totalStirrupLengthPerM = stirrupLength * stirrupCountPerM;
  const stirrupKgPerM = totalStirrupLengthPerM * (weights[input.stirrupDia] ?? 0);
  const stirrupKgPerM3 = concreteVolumeM3 > 0 ? stirrupKgPerM / concreteVolumeM3 : 0;

  const mainRebarLengthPerM = input.mainCount * basis;
  const mainRebarKgPerM = mainRebarLengthPerM * (weights[input.mainDia] ?? 0);
  const mainRebarKgPerM3 = concreteVolumeM3 > 0 ? mainRebarKgPerM / concreteVolumeM3 : 0;

  const totalKgPerM3 = stirrupKgPerM3 + mainRebarKgPerM3;

  return {
    concreteVolumeM3,
    stirrupLength,
    stirrupCountPerM,
    totalStirrupLengthPerM,
    stirrupKgPerM,
    stirrupKgPerM3,
    mainCount: input.mainCount,
    mainRebarLengthPerM,
    mainRebarKgPerM,
    mainRebarKgPerM3,
    totalKgPerM3,
  };
}

export function validateStrip(input: StripInput): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { cover, width, height, stirrupSpacing, stirrupOverlap, mainCount } = input;

  if (width <= 0) errors.push("Foundation width must be greater than 0 m.");
  if (height <= 0) errors.push("Foundation height must be greater than 0 m.");
  if (stirrupSpacing <= 0) errors.push("Stirrup spacing must be greater than 0 m.");
  if (cover < 0) errors.push("Concrete cover cannot be negative.");
  if (stirrupOverlap < 0) errors.push("Stirrup overlap cannot be negative.");
  if (mainCount < 0) errors.push("Number of main rebars cannot be negative.");
  if (width > 0 && cover > width / 2) errors.push("Cover cannot exceed half of the width.");
  if (height > 0 && cover > height / 2) errors.push("Cover cannot exceed half of the height.");

  if (width - 2 * cover <= 0 || height - 2 * cover <= 0) warnings.push("Cover leaves no core — check cover vs dimensions.");
  if (width > 0 && height > 0 && stirrupSpacing > Math.min(width, height)) warnings.push("Stirrup spacing is larger than the section — unusually few stirrups.");
  if (mainCount === 0) warnings.push("No main reinforcement bars specified.");
  if (cover > 0.075) warnings.push("Cover over 75 mm is unusually large.");
  if (stirrupSpacing > 0.3) warnings.push("Stirrup spacing over 300 mm is unusual for a foundation.");
  if (width > 3 || height > 3) warnings.push("Dimensions over 3 m are unusual for a strip foundation — check units (metres).");

  return { errors, warnings };
}

/* ---------------- Reusable element helpers (shared by all RC elements) ---------------- */

export const calculateConcreteVolume = (width: number, depth: number, length = 1): number => width * depth * length;
/** Whole stirrups per metre (rounded down — no partial stirrups). */
export const calculateStirrupCountPerMeter = (spacing: number): number => (spacing > 0 ? Math.floor(1 / spacing + 1e-9) : 0);
export const calculateClosedRectangularStirrupLength = (widthA: number, widthB: number, cover: number, overlap: number): number =>
  2 * (widthA - 2 * cover) + 2 * (widthB - 2 * cover) + overlap;
export const calculateRebarWeight = (length: number, kgPerMeter: number): number => length * kgPerMeter;
export const calculateKgPerM3 = (kgPerMeter: number, concreteVolumeM3: number): number =>
  concreteVolumeM3 > 0 ? kgPerMeter / concreteVolumeM3 : 0;

/* ---------------- Column (rectangular / square RC column) ---------------- */

export type ColumnInput = {
  cover: number; // m
  widthA: number; // m
  widthB: number; // m
  stirrupDia: RebarDiameter;
  stirrupSpacing: number; // m
  stirrupOverlap: number; // m
  mainDia: RebarDiameter;
  mainCount: number;
  barLengthBasis: number; // m per main bar
};

export function calculateColumnRebarKgPerM3(input: ColumnInput, weights: RebarWeights = DEFAULT_REBAR_WEIGHTS): RebarBreakdown {
  const concreteVolumeM3 = calculateConcreteVolume(input.widthA, input.widthB, 1);
  const stirrupLength = calculateClosedRectangularStirrupLength(input.widthA, input.widthB, input.cover, input.stirrupOverlap);
  const stirrupCountPerM = calculateStirrupCountPerMeter(input.stirrupSpacing);
  const totalStirrupLengthPerM = stirrupLength * stirrupCountPerM;
  const stirrupKgPerM = calculateRebarWeight(totalStirrupLengthPerM, weights[input.stirrupDia] ?? 0);
  const stirrupKgPerM3 = calculateKgPerM3(stirrupKgPerM, concreteVolumeM3);

  const mainRebarLengthPerM = input.mainCount * input.barLengthBasis; // total main length
  const mainRebarKgPerM = calculateRebarWeight(mainRebarLengthPerM, weights[input.mainDia] ?? 0);
  const mainRebarKgPerM3 = calculateKgPerM3(mainRebarKgPerM, concreteVolumeM3);

  const totalKgPerM3 = stirrupKgPerM3 + mainRebarKgPerM3;

  return {
    concreteVolumeM3,
    stirrupLength,
    stirrupCountPerM,
    totalStirrupLengthPerM,
    stirrupKgPerM,
    stirrupKgPerM3,
    mainCount: input.mainCount,
    mainRebarLengthPerM,
    mainRebarKgPerM,
    mainRebarKgPerM3,
    totalKgPerM3,
  };
}

export function validateColumn(input: ColumnInput): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { cover, widthA, widthB, stirrupSpacing, stirrupOverlap, mainCount, barLengthBasis } = input;

  if (widthA <= 0) errors.push("Width A must be greater than 0 m.");
  if (widthB <= 0) errors.push("Width B must be greater than 0 m.");
  if (stirrupSpacing <= 0) errors.push("Stirrup spacing must be greater than 0 m.");
  if (barLengthBasis <= 0) errors.push("Bar length basis must be greater than 0 m.");
  if (cover < 0) errors.push("Concrete cover cannot be negative.");
  if (stirrupOverlap < 0) errors.push("Stirrup overlap cannot be negative.");
  if (mainCount < 4) errors.push("A column needs at least 4 main bars.");
  if (widthA > 0 && cover >= widthA / 2) errors.push("Cover cannot be ≥ half of Width A.");
  if (widthB > 0 && cover >= widthB / 2) errors.push("Cover cannot be ≥ half of Width B.");

  const small = Math.min(widthA, widthB);
  const large = Math.max(widthA, widthB);
  if (small > 0 && small < 0.2) warnings.push("Column dimension below 200 mm is unusually small.");
  if (large > 1.5) warnings.push("Column dimension above 1.50 m is unusually large.");
  if (stirrupSpacing > 0.3) warnings.push("Stirrup spacing over 300 mm is unusual for a column.");
  return { errors, warnings };
}

/* ---------------- RC Beam / Ring Beam (5-zone reinforcement engine) ---------------- */

export type RebarZoneInput = { label: string; dia: RebarDiameter | 0; quantity: number; lengthFactor: number };

export type BeamInput = {
  cover: number; // m
  width: number; // m
  height: number; // m
  stirrupDia: RebarDiameter;
  stirrupSpacing: number; // m
  stirrupOverlap: number; // m
  zones: RebarZoneInput[]; // A, B, C, D, E
};

/** Per-zone weight per linear metre (1.00 m basis). Ø0 / None contributes nothing. */
export function calculateRebarZoneKgPerM(zone: RebarZoneInput, weights: RebarWeights, concreteVolumeM3: number): ZoneResult {
  const kgPerMeter = zone.dia ? weights[zone.dia] ?? 0 : 0;
  const totalLength = zone.quantity * zone.lengthFactor * 1.0;
  const kgPerM = totalLength * kgPerMeter;
  const kgPerM3 = calculateKgPerM3(kgPerM, concreteVolumeM3);
  return { label: zone.label, dia: zone.dia, quantity: zone.quantity, lengthFactor: zone.lengthFactor, totalLength, kgPerM, kgPerM3 };
}

export function calculateBeam(input: BeamInput, weights: RebarWeights = DEFAULT_REBAR_WEIGHTS): RebarBreakdown {
  const concreteVolumeM3 = calculateConcreteVolume(input.width, input.height, 1);
  const stirrupLength = calculateClosedRectangularStirrupLength(input.width, input.height, input.cover, input.stirrupOverlap);
  const stirrupCountPerM = calculateStirrupCountPerMeter(input.stirrupSpacing);
  const totalStirrupLengthPerM = stirrupLength * stirrupCountPerM;
  const stirrupKgPerM = calculateRebarWeight(totalStirrupLengthPerM, weights[input.stirrupDia] ?? 0);
  const stirrupKgPerM3 = calculateKgPerM3(stirrupKgPerM, concreteVolumeM3);

  const zones = input.zones.map((z) => calculateRebarZoneKgPerM(z, weights, concreteVolumeM3));
  const mainRebarLengthPerM = zones.reduce((s, z) => s + z.totalLength, 0);
  const mainRebarKgPerM = zones.reduce((s, z) => s + z.kgPerM, 0);
  const mainRebarKgPerM3 = calculateKgPerM3(mainRebarKgPerM, concreteVolumeM3);
  const mainCount = input.zones.reduce((s, z) => s + (z.dia ? z.quantity : 0), 0);

  const totalKgPerM3 = stirrupKgPerM3 + mainRebarKgPerM3;

  return {
    zones,
    concreteVolumeM3,
    stirrupLength,
    stirrupCountPerM,
    totalStirrupLengthPerM,
    stirrupKgPerM,
    stirrupKgPerM3,
    mainCount,
    mainRebarLengthPerM,
    mainRebarKgPerM,
    mainRebarKgPerM3,
    totalKgPerM3,
  };
}

export function validateBeam(input: BeamInput): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { cover, width, height, stirrupSpacing, stirrupOverlap } = input;

  if (width <= 0) errors.push("Beam width must be greater than 0 m.");
  if (height <= 0) errors.push("Beam height must be greater than 0 m.");
  if (stirrupSpacing <= 0) errors.push("Stirrup spacing must be greater than 0 m.");
  if (cover < 0) errors.push("Concrete cover cannot be negative.");
  if (stirrupOverlap < 0) errors.push("Stirrup overlap cannot be negative.");
  const small = Math.min(width, height);
  if (small > 0 && cover >= small / 2) errors.push("Cover cannot be ≥ half of the smallest dimension.");
  for (const z of input.zones) {
    if (z.quantity < 0) errors.push(`${z.label}: quantity cannot be negative.`);
    if (z.lengthFactor < 0) errors.push(`${z.label}: length factor cannot be negative.`);
  }

  if (height > 0 && height < 0.25) warnings.push("Beam height below 250 mm is unusual.");
  if (width > 0 && width < 0.15) warnings.push("Beam width below 150 mm is unusual.");
  if (cover < 0.02) warnings.push("Cover below 20 mm is unusually small.");
  if (cover > 0.08) warnings.push("Cover above 80 mm is unusually large.");
  if (stirrupSpacing > 0.3) warnings.push("Stirrup spacing over 300 mm is unusual for a beam.");
  return { errors, warnings };
}

/* ---------------- Requested named API (aliases over the engine) ---------------- */

export type RebarCalculationResult = RebarBreakdown;
export type StripFoundationInput = StripInput;
export type RebarWeightSetting = { diameter: RebarDiameter; kgPerMeter: number };
export type StirrupInput = { dia: RebarDiameter; spacing: number; overlap: number };

export const getRebarKgPerMeter = (dia: RebarDiameter, weights: RebarWeights = DEFAULT_REBAR_WEIGHTS): number => weights[dia] ?? 0;
export const calculateOpenUStirrupLength = (width: number, height: number, cover: number, overlap: number): number =>
  (width - 2 * cover) + (height - 2 * cover) + overlap;
export const calculateStripFoundationType1 = (input: StripInput, weights?: RebarWeights): RebarBreakdown => calcStripFoundation("type1", input, weights);
export const calculateStripFoundationType2 = (input: StripInput, weights?: RebarWeights): RebarBreakdown => calcStripFoundation("type2", input, weights);
export const calculateColumn = calculateColumnRebarKgPerM3;

/* ---------------- RC Slab (mesh reinforcement, per m²) ---------------- */

export type SlabDirectionInput = {
  dia: RebarDiameter;
  spacing: number; // m O.C.
  barLengthBasis: number; // m (or length factor for top mesh)
  overlapEnabled: boolean;
  overlapLength: number; // m
};

export type SlabInput = {
  cover: number; // m
  thickness: number; // m
  area: number; // calculation area m²
  bottomX: SlabDirectionInput;
  bottomY: SlabDirectionInput;
  topEnabled: boolean;
  topX: SlabDirectionInput;
  topY: SlabDirectionInput;
};

export type SlabDirectionResult = {
  dia: RebarDiameter;
  spacing: number;
  barsPerMeter: number;
  totalBarLengthPerM2: number;
  kgPerM2: number;
  kgPerM3: number;
};

export type SlabCalculationResult = {
  concreteVolumeM3: number;
  bottomX: SlabDirectionResult;
  bottomY: SlabDirectionResult;
  topX?: SlabDirectionResult;
  topY?: SlabDirectionResult;
  totalKgPerM3: number;
};

export const calculateSlabConcreteVolume = (thickness: number, area = 1): number => thickness * area;
/** Mesh bars per metre — continuous rate (1/spacing), NOT rounded (slabs are not whole-bar limited like stirrups). */
export const calculateBarsPerMeter = (spacing: number): number => (spacing > 0 ? 1 / spacing : 0);
export const calculateSlabBarLengthPerM2 = (spacing: number, barLengthBasis: number, area: number, overlapLength = 0): number => {
  const bpm = calculateBarsPerMeter(spacing);
  const base = bpm * barLengthBasis * area;
  return overlapLength > 0 ? base + bpm * overlapLength : base;
};
export const calculateSlabDirectionKgPerM2 = (totalLength: number, kgPerMeter: number): number => totalLength * kgPerMeter;
export const calculateSlabDirectionKgPerM3 = (kgPerM2: number, concreteVolumeM3: number): number =>
  concreteVolumeM3 > 0 ? kgPerM2 / concreteVolumeM3 : 0;

export function calculateSlabRebarKgPerM3(input: SlabInput, weights: RebarWeights = DEFAULT_REBAR_WEIGHTS): SlabCalculationResult {
  const concreteVolumeM3 = calculateSlabConcreteVolume(input.thickness, input.area);

  const dir = (d: SlabDirectionInput): SlabDirectionResult => {
    const barsPerMeter = calculateBarsPerMeter(d.spacing);
    const overlap = d.overlapEnabled ? Math.max(0, d.overlapLength) : 0;
    const totalBarLengthPerM2 = calculateSlabBarLengthPerM2(d.spacing, d.barLengthBasis, input.area, overlap);
    const kgPerM2 = calculateSlabDirectionKgPerM2(totalBarLengthPerM2, weights[d.dia] ?? 0);
    const kgPerM3 = calculateSlabDirectionKgPerM3(kgPerM2, concreteVolumeM3);
    return { dia: d.dia, spacing: d.spacing, barsPerMeter, totalBarLengthPerM2, kgPerM2, kgPerM3 };
  };

  const bottomX = dir(input.bottomX);
  const bottomY = dir(input.bottomY);
  const topX = input.topEnabled ? dir(input.topX) : undefined;
  const topY = input.topEnabled ? dir(input.topY) : undefined;

  const totalKgPerM3 = bottomX.kgPerM3 + bottomY.kgPerM3 + (topX?.kgPerM3 ?? 0) + (topY?.kgPerM3 ?? 0);
  return { concreteVolumeM3, bottomX, bottomY, topX, topY, totalKgPerM3 };
}

export function validateSlab(input: SlabInput): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { cover, thickness, area, bottomX, bottomY, topEnabled, topX, topY } = input;

  if (thickness <= 0) errors.push("Slab thickness must be greater than 0 m.");
  if (area <= 0) errors.push("Calculation area must be greater than 0 m².");
  if (cover < 0) errors.push("Concrete cover cannot be negative.");
  if (thickness > 0 && cover >= thickness / 2) errors.push("Cover cannot be ≥ half of the slab thickness.");

  const dirs: { name: string; d: SlabDirectionInput; check: boolean }[] = [
    { name: "Bottom X", d: bottomX, check: true },
    { name: "Bottom Y", d: bottomY, check: true },
    { name: "Top X", d: topX, check: topEnabled },
    { name: "Top Y", d: topY, check: topEnabled },
  ];
  for (const { name, d, check } of dirs) {
    if (!check) continue;
    if (d.spacing <= 0) errors.push(`${name}: spacing must be greater than 0 m.`);
    if (d.overlapEnabled && d.overlapLength < 0) errors.push(`${name}: overlap length cannot be negative.`);
    if (d.spacing > 0 && d.spacing < 0.075) warnings.push(`${name}: spacing below 75 mm is unusually tight.`);
    if (d.spacing > 0.3) warnings.push(`${name}: spacing above 300 mm is unusual.`);
  }
  if (thickness > 0 && thickness < 0.08) warnings.push("Slab thickness below 80 mm is unusual.");
  if (thickness > 0.35) warnings.push("Slab thickness above 350 mm is unusual.");
  return { errors, warnings };
}
