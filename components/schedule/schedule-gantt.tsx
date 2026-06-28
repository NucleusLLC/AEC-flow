"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Printer,
  ZoomIn,
  ZoomOut,
  Link2,
  GitBranch,
  Plus,
  Trash2,
  X,
  CornerDownRight,
  ChevronUp,
  ChevronDown,
  Tag,
  CalendarCog,
  CircleDollarSign,
  Save,
  Check,
  Loader2,
} from "lucide-react";
import { saveScheduleAction } from "@/app/(app)/schedule/actions";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { StatusBoard } from "@/components/schedule/status-board";
import {
  HOURS_PER_DAY,
  computeCpm,
  computeScheduleHealth,
  addDaysIso,
  diffDaysIso,
  durationDays,
  toScheduleDate,
  type ProjectSchedule,
  type ScheduleTask,
  type Discipline,
} from "@/lib/data/schedule";

const LABEL_W = 252;
const ROW_H = 44;
const HEADER_H = 48;
const BAR_H = 22;

type Scale = "day" | "week" | "month" | "year";
const BASE_PX: Record<Scale, number> = { day: 28, week: 10, month: 3.6, year: 1.1 };
const SCALES: Scale[] = ["day", "week", "month", "year"];

// Editable task categories. Defaults cover the firm's disciplines plus
// Construction / Orders / Critical; users can add, rename, recolour, or remove.
type Category = { id: string; label: string; color: string };
const DEFAULT_CATEGORIES: Category[] = [
  { id: "architecture", label: "Architecture", color: "#2563eb" },
  { id: "structural", label: "Structural", color: "#7c3aed" },
  { id: "interior", label: "Interior", color: "#db2777" },
  { id: "mep", label: "MEP", color: "#0891b2" },
  { id: "project-mgmt", label: "Project Mgmt", color: "#16a34a" },
  { id: "construction", label: "Construction", color: "#ea580c" },
  { id: "orders", label: "Orders", color: "#ca8a04" },
  { id: "critical", label: "Critical", color: "#dc2626" },
];
const DISCIPLINE_TO_CAT: Record<Discipline, string> = {
  ARCHITECTURE: "architecture",
  STRUCTURAL: "structural",
  INTERIOR: "interior",
  MEP: "mep",
  PROJECT_MANAGEMENT: "project-mgmt",
};

// Editable sub-categories per category. Seeded with construction activities;
// users can add their own from the sub-category dropdown.
const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  architecture: [
    "Concept Design",
    "Schematic Design",
    "Design Development",
    "Construction Drawings",
    "Detailed Design",
    "Tender Documentation",
    "Authority Submission",
    "Permit / NOC",
    "Construction Administration",
    "Site Supervision",
    "As-Built Drawings",
  ],
  construction: [
    "General Conditions",
    "Mobilisation",
    "Demolition",
    "Land Clearing",
    "Grading",
    "Land Surveying",
    "Excavation",
    "Rebar Works",
    "Concrete Works",
    "Concrete Pouring",
    "Masonry Works",
    "Impermeabilisation Works",
    "Land Fill & Compacting",
    "Rebar Sheet Works",
    "Electrical Works",
    "Plastic Membrane Works",
    "Termite Treatment",
    "Floor Trowelling",
    "Concrete Curing",
    "Set Profiles",
    "Set Windows & Door Mockups",
    "Concrete Formwork",
    "Column Concrete Pouring",
    "Masonry Wall Works",
    "Ringbeam Rebar Works",
    "Ringbeam Formworks",
    "Roof Girder Works",
    "Set Anchors into Columns",
    "Set Steel Beam",
    "Plywood Sheathing Works",
    "Lay Asphalt Papers",
    "Set Roof Impermeabilisation",
    "Set Faceboard",
  ],
};

const ADD_SENTINEL = "__add_subcategory__";

