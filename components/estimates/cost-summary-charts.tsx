"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Always-on Cost Summary charts — a donut of the cost composition and a bar of the
 * cost per section, shown directly under the Cost Summary for a quick read.
 *
 * Theme-awareness: recharts wants concrete colours, but the app recolours by toggling
 * a `.dark` class on <html>, so a hard-coded hex would go wrong in one mode. Axes and
 * gridlines therefore paint with `currentColor`, inherited from the wrapper's text
 * colour token, and the tooltip is a plain Tailwind div. Only the segment fills are
 * literal hexes — those are the caller's palette and are legible on both backgrounds.
 */

export type CostSegment = {
  label: string;
  value: number;
  color: string;
  /** Money string, pre-formatted by the caller (may carry a dual-currency suffix). */
  amount: string;
  /** Profit & Risk / BBO show their markup RATE, not their share of the total. */
  pctOverride?: number;
};

export type CostSection = { name: string; cost: number };

/** Section bars cycle this palette — sections are user-defined, so there's no fixed map. */
const SECTION_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#0ea5e9", "#22c55e", "#64748b"];

/**
 * The Y axis is one gutter holding TWO runs: the section name (left-aligned) and its
 * share of the total (right-aligned, hard against the bars). Splitting the widths here
 * keeps the % in its own visual column instead of drifting with the name length.
 */
const NAME_W = 240; // room for the name — widened so long section names aren't clipped
const PCT_W = 42; // room for the "12%" column between the name and the bar
const AXIS_W = NAME_W + PCT_W;
const PER_LINE_CHARS = 40; // ~chars of 10px type that fit NAME_W on one line
const MAX_LINES = 2; // a name too long for one line wraps to a second before ellipsising

/** Vertical room per bar — enough for a two-line label without crowding. */
const ROW_H = 40;
const MIN_CHART_H = 200;

/** Greedily pack words into at most MAX_LINES lines; ellipsise only if it still overflows. */
function wrapName(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return [name];
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (next.length <= PER_LINE_CHARS || !cur) {
      cur = next;
    } else {
      lines.push(cur);
      if (lines.length === MAX_LINES - 1) {
        // Final line takes every remaining word (ellipsised below if too long).
        cur = words.slice(i).join(" ");
        break;
      }
      cur = words[i];
    }
  }
  lines.push(cur);
  const capped = lines.slice(0, MAX_LINES);
  const last = capped.length - 1;
  if (capped[last].length > PER_LINE_CHARS) {
    capped[last] = `${capped[last].slice(0, PER_LINE_CHARS - 1)}…`;
  }
  return capped;
}

/**
 * Section label + % share. Recharts' default tick is a <Text> that wraps unpredictably
 * and shoved the bars around. This renders the name as up to two controlled <tspan>
 * lines, then ellipsises — so a long name stays readable instead of being clipped mid-
 * word. The full name is always in the SVG <title> (hover) and the tooltip.
 */
function SectionTick({
  x,
  y,
  payload,
  pctOf,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
  pctOf?: (name: string) => number;
}) {
  const full = String(payload?.value ?? "");
  const lines = wrapName(full);
  const right = x ?? 0; // axis edge — the bars start here
  const pct = pctOf?.(full) ?? 0;
  // Vertically center the block of lines on the tick's y.
  const startDy = 4 - ((lines.length - 1) * 11) / 2;
  return (
    <g fill="currentColor" fontSize={10}>
      <text x={right - AXIS_W} y={y} textAnchor="start">
        <title>{full}</title>
        {lines.map((ln, i) => (
          <tspan key={i} x={right - AXIS_W} dy={i === 0 ? startDy : 11}>
            {ln}
          </tspan>
        ))}
      </text>
      {/* % sits between the name and the chart, right-aligned so the digits line up. */}
      <text x={right - 8} y={y} dy={4} textAnchor="end" fontWeight={600} opacity={0.75}>
        {pct.toFixed(0)}%
      </text>
    </g>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">{title}</div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-xs text-faint">
      {label}
    </div>
  );
}

function TooltipBox({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg">
      <div className="font-medium text-fg">{name}</div>
      <div className="tabular-nums text-muted">{value}</div>
    </div>
  );
}

export function CostSummaryCharts({
  segments,
  sections,
  money,
}: {
  segments: CostSegment[];
  sections: CostSection[];
  money: (n: number) => string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const pctOf = (s: CostSegment) => (s.pctOverride != null ? s.pctOverride : total > 0 ? (s.value / total) * 100 : 0);

  // Section shares are of the DIRECT-cost total (the sum of the bars), not the grand
  // total — a section's % must be its share of the chart it's drawn in, or the bars and
  // the numbers would disagree.
  const sectionTotal = sections.reduce((a, s) => a + s.cost, 0);
  const sectionPct = (name: string) => {
    const s = sections.find((x) => x.name === name);
    return s && sectionTotal > 0 ? (s.cost / sectionTotal) * 100 : 0;
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      {/* Composition — labour / material / equipment / subs / GC / profit / BBO */}
      <Panel title="Cost Composition">
        {total > 0 ? (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="h-48 w-full max-w-[220px] shrink-0 text-faint">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segments}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {segments.map((s) => (
                      <Cell key={s.label} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const s = payload[0].payload as CostSegment;
                      return <TooltipBox name={s.label} value={s.amount} />;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend — carries the numbers, so the donut stays label-free and readable. */}
            <ul className="min-w-0 flex-1 space-y-1">
              {segments.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1 truncate text-muted">{s.label}</span>
                  <span className="shrink-0 tabular-nums font-medium text-fg">{s.amount}</span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-faint">
                    {pctOf(s).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty label="Add priced items to see the cost composition." />
        )}
      </Panel>

      {/* Per-section direct cost */}
      <Panel title="Cost by Section">
        {sections.length ? (
          // Height grows with the number of sections — a fixed 192px crammed the labels
          // on top of each other once a sheet had more than ~5 sections.
          <div
            className="w-full text-faint"
            style={{ height: Math.max(MIN_CHART_H, sections.length * ROW_H + 16) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sections} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={AXIS_W}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={<SectionTick pctOf={sectionPct} />}
                />
                <Tooltip
                  cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const s = payload[0].payload as CostSection;
                    return <TooltipBox name={s.name} value={money(s.cost)} />;
                  }}
                />
                <Bar dataKey="cost" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
                  {sections.map((s, i) => (
                    <Cell key={s.name} fill={SECTION_COLORS[i % SECTION_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty label="Add a section to see cost by section." />
        )}
      </Panel>
    </div>
  );
}