// Official public/company holidays (editable). Seeded with UAE 2026.
const DEFAULT_HOLIDAYS = [
  "2026-06-17", // Islamic New Year
  "2026-08-25", // Prophet's Birthday
  "2026-12-01", // Commemoration Day
  "2026-12-02", // National Day
  "2026-12-03", // National Day holiday
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";

const isoToday = () => new Date().toISOString().slice(0, 10);

export function ScheduleGantt({ schedules }: { schedules: ProjectSchedule[] }) {
  const [selectedId, setSelectedId] = useState(schedules[0]?.projectId ?? "");
  const selected = schedules.find((s) => s.projectId === selectedId) ?? schedules[0];

  if (!selected) return <p className="text-sm text-muted">No schedules available.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-9 max-w-full rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          {schedules.map((s) => (
            <option key={s.projectId} value={s.projectId}>
              {s.projectNumber} — {s.projectName}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <Link
            href={`/print/schedule/${selected.projectId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Printer className="h-3.5 w-3.5" /> Print preview
          </Link>
        </div>
      </div>

      {/* Remount per project so local edits reset cleanly */}
      <GanttBoard key={selected.projectId} schedule={selected} />
    </div>
  );
}

type Ordered = { task: ScheduleTask; depth: number };

function GanttBoard({ schedule }: { schedule: ProjectSchedule }) {
  const [tasks, setTasks] = useState<ScheduleTask[]>(schedule.tasks);
  // Persistence — Save the whole programme (tasks + dependencies) to the DB.
  // `dirty` is derived from a ref of the last-saved task list (no setState-in-effect).
  const [savePending, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [scale, setScale] = useState<Scale>("week");
  const [zoom, setZoom] = useState(1);
  const [offDays, setOffDays] = useState<number[]>(schedule.config?.offDays ?? [5, 6]); // Fri, Sat (UAE)
  const [showCritical, setShowCritical] = useState(true);
  const [showBudget, setShowBudget] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>(schedule.config?.categories ?? DEFAULT_CATEGORIES);
  const [subcats, setSubcats] = useState<Record<string, string[]>>(schedule.config?.subcats ?? DEFAULT_SUBCATEGORIES);
  const [newCat, setNewCat] = useState<string>("project-mgmt");
  const [newSub, setNewSub] = useState<string>("");
  const [catPanel, setCatPanel] = useState(false);
  const [hoursPerDay, setHoursPerDay] = useState(schedule.config?.hoursPerDay ?? HOURS_PER_DAY);
  const [holidays, setHolidays] = useState<string[]>(schedule.config?.holidays ?? DEFAULT_HOLIDAYS);
  const [newHoliday, setNewHoliday] = useState("");
  const [calPanel, setCalPanel] = useState(false);
  const [statusDate, setStatusDate] = useState(schedule.config?.statusDate ?? isoToday());
  const idCounter = useRef(1);

  // --- Persistence (declared after the config state above so Save can include it) ---
  const boardConfig = { categories, subcats, hoursPerDay, offDays, holidays, statusDate };
  const configJson = JSON.stringify(boardConfig);
  const [savedTasks, setSavedTasks] = useState<ScheduleTask[]>(schedule.tasks);
  const [savedConfigJson, setSavedConfigJson] = useState(configJson);
  const dirty = tasks !== savedTasks || configJson !== savedConfigJson;
  const onSave = () => {
    setSaveError(null);
    const snapshot = tasks;
    const cfgJson = configJson;
    startSave(async () => {
      const res = await saveScheduleAction({
        projectId: schedule.projectId,
        projectNumber: schedule.projectNumber,
        projectName: schedule.projectName,
        client: schedule.client,
        manager: schedule.manager,
        tasks: snapshot,
        config: boardConfig,
      });
      if (res.ok) {
        setSavedTasks(snapshot);
        setSavedConfigJson(cfgJson);
      } else {
        setSaveError(res.error);
      }
    });
  };

  function addHoliday() {
    if (!newHoliday) return;
    setHolidays((prev) => (prev.includes(newHoliday) ? prev : [...prev, newHoliday].sort()));
    setNewHoliday("");
  }
  function removeHoliday(d: string) {
    setHolidays((prev) => prev.filter((x) => x !== d));
  }

  const subsFor = (catId: string) => subcats[catId] ?? [];
  // Prompt for + add a sub-category to a category; returns the new label or null.
  function addSubcategory(catId: string): string | null {
    const label = window.prompt("New sub-category");
    if (!label || !label.trim()) return null;
    const v = label.trim();
    setSubcats((prev) => {
      const list = prev[catId] ?? [];
      return list.includes(v) ? prev : { ...prev, [catId]: [...list, v] };
    });
    return v;
  }

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const resolveCat = (t: ScheduleTask): Category =>
    catById.get(t.category ?? DISCIPLINE_TO_CAT[t.discipline]) ?? categories[0];

  function addCategory() {
    const label = window.prompt("New category name");
    if (!label || !label.trim()) return;
    let id = slugify(label);
    if (categories.some((c) => c.id === id)) id = `${id}-${idCounter.current++}`;
    setCategories((prev) => [...prev, { id, label: label.trim(), color: "#64748b" }]);
  }
  function renameCategory(id: string) {
    const c = categories.find((x) => x.id === id);
    const label = window.prompt("Rename category", c?.label ?? "");
    if (label && label.trim())
      setCategories((prev) => prev.map((x) => (x.id === id ? { ...x, label: label.trim() } : x)));
  }
  function setCatColor(id: string, color: string) {
    setCategories((prev) => prev.map((x) => (x.id === id ? { ...x, color } : x)));
  }
  function deleteCategory(id: string) {
    if (categories.length <= 1) return;
    const fallback = categories.find((c) => c.id !== id)!.id;
    setCategories((prev) => prev.filter((x) => x.id !== id));
    setTasks((prev) => prev.map((t) => ((t.category ?? "") === id ? { ...t, category: fallback } : t)));
    if (newCat === id) setNewCat(fallback);
  }

  const pxPerDay = BASE_PX[scale] * zoom;

  // Display order: top-level tasks then their children (one level), indented.
  const ordered = useMemo<Ordered[]>(() => {
    const tops = tasks.filter((t) => !t.parentId || !tasks.some((p) => p.id === t.parentId));
    const out: Ordered[] = [];
    for (const t of tops) {
      out.push({ task: t, depth: 0 });
      for (const c of tasks.filter((x) => x.parentId === t.id)) out.push({ task: c, depth: 1 });
    }
    return out;
  }, [tasks]);

  const indexOf = useMemo(() => {
    const m = new Map<string, number>();
    ordered.forEach((o, i) => m.set(o.task.id, i));
    return m;
  }, [ordered]);

  const cpm = useMemo(() => computeCpm(tasks), [tasks]);
  const health = useMemo(
    () => computeScheduleHealth(tasks, statusDate, cpm.critical),
    [tasks, statusDate, cpm],
  );

  // Time window (padded so bars can be dragged/stretched past current extremes).
  const { windowStart, windowEnd, totalDays } = useMemo(() => {
    const starts = tasks.map((t) => t.start).sort();
    const ends = tasks.map((t) => t.end).sort();
    const ws = addDaysIso(starts[0] ?? isoToday(), -7);
    const we = addDaysIso(ends[ends.length - 1] ?? addDaysIso(isoToday(), 30), 21);
    return { windowStart: ws, windowEnd: we, totalDays: diffDaysIso(ws, we) + 1 };
  }, [tasks]);

  const timelineWidth = Math.max(320, totalDays * pxPerDay);
  const x = (iso: string) => diffDaysIso(windowStart, iso) * pxPerDay;
  const rowCenter = (i: number) => i * ROW_H + ROW_H / 2;

  // ── Header bands ──────────────────────────────────────────────────────────
  const header = useMemo(() => {
    const ws = toScheduleDate(windowStart);
    const we = toScheduleDate(windowEnd);
    const major: Array<{ label: string; left: number; width: number }> = [];
    const minor: Array<{ label: string; left: number; width: number }> = [];

    const monthBands = () => {
      let c = new Date(ws.getFullYear(), ws.getMonth(), 1);
      while (c <= we) {
        const next = new Date(c.getFullYear(), c.getMonth() + 1, 1);
        const segStart = c < ws ? ws : c;
        const segEnd = new Date(Math.min(next.getTime() - 86_400_000, we.getTime()));
        major.push({
          label: c.toLocaleDateString("en-AE", { month: "short", year: "2-digit" }),
          left: (diffDaysIso(windowStart, segStart.toISOString().slice(0, 10))) * pxPerDay,
          width: (diffDaysIso(segStart.toISOString().slice(0, 10), segEnd.toISOString().slice(0, 10)) + 1) * pxPerDay,
        });
        c = next;
      }
    };
    const yearBands = () => {
      let y = ws.getFullYear();
      while (y <= we.getFullYear()) {
        const segStart = new Date(Math.max(new Date(y, 0, 1).getTime(), ws.getTime()));
        const segEnd = new Date(Math.min(new Date(y, 11, 31).getTime(), we.getTime()));
        major.push({
          label: String(y),
          left: diffDaysIso(windowStart, segStart.toISOString().slice(0, 10)) * pxPerDay,
          width: (diffDaysIso(segStart.toISOString().slice(0, 10), segEnd.toISOString().slice(0, 10)) + 1) * pxPerDay,
        });
        y += 1;
      }
    };

    if (scale === "day") {
      monthBands();
      for (let i = 0; i < totalDays; i++) {
        const d = toScheduleDate(addDaysIso(windowStart, i));
        minor.push({ label: String(d.getDate()), left: i * pxPerDay, width: pxPerDay });
      }
    } else if (scale === "week") {
      monthBands();
      for (let i = 0; i < totalDays; i += 7) {
        const d = toScheduleDate(addDaysIso(windowStart, i));
        minor.push({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          left: i * pxPerDay,
          width: 7 * pxPerDay,
        });
      }
    } else if (scale === "month") {
      yearBands();
      let c = new Date(ws.getFullYear(), ws.getMonth(), 1);
      while (c <= we) {
        const next = new Date(c.getFullYear(), c.getMonth() + 1, 1);
        const segStart = c < ws ? ws : c;
        minor.push({
          label: c.toLocaleDateString("en-AE", { month: "short" }),
          left: diffDaysIso(windowStart, segStart.toISOString().slice(0, 10)) * pxPerDay,
          width: Math.round(((Math.min(next.getTime(), we.getTime() + 86_400_000) - segStart.getTime()) / 86_400_000) * pxPerDay),
        });
        c = next;
      }
    } else {
      yearBands();
      let y = ws.getFullYear();
      while (y <= we.getFullYear()) {
        const segStart = new Date(Math.max(new Date(y, 0, 1).getTime(), ws.getTime()));
        const segEnd = new Date(Math.min(new Date(y, 11, 31).getTime(), we.getTime()));
        minor.push({
          label: String(y),
          left: diffDaysIso(windowStart, segStart.toISOString().slice(0, 10)) * pxPerDay,
          width: (diffDaysIso(segStart.toISOString().slice(0, 10), segEnd.toISOString().slice(0, 10)) + 1) * pxPerDay,
        });
        y += 1;
      }
    }
    return { major, minor };
  }, [windowStart, windowEnd, totalDays, scale, pxPerDay]);

  // Off-day (weekend) shading — only when columns are wide enough to matter.
  const offBands = useMemo(() => {
    if (pxPerDay < 6 || offDays.length === 0) return [];
    const bands: Array<{ left: number; width: number }> = [];
    for (let i = 0; i < totalDays; i++) {
      const d = toScheduleDate(addDaysIso(windowStart, i));
      if (offDays.includes(d.getDay())) bands.push({ left: i * pxPerDay, width: pxPerDay });
    }
    return bands;
  }, [pxPerDay, offDays, totalDays, windowStart]);

  const holidayBands = useMemo(() => {
    const set = new Set(holidays);
    const out: Array<{ left: number; iso: string }> = [];
    for (let i = 0; i < totalDays; i++) {
      const iso = addDaysIso(windowStart, i);
      if (set.has(iso)) out.push({ left: i * pxPerDay, iso });
    }
    return out;
  }, [holidays, totalDays, windowStart, pxPerDay]);

  const todayLeft = useMemo(() => {
    const t = isoToday();
    if (diffDaysIso(windowStart, t) < 0 || diffDaysIso(t, windowEnd) < 0) return null;
    return diffDaysIso(windowStart, t) * pxPerDay;
  }, [windowStart, windowEnd, pxPerDay]);

  const rowsHeight = ordered.length * ROW_H;

  // ── Mutations ───────────────────────────────────────────────────────────
  function patch(id: string, fn: (t: ScheduleTask) => ScheduleTask) {
    setTasks((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
  }

  function startDrag(
    e: React.PointerEvent,
    task: ScheduleTask,
    mode: "move" | "resize-l" | "resize-r",
  ) {
    if (linkMode) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const origStart = task.start;
    const origEnd = task.end;
    const ppd = pxPerDay;
    setDragId(task.id);
    setSelId(task.id);

    const onMove = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / ppd);
      if (mode === "move") {
        patch(task.id, (t) => ({
          ...t,
          start: addDaysIso(origStart, delta),
          end: addDaysIso(origEnd, delta),
        }));
      } else if (mode === "resize-l") {
        const ns = addDaysIso(origStart, delta);
        if (diffDaysIso(ns, origEnd) >= 0) patch(task.id, (t) => ({ ...t, start: ns }));
      } else {
        const ne = addDaysIso(origEnd, delta);
        if (diffDaysIso(origStart, ne) >= 0) patch(task.id, (t) => ({ ...t, end: ne }));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Reachability for cycle prevention: is `from` reachable from `target` via deps?
  function reaches(fromId: string, targetId: string): boolean {
    const seen = new Set<string>();
    const stack = [targetId];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === fromId) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const t = tasks.find((x) => x.id === cur);
      if (t) stack.push(...t.dependsOn);
    }
    return false;
  }

  function onBarClick(task: ScheduleTask) {
    if (!linkMode) {
      setSelId(task.id);
      return;
    }
    if (!linkSource) {
      setLinkSource(task.id);
      return;
    }
    if (linkSource === task.id) {
      setLinkSource(null);
      return;
    }
    // Link source -> task (task depends on source). Prevent dup + cycle.
    const src = linkSource;
    if (!reaches(task.id, src) && !task.dependsOn.includes(src)) {
      patch(task.id, (t) => ({ ...t, dependsOn: [...t.dependsOn, src] }));
    }
    setLinkSource(null);
  }

  function addTask() {
    const id = `n${idCounter.current++}`;
    const start = addDaysIso(isoToday(), 1);
    setTasks((prev) => [
      ...prev,
      {
        id,
        name: "New task",
        discipline: "PROJECT_MANAGEMENT",
        category: newCat,
        subCategory: subsFor(newCat).length ? newSub || subsFor(newCat)[0] : undefined,
        status: "NOT_STARTED",
        start,
        end: addDaysIso(start, 13),
        progressPct: 0,
        dependsOn: [],
        parentId: null,
      },
    ]);
    setSelId(id);
  }

  function addSubTask(parent: ScheduleTask) {
    const id = `n${idCounter.current++}`;
    setTasks((prev) => [
      ...prev,
      {
        id,
        name: "New sub-task",
        discipline: parent.discipline,
        category: parent.category ?? DISCIPLINE_TO_CAT[parent.discipline],
        status: "NOT_STARTED",
        start: parent.start,
        end: addDaysIso(parent.start, 6),
        progressPct: 0,
        dependsOn: [],
        parentId: parent.id,
      },
    ]);
    setSelId(id);
  }

  function deleteTask(id: string) {
    setTasks((prev) =>
      prev
        .filter((t) => t.id !== id && t.parentId !== id)
        .map((t) => ({ ...t, dependsOn: t.dependsOn.filter((d) => d !== id) })),
    );
    setSelId(null);
  }

  function rename(task: ScheduleTask) {
    const name = window.prompt("Rename task", task.name);
    if (name && name.trim()) patch(task.id, (t) => ({ ...t, name: name.trim() }));
  }

  // Effective parent group of a task ("" = top level; ignores orphaned parentId).
  const groupOf = (t: ScheduleTask, list: ScheduleTask[]) =>
    t.parentId && list.some((p) => p.id === t.parentId) ? t.parentId : "";

  // Where the task sits among its siblings (same group), for disabling arrows.
  function siblingInfo(taskId: string) {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return { first: true, last: true };
    const g = groupOf(t, tasks);
    const sibs = tasks.filter((x) => groupOf(x, tasks) === g);
    const pos = sibs.findIndex((x) => x.id === taskId);
    return { first: pos <= 0, last: pos === sibs.length - 1 };
  }

  // Move a task up/down among its siblings (children follow their parent).
  function move(taskId: string, dir: "up" | "down") {
    setTasks((prev) => {
      const t = prev.find((x) => x.id === taskId);
      if (!t) return prev;
      const g = groupOf(t, prev);
      const sibs = prev.filter((x) => groupOf(x, prev) === g);
      const pos = sibs.findIndex((x) => x.id === taskId);
      const swapWith = dir === "up" ? sibs[pos - 1] : sibs[pos + 1];
      if (!swapWith) return prev;
      const arr = [...prev];
      const ia = arr.findIndex((x) => x.id === taskId);
      const ib = arr.findIndex((x) => x.id === swapWith.id);
      [arr[ia], arr[ib]] = [arr[ib], arr[ia]];
      return arr;
    });
  }

  function removeDep(taskId: string, depId: string) {
    patch(taskId, (t) => ({ ...t, dependsOn: t.dependsOn.filter((d) => d !== depId) }));
  }

  // Set a task's duration; hours snap to whole working days (HOURS_PER_DAY).
  function setDuration(task: ScheduleTask, amount: number, unit: "days" | "hours") {
    const days =
      unit === "hours"
        ? Math.max(1, Math.ceil(amount / hoursPerDay))
        : Math.max(1, Math.round(amount));
    patch(task.id, (t) => ({ ...t, end: addDaysIso(t.start, days - 1), durationUnit: unit }));
  }

  // Set progress %; auto-syncs status (unless on hold / cancelled, which are kept).
  function setProgress(task: ScheduleTask, pct: number) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    patch(task.id, (t) => {
      const keep = t.status === "ON_HOLD" || t.status === "CANCELLED";
      const status: ScheduleTask["status"] = keep
        ? t.status
        : p >= 100
          ? "COMPLETED"
          : p > 0
            ? "IN_PROGRESS"
            : "NOT_STARTED";
      return { ...t, progressPct: p, status };
    });
  }

  // Reschedule a task to a new start date, keeping its duration (end shifts).
  function setStart(task: ScheduleTask, iso: string) {
    if (!iso) return;
    const days = durationDays(task);
    patch(task.id, (t) => ({ ...t, start: iso, end: addDaysIso(iso, days - 1) }));
  }

  // Set status; COMPLETED → 100%, NOT_STARTED → 0%.
  function setStatus(task: ScheduleTask, status: ScheduleTask["status"]) {
    patch(task.id, (t) => ({
      ...t,
      status,
      progressPct: status === "COMPLETED" ? 100 : status === "NOT_STARTED" ? 0 : t.progressPct,
    }));
  }

  const selected = tasks.find((t) => t.id === selId) ?? null;
  const overall = tasks.length
    ? Math.round(tasks.reduce((n, t) => n + t.progressPct, 0) / tasks.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Tasks", value: String(tasks.length) },
          { label: "Overall progress", value: `${overall}%` },
          { label: "Critical tasks", value: String(cpm.critical.size) },
          { label: "Critical path", value: `${cpm.projectDays} days` },
        ].map((t) => (
          <Card key={t.label} className="p-4">
            <div className="text-xs text-muted">{t.label}</div>
            <div className="mt-1 text-xl font-semibold tracking-tight text-fg">{t.value}</div>
          </Card>
        ))}
      </div>

      {/* Status board — where the project is vs plan */}
      <StatusBoard health={health} statusDate={statusDate} onStatusDate={setStatusDate} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Save */}
        <button
          type="button"
          onClick={onSave}
          disabled={savePending || !dirty}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed",
            dirty
              ? "bg-brand text-brand-fg hover:bg-brand/90"
              : "border border-border bg-surface text-muted",
          )}
          title={dirty ? "Save schedule changes" : "All changes saved"}
        >
          {savePending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : dirty ? (
            <Save className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {savePending ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
        {saveError ? <span className="text-xs text-red-600">{saveError}</span> : null}

        {/* Scale */}
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {SCALES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                scale === s ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-1">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.4, z / 1.25))} className="p-1.5 text-muted hover:text-fg" aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-[11px] text-faint">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="p-1.5 text-muted hover:text-fg" aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Working calendar (hours, weekend off-days, holidays) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setCalPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
          >
            <CalendarCog className="h-3.5 w-3.5" />
            Calendar
          </button>
          {calPanel ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCalPanel(false)} aria-hidden />
              <div className="absolute left-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-3 shadow-lg">
                {/* Working hours */}
                <div className="mb-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">
                    Working hours / day
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={24}
                      step={0.5}
                      value={hoursPerDay}
                      onChange={(e) => setHoursPerDay(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                      className="h-8 w-24 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    />
                    <span className="text-xs text-muted">hours/day (used for Hours↔Days)</span>
                  </div>
                </div>

                {/* Weekend / off-days */}
                <div className="mb-3">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">
                    Weekend / off-days
                  </span>
                  <div className="flex items-center gap-1">
                    {WEEKDAYS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setOffDays((prev) =>
                            prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
                          )
                        }
                        className={cn(
                          "h-7 w-7 rounded text-[10px] font-medium transition-colors",
                          offDays.includes(i)
                            ? "bg-slate-200 text-slate-700"
                            : "text-faint hover:bg-surface-2",
                        )}
                        title={d}
                      >
                        {d[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Holidays */}
                <div>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-faint">
                    Official holidays ({holidays.length})
                  </span>
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="date"
                      value={newHoliday}
                      onChange={(e) => setNewHoliday(e.target.value)}
                      className="h-8 flex-1 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    />
                    <button
                      type="button"
                      onClick={addHoliday}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-brand px-2.5 text-xs font-medium text-brand-fg hover:bg-brand/90"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  <div className="max-h-40 space-y-0.5 overflow-y-auto">
                    {holidays.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-faint">No holidays defined.</p>
                    ) : (
                      holidays.map((d) => (
                        <div
                          key={d}
                          className="flex items-center justify-between rounded px-1.5 py-1 text-sm hover:bg-surface-2"
                        >
                          <span className="inline-flex items-center gap-2 text-fg">
                            <span className="h-2.5 w-2.5 rounded-sm bg-rose-300" />
                            {d}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeHoliday(d)}
                            className="rounded p-0.5 text-faint hover:text-red-600"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Critical path */}
        <button
          type="button"
          onClick={() => setShowCritical((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
            showCritical ? "border-red-300 bg-red-50 text-red-700" : "border-border bg-surface text-muted hover:text-fg",
          )}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Critical path
        </button>

        {/* Budget (coming soon) */}
        <button
          type="button"
          onClick={() => setShowBudget((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
            showBudget ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface text-muted hover:text-fg",
          )}
          title="Cost-load the schedule with budgets (coming soon)"
        >
          <CircleDollarSign className="h-3.5 w-3.5" />
          Budget
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
            Soon
          </span>
        </button>

        {/* Link mode */}
        <button
          type="button"
          onClick={() => {
            setLinkMode((v) => !v);
            setLinkSource(null);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
            linkMode ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface text-muted hover:text-fg",
          )}
        >
          <Link2 className="h-3.5 w-3.5" />
          {linkMode ? (linkSource ? "Pick target…" : "Pick source…") : "Link"}
        </button>

        {/* Categories editor */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setCatPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
          >
            <Tag className="h-3.5 w-3.5" />
            Categories
          </button>
          {catPanel ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCatPanel(false)} aria-hidden />
              <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg">
                <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Task categories
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {categories.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-2">
                      <input
                        type="color"
                        value={c.color}
                        onChange={(e) => setCatColor(c.id, e.target.value)}
                        className="h-5 w-5 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
                        title="Change colour"
                      />
                      <button
                        type="button"
                        onClick={() => renameCategory(c.id)}
                        className="min-w-0 flex-1 truncate text-left text-sm text-fg hover:text-brand"
                        title="Rename"
                      >
                        {c.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(c.id)}
                        disabled={categories.length <= 1}
                        className="shrink-0 rounded p-0.5 text-faint hover:text-red-600 disabled:opacity-30"
                        title="Delete category"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addCategory}
                  className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand hover:bg-brand/5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add category
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* New task category (+ sub-category) + add */}
        <div className="ml-auto inline-flex items-center overflow-hidden rounded-lg border border-border">
          <select
            value={newCat}
            onChange={(e) => {
              const v = e.target.value;
              setNewCat(v);
              setNewSub(subsFor(v)[0] ?? "");
            }}
            className="h-8 border-r border-border bg-surface px-2 text-xs text-fg focus:outline-none"
            title="Category for new task"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {subsFor(newCat).length > 0 ? (
            <select
              value={newSub || subsFor(newCat)[0]}
              onChange={(e) => {
                if (e.target.value === ADD_SENTINEL) {
                  const v = addSubcategory(newCat);
                  if (v) setNewSub(v);
                } else setNewSub(e.target.value);
              }}
              className="h-8 max-w-[160px] border-r border-border bg-surface px-2 text-xs text-fg focus:outline-none"
              title="Sub-category for new task"
            >
              {subsFor(newCat).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={ADD_SENTINEL}>＋ Add new…</option>
            </select>
          ) : null}
          <button
            type="button"
            onClick={addTask}
            className="inline-flex items-center gap-1.5 bg-brand px-2.5 py-1.5 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        </div>
      </div>

      {/* Budget on the schedule — coming soon */}
      {showBudget ? (
        <Card className="overflow-hidden border-dashed">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-5 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <CircleDollarSign className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-fg">
                Cost-loaded schedule
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Coming soon
                </span>
              </div>
              <p className="text-xs text-muted">
                Attach budgets to each task and spread cost across the timeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBudget(false)}
              className="ml-auto rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:text-fg"
            >
              Hide
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Budget per task", d: "Assign a cost/value to every activity and roll it up by phase, category, and project." },
              { t: "Cash-flow S-curve", d: "Planned vs earned value spread across the timeline — see spend over time." },
              { t: "Earned Value (EVM)", d: "CPI / SPI, BCWP/BCWS/ACWP, and cost variance alongside schedule variance." },
              { t: "Payment milestones", d: "Tie the proposal's payment schedule to programme dates and forecast invoicing." },
            ].map((x) => (
              <div key={x.t} className="rounded-lg border border-dashed border-border bg-surface p-4">
                <div className="text-sm font-medium text-fg">{x.t}</div>
                <div className="mt-1 text-xs text-muted">{x.d}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-5 py-3 text-center text-xs text-faint">
            Budget integration arrives once the database is connected — this toggle reserves its place in the schedule.
          </div>
        </Card>
      ) : null}

      {/* Gantt */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <CalendarClock className="h-4 w-4 text-faint" />
          <span className="text-sm font-medium text-fg">{schedule.projectName}</span>
          <span className="ml-auto text-xs text-muted">{schedule.client} · {schedule.manager}</span>
        </div>

        <div className="overflow-x-auto">
          <div className="flex" style={{ width: LABEL_W + timelineWidth }}>
            {/* Label column */}
            <div className="sticky left-0 z-30 shrink-0 bg-surface" style={{ width: LABEL_W }}>
              <div
                className="flex items-end border-b border-r border-border bg-surface-2 px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-faint"
                style={{ height: HEADER_H }}
              >
                Task
              </div>
              {ordered.map(({ task, depth }, i) => {
                const crit = showCritical && cpm.critical.has(task.id);
                const reord = siblingInfo(task.id);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "group flex items-center gap-1 border-b border-r border-border px-3",
                      i % 2 === 1 && selId !== task.id && "bg-slate-100/80",
                      selId === task.id && "bg-surface-2",
                    )}
                    style={{ height: ROW_H, paddingLeft: 12 + depth * 16 }}
                  >
                    {depth > 0 ? <CornerDownRight className="h-3 w-3 shrink-0 text-faint" /> : null}
                    <button
                      type="button"
                      onClick={() => setSelId(task.id)}
                      onDoubleClick={() => rename(task)}
                      className="min-w-0 flex-1 text-left"
                      title="Click to select · double-click to rename"
                    >
                      <div className={cn("flex items-center gap-1 truncate text-[13px] font-medium text-fg", task.status === "CANCELLED" && "text-faint line-through")}>
                        {crit ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" /> : null}
                        {task.name}
                      </div>
                      <div className="flex items-center gap-1 truncate text-[10px] text-muted">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-sm"
                          style={{ background: resolveCat(task).color }}
                        />
                        {resolveCat(task).label}
                        {task.subCategory ? ` · ${task.subCategory}` : ""}
                        {task.assignee ? ` · ${task.assignee}` : ""}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => move(task.id, "up")}
                        disabled={reord.first}
                        className="rounded p-0.5 text-faint hover:text-fg disabled:cursor-default disabled:opacity-25"
                        title="Move up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(task.id, "down")}
                        disabled={reord.last}
                        className="rounded p-0.5 text-faint hover:text-fg disabled:cursor-default disabled:opacity-25"
                        title="Move down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      {depth === 0 ? (
                        <button
                          type="button"
                          onClick={() => addSubTask(task)}
                          className="rounded p-0.5 text-faint hover:text-brand"
                          title="Add sub-task"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline */}
            <div className="relative" style={{ width: timelineWidth, height: HEADER_H + rowsHeight }}>
              {/* Header */}
              <div className="absolute left-0 top-0" style={{ width: timelineWidth, height: HEADER_H }}>
                <div className="relative border-b border-border bg-surface-2" style={{ height: HEADER_H / 2 }}>
                  {header.major.map((m, i) => (
                    <div key={i} className="absolute top-0 flex h-full items-center border-l border-border px-2 text-[11px] font-semibold text-fg" style={{ left: m.left, width: m.width }}>
                      {m.width > 28 ? m.label : ""}
                    </div>
                  ))}
                </div>
                <div className="relative border-b border-border bg-surface-2" style={{ height: HEADER_H / 2 }}>
                  {header.minor.map((m, i) => (
                    <div key={i} className="absolute top-0 flex h-full items-center justify-center border-l border-border text-[10px] text-muted" style={{ left: m.left, width: m.width }}>
                      {m.width > 16 ? m.label : ""}
                    </div>
                  ))}
                </div>
              </div>

              {/* Zebra row striping (behind weekend shading) */}
              {ordered.map((_, i) =>
                i % 2 === 1 ? (
                  <div
                    key={`z${i}`}
                    className="absolute bg-slate-100/80"
                    style={{ left: 0, top: HEADER_H + i * ROW_H, width: timelineWidth, height: ROW_H }}
                  />
                ) : null,
              )}

              {/* Weekend / off-day vertical stripes (diagonal hatch) */}
              {offBands.map((b, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: b.left,
                    top: HEADER_H,
                    width: b.width,
                    height: rowsHeight,
                    backgroundColor: "rgba(100,116,139,0.06)",
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(100,116,139,0.14) 0, rgba(100,116,139,0.14) 3px, transparent 3px, transparent 7px)",
                  }}
                />
              ))}

              {/* Official holiday vertical stripes */}
              {holidayBands.map((b) => (
                <div
                  key={b.iso}
                  className="absolute bg-rose-200/50"
                  style={{ left: b.left, top: HEADER_H, width: Math.max(2, pxPerDay), height: rowsHeight }}
                  title={`Holiday · ${b.iso}`}
                />
              ))}

              {/* Minor gridlines */}
              {header.minor.map((m, i) => (
                <div key={`g${i}`} className="absolute border-l border-border/60" style={{ left: m.left, top: HEADER_H, height: rowsHeight }} />
              ))}

              {/* Row separators */}
              {ordered.map((_, i) => (
                <div key={`r${i}`} className="absolute border-b border-border/70" style={{ left: 0, top: HEADER_H + i * ROW_H, width: timelineWidth, height: ROW_H }} />
              ))}

              {/* Today */}
              {todayLeft !== null ? (
                <div className="absolute z-10 w-0.5 bg-red-500/80" style={{ left: todayLeft, top: HEADER_H - 6, height: rowsHeight + 6 }}>
                  <span className="absolute -top-0 left-1 text-[9px] font-semibold text-red-600">today</span>
                </div>
              ) : null}

              {/* Status date (data date) — where the project is being measured from */}
              {diffDaysIso(windowStart, statusDate) >= 0 && diffDaysIso(statusDate, windowEnd) >= 0 ? (
                <div
                  className="absolute z-10"
                  style={{ left: x(statusDate), top: HEADER_H - 6, height: rowsHeight + 6, width: 0, borderLeft: "2px dashed #4338ca" }}
                >
                  <span className="absolute -top-0 left-1 rounded bg-indigo-700 px-1 text-[9px] font-semibold text-white">
                    STATUS
                  </span>
                </div>
              ) : null}

              {/* Dependency arrows */}
              <svg className="pointer-events-none absolute z-10" style={{ left: 0, top: HEADER_H, width: timelineWidth, height: rowsHeight }}>
                <defs>
                  <marker id="ah" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
                  </marker>
                  <marker id="ahc" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
                  </marker>
                </defs>
                {tasks.flatMap((t) =>
                  t.dependsOn.map((depId) => {
                    const pred = tasks.find((p) => p.id === depId);
                    const ti = indexOf.get(t.id);
                    const pi = indexOf.get(depId);
                    if (!pred || ti === undefined || pi === undefined) return null;
                    const sx = x(pred.start) + durationDays(pred) * pxPerDay;
                    const sy = rowCenter(pi);
                    const tx = x(t.start);
                    const ty = rowCenter(ti);
                    const crit = showCritical && cpm.critical.has(t.id) && cpm.critical.has(depId);
                    const midX = Math.max(sx + 10, tx - 10);
                    const d = `M${sx},${sy} L${midX},${sy} L${midX},${ty} L${tx - 2},${ty}`;
                    return (
                      <path
                        key={`${depId}-${t.id}`}
                        d={d}
                        fill="none"
                        stroke={crit ? "#ef4444" : "#94a3b8"}
                        strokeWidth={crit ? 1.8 : 1.2}
                        markerEnd={`url(#${crit ? "ahc" : "ah"})`}
                      />
                    );
                  }),
                )}
              </svg>

              {/* Bars */}
              {ordered.map(({ task }, i) => {
                const left = x(task.start);
                const width = Math.max(8, durationDays(task) * pxPerDay);
                const color = resolveCat(task).color;
                const notStarted = task.status === "NOT_STARTED";
                const cancelled = task.status === "CANCELLED";
                const crit = showCritical && cpm.critical.has(task.id);
                const isSource = linkSource === task.id;
                const h = health.perTask[task.id];
                return (
                  <div
                    key={task.id}
                    onClick={() => onBarClick(task)}
                    onPointerDown={(e) => startDrag(e, task, "move")}
                    className={cn(
                      "absolute z-20 flex items-center rounded-md",
                      linkMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
                      dragId === task.id && "ring-2 ring-brand/40",
                      isSource && "ring-2 ring-brand",
                    )}
                    style={{
                      left,
                      width,
                      top: HEADER_H + i * ROW_H + (ROW_H - BAR_H) / 2,
                      height: BAR_H,
                      background: notStarted ? "transparent" : `${color}33`,
                      border: crit
                        ? "2px solid #ef4444"
                        : notStarted
                          ? `1.5px dashed ${color}`
                          : `1px solid ${color}66`,
                      opacity: cancelled ? 0.5 : 1,
                    }}
                    title={`${task.name} · ${task.start} → ${task.end} · ${
                      (task.durationUnit ?? "days") === "hours"
                        ? `${durationDays(task) * hoursPerDay}h`
                        : `${durationDays(task)}d`
                    } · ${task.progressPct}%${
                      showCritical ? ` · slack ${cpm.slack[task.id] ?? 0}d` : ""
                    }`}
                  >
                    {!notStarted ? (
                      <div className="h-full rounded-l-md" style={{ width: `${task.progressPct}%`, background: color }} />
                    ) : null}
                    {/* Behind-plan gap (actual → expected) as red hatch */}
                    {h && !notStarted && h.actualPct < h.expectedPct ? (
                      <div
                        className="pointer-events-none absolute top-0 h-full"
                        style={{
                          left: `${h.actualPct}%`,
                          width: `${h.expectedPct - h.actualPct}%`,
                          backgroundImage:
                            "repeating-linear-gradient(45deg, rgba(239,68,68,0.40) 0, rgba(239,68,68,0.40) 3px, transparent 3px, transparent 6px)",
                        }}
                      />
                    ) : null}
                    {/* Planned-progress marker for the status date */}
                    {h && !notStarted && h.expectedPct > 0 && h.expectedPct < 100 ? (
                      <div
                        className="pointer-events-none absolute top-0 h-full"
                        style={{ left: `${h.expectedPct}%`, width: 2, marginLeft: -1, background: "#0f172a" }}
                        title={`Planned ${h.expectedPct}% by status date`}
                      />
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center px-1 text-[10px] font-semibold" style={{ color: task.progressPct > 45 && !notStarted ? "#fff" : "var(--color-fg)" }}>
                      {width > 34 ? `${task.progressPct}%` : ""}
                    </span>
                    {/* Resize handles */}
                    {!linkMode ? (
                      <>
                        <div onPointerDown={(e) => startDrag(e, task, "resize-l")} className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize rounded-l-md hover:bg-black/10" />
                        <div onPointerDown={(e) => startDrag(e, task, "resize-r")} className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r-md hover:bg-black/10" />
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Legend + selection detail */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        {categories.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border-2 border-red-500" /> critical path
        </span>
        <span className="ml-auto text-faint">
          Drag bars to move · drag edges to stretch · {linkMode ? "click two bars to link" : "“Link” to connect tasks"}
        </span>
      </div>

      {selected ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-fg">{selected.name}</span>
                {showCritical && cpm.critical.has(selected.id) ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
                    On critical path
                  </span>
                ) : (
                  <span className="text-[11px] text-faint">slack {cpm.slack[selected.id] ?? 0}d</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-faint">Start</span>
                <input
                  type="date"
                  value={selected.start}
                  onChange={(e) => setStart(selected, e.target.value)}
                  className="h-7 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
                <span className="text-[11px] text-faint">→ ends {formatDate(selected.end)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-faint">Category</span>
                <select
                  value={selected.category ?? DISCIPLINE_TO_CAT[selected.discipline]}
                  onChange={(e) =>
                    patch(selected.id, (t) => ({ ...t, category: e.target.value, subCategory: undefined }))
                  }
                  className="h-7 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: resolveCat(selected).color }}
                />
                {(() => {
                  const selCatId = selected.category ?? DISCIPLINE_TO_CAT[selected.discipline];
                  if (subsFor(selCatId).length === 0) return null;
                  return (
                    <select
                      value={selected.subCategory ?? ""}
                      onChange={(e) => {
                        if (e.target.value === ADD_SENTINEL) {
                          const v = addSubcategory(selCatId);
                          if (v) patch(selected.id, (t) => ({ ...t, subCategory: v }));
                        } else {
                          const v = e.target.value;
                          patch(selected.id, (t) => ({ ...t, subCategory: v || undefined }));
                        }
                      }}
                      className="h-7 max-w-[200px] rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                    >
                      <option value="">— sub-category —</option>
                      {subsFor(selCatId).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value={ADD_SENTINEL}>＋ Add new…</option>
                    </select>
                  );
                })()}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-faint">Duration</span>
                <input
                  type="number"
                  min={1}
                  value={
                    (selected.durationUnit ?? "days") === "hours"
                      ? durationDays(selected) * hoursPerDay
                      : durationDays(selected)
                  }
                  onChange={(e) =>
                    setDuration(selected, Number(e.target.value), selected.durationUnit ?? "days")
                  }
                  className="h-7 w-20 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
                <select
                  value={selected.durationUnit ?? "days"}
                  onChange={(e) => {
                    const u = e.target.value as "days" | "hours";
                    setDuration(selected, durationDays(selected) * (u === "hours" ? hoursPerDay : 1), u);
                  }}
                  className="h-7 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                >
                  <option value="days">days</option>
                  <option value="hours">hours</option>
                </select>
                <span className="text-[11px] text-faint">
                  {(selected.durationUnit ?? "days") === "hours"
                    ? `≈ ${durationDays(selected)} working day${durationDays(selected) === 1 ? "" : "s"}`
                    : `${durationDays(selected) * hoursPerDay}h @ ${hoursPerDay}h/day`}
                </span>
              </div>

              {/* Progress + status */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-faint">Progress</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={selected.progressPct}
                  onChange={(e) => setProgress(selected, Number(e.target.value))}
                  style={{ accentColor: resolveCat(selected).color }}
                  className="h-1.5 w-36 cursor-pointer"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={selected.progressPct}
                  onChange={(e) => setProgress(selected, Number(e.target.value))}
                  className="h-7 w-16 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
                <span className="text-[11px] text-faint">%</span>
                <span className="mx-1 h-4 w-px bg-border" />
                <span className="text-[11px] text-faint">Status</span>
                <select
                  value={selected.status}
                  onChange={(e) => setStatus(selected, e.target.value as ScheduleTask["status"])}
                  className="h-7 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                >
                  <option value="NOT_STARTED">Not started</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="ON_HOLD">On hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {selected.dependsOn.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-faint">Depends on:</span>
                  {selected.dependsOn.map((d) => {
                    const dep = tasks.find((t) => t.id === d);
                    return (
                      <span key={d} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-fg ring-1 ring-inset ring-border">
                        {dep?.name ?? d}
                        <button type="button" onClick={() => removeDep(selected.id, d)} className="text-faint hover:text-red-600" aria-label="Remove dependency">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {!selected.parentId ? (
                <button type="button" onClick={() => addSubTask(selected)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-surface-2">
                  <Plus className="h-3.5 w-3.5" /> Sub-task
                </button>
              ) : null}
              <button type="button" onClick={() => deleteTask(selected.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
