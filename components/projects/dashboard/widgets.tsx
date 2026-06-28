"use client";

import { useState } from "react";
import Link from "next/link";
import {
  StickyNote,
  ListChecks,
  CalendarDays,
  BellRing,
  Clock,
  Globe,
  Activity,
  Gauge,
  Link2,
  Plus,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  FolderOpen,
  FileStack,
  Calculator,
  FileText,
  HardHat,
  CalendarClock,
  ClipboardCheck,
  Bookmark,
  Contact,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { WidgetFrame } from "@/components/projects/dashboard/widget-frame";
import { useSharedState, useNow, uid } from "@/components/projects/dashboard/hooks";
import { ProgressBar } from "@/components/ui/progress";
import {
  CITY_PRESETS,
  widgetMeta,
  type WidgetInstance,
  type ProjectSummary,
  type TaskItem,
  type ReminderItem,
  type BookmarkItem,
  type ContactItem,
  type BudgetItem,
} from "@/lib/dashboard";
import { formatCurrency, formatDate } from "@/lib/format";

export type WidgetControls = {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  onRename?: (title: string) => void;
  onDragHandleDown?: () => void;
};

type Base = {
  projectId: string;
  instance: WidgetInstance;
  project: ProjectSummary;
  controls: WidgetControls;
  onConfigChange: (config: Record<string, unknown>) => void;
};

const inputCls =
  "h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const keyOf = (projectId: string, kind: string) => `aec.proj.${projectId}.${kind}`;
const title = (i: WidgetInstance) => i.title ?? widgetMeta(i.type).name;

/* ── time helpers ─────────────────────────────────────────────────────────── */
function timeIn(tz: string, now: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}
function dateInTz(tz: string, now: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "2-digit", month: "short" }).format(now);
}
function cityLabel(tz: string) {
  return CITY_PRESETS.find((c) => c.timeZone === tz)?.label ?? tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
}
function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}
function relative(target: Date, now: Date) {
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const min = 60000, hr = 3600000, day = 86400000;
  const txt = abs < min ? "now" : abs < hr ? `${Math.round(abs / min)}m` : abs < day ? `${Math.round(abs / hr)}h` : `${Math.round(abs / day)}d`;
  if (txt === "now") return "now";
  return diff >= 0 ? `in ${txt}` : `${txt} ago`;
}

/* ── Notes ────────────────────────────────────────────────────────────────── */
function NotesWidget({ projectId, instance, controls }: Base) {
  const [text, setText] = useSharedState<string>(keyOf(projectId, "notes"), "");
  return (
    <WidgetFrame title={title(instance)} icon={<StickyNote className="h-4 w-4" />} {...controls}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Project notes…"
        className="h-40 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
    </WidgetFrame>
  );
}

/* ── Tasks ────────────────────────────────────────────────────────────────── */
function TasksWidget({ projectId, instance, controls }: Base) {
  const [tasks, setTasks] = useSharedState<TaskItem[]>(keyOf(projectId, "tasks"), []);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");

  const add = () => {
    if (!text.trim()) return;
    setTasks((p) => [...p, { id: uid("task"), text: text.trim(), done: false, due: due || null }]);
    setText("");
    setDue("");
  };
  const remaining = tasks.filter((t) => !t.done).length;

  return (
    <WidgetFrame title={title(instance)} icon={<ListChecks className="h-4 w-4" />} {...controls}>
      <div className="flex items-center gap-1.5">
        <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a task…" />
        <input type="date" className={`${inputCls} w-32`} value={due} onChange={(e) => setDue(e.target.value)} />
        <button type="button" onClick={add} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg hover:bg-brand/90" aria-label="Add task">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="group/task flex items-center gap-2">
            <input type="checkbox" checked={t.done} onChange={() => setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} className="h-4 w-4 shrink-0 rounded border-border" />
            <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-faint line-through" : "text-fg"}`}>{t.text}</span>
            {t.due ? <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{formatDate(t.due)}</span> : null}
            <button type="button" onClick={() => setTasks((p) => p.filter((x) => x.id !== t.id))} className="shrink-0 text-faint opacity-0 hover:text-red-600 group-hover/task:opacity-100" aria-label="Delete task">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {tasks.length === 0 ? <li className="py-2 text-center text-xs text-faint">No tasks yet</li> : null}
      </ul>
      {tasks.length ? <p className="mt-2 text-[11px] text-faint">{remaining} open · {tasks.length} total</p> : null}
    </WidgetFrame>
  );
}

/* ── Reminders ────────────────────────────────────────────────────────────── */
function RemindersWidget({ projectId, instance, controls }: Base) {
  const [items, setItems] = useSharedState<ReminderItem[]>(keyOf(projectId, "reminders"), []);
  const [text, setText] = useState("");
  const [at, setAt] = useState("");
  const now = useNow(30000);

  const add = () => {
    if (!text.trim() || !at) return;
    setItems((p) => [...p, { id: uid("rem"), text: text.trim(), at, done: false }]);
    setText("");
    setAt("");
  };
  const sorted = [...items].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <WidgetFrame title={title(instance)} icon={<BellRing className="h-4 w-4" />} {...controls}>
      <div className="flex items-center gap-1.5">
        <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="Remind me to…" />
        <input type="datetime-local" className={`${inputCls} w-40`} value={at} onChange={(e) => setAt(e.target.value)} />
        <button type="button" onClick={add} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg hover:bg-brand/90" aria-label="Add reminder">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {sorted.map((r) => {
          const when = new Date(r.at);
          const overdue = now ? when.getTime() < now.getTime() && !r.done : false;
          return (
            <li key={r.id} className="group/rem flex items-center gap-2">
              <input type="checkbox" checked={r.done} onChange={() => setItems((p) => p.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))} className="h-4 w-4 shrink-0 rounded border-border" />
              <span className={`min-w-0 flex-1 truncate text-sm ${r.done ? "text-faint line-through" : "text-fg"}`}>{r.text}</span>
              <span className={`shrink-0 text-[11px] ${overdue ? "text-red-600" : "text-muted"}`}>{now ? relative(when, now) : ""}</span>
              <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== r.id))} className="shrink-0 text-faint opacity-0 hover:text-red-600 group-hover/rem:opacity-100" aria-label="Delete reminder">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
        {items.length === 0 ? <li className="py-2 text-center text-xs text-faint">No reminders</li> : null}
      </ul>
    </WidgetFrame>
  );
}

/* ── Agenda (aggregates tasks + reminders) ────────────────────────────────── */
function AgendaWidget({ projectId, instance, controls }: Base) {
  const [tasks] = useSharedState<TaskItem[]>(keyOf(projectId, "tasks"), []);
  const [reminders] = useSharedState<ReminderItem[]>(keyOf(projectId, "reminders"), []);
  const now = useNow(60000);

  const entries = [
    ...tasks.filter((t) => t.due && !t.done).map((t) => ({ id: t.id, label: t.text, when: new Date(t.due as string), kind: "Task" })),
    ...reminders.filter((r) => !r.done).map((r) => ({ id: r.id, label: r.text, when: new Date(r.at), kind: "Reminder" })),
  ].sort((a, b) => a.when.getTime() - b.when.getTime());

  return (
    <WidgetFrame title={title(instance)} icon={<CalendarDays className="h-4 w-4" />} {...controls}>
      <ul className="space-y-2">
        {entries.slice(0, 7).map((e) => (
          <li key={`${e.kind}-${e.id}`} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-2 leading-none">
              <span className="text-[10px] uppercase text-faint">{new Intl.DateTimeFormat("en-GB", { month: "short" }).format(e.when)}</span>
              <span className="text-sm font-semibold text-fg">{e.when.getDate()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-fg">{e.label}</div>
              <div className="text-[11px] text-faint">{e.kind}{now ? ` · ${relative(e.when, now)}` : ""}</div>
            </div>
          </li>
        ))}
        {entries.length === 0 ? <li className="py-2 text-center text-xs text-faint">Nothing scheduled — add due dates to tasks or a reminder</li> : null}
      </ul>
    </WidgetFrame>
  );
}

/* ── Time Clock (live + work timer) ───────────────────────────────────────── */
type Timer = { running: boolean; startedAt: number | null; accumulatedMs: number };
function ClockWidget({ projectId, instance, controls, onConfigChange }: Base) {
  const now = useNow(1000);
  const hour12 = (instance.config?.hour12 as boolean | undefined) ?? false;
  const [timer, setTimer] = useSharedState<Timer>(keyOf(projectId, `timer.${instance.id}`), { running: false, startedAt: null, accumulatedMs: 0 });

  const elapsed = timer.accumulatedMs + (timer.running && timer.startedAt && now ? now.getTime() - timer.startedAt : 0);
  const toggle = () =>
    setTimer((t) =>
      t.running
        ? { running: false, startedAt: null, accumulatedMs: t.accumulatedMs + (t.startedAt ? Date.now() - t.startedAt : 0) }
        : { running: true, startedAt: Date.now(), accumulatedMs: t.accumulatedMs },
    );
  const reset = () => setTimer({ running: false, startedAt: null, accumulatedMs: 0 });

  const settings = (
    <label className="flex items-center gap-2 text-sm text-fg">
      <input type="checkbox" checked={hour12} onChange={(e) => onConfigChange({ ...instance.config, hour12: e.target.checked })} className="h-4 w-4 rounded border-border" />
      12-hour clock (AM/PM)
    </label>
  );

  return (
    <WidgetFrame title={title(instance)} icon={<Clock className="h-4 w-4" />} settings={settings} {...controls}>
      <div className="text-center">
        <div className="font-mono text-3xl font-semibold tracking-tight text-fg tabular-nums">
          {now ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12 }).format(now) : "--:--:--"}
        </div>
        <div className="mt-0.5 text-xs text-muted">{now ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now) : ""}</div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
        <div>
          <div className="text-[11px] text-muted">Work timer</div>
          <div className="font-mono text-lg font-semibold text-fg tabular-nums">{hms(elapsed)}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={toggle} className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-2.5 text-xs font-medium text-brand-fg hover:bg-brand/90">
            {timer.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {timer.running ? "Clock out" : "Clock in"}
          </button>
          <button type="button" onClick={reset} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-faint hover:text-fg" aria-label="Reset timer">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </WidgetFrame>
  );
}

/* ── World Clocks (configurable) ──────────────────────────────────────────── */
function WorldClockWidget({ instance, controls, onConfigChange }: Base) {
  const now = useNow(1000);
  const cities = (instance.config?.cities as string[] | undefined) ?? ["America/Aruba", "Europe/Amsterdam"];

  const toggleCity = (tz: string) => {
    const next = cities.includes(tz) ? cities.filter((c) => c !== tz) : [...cities, tz];
    onConfigChange({ ...instance.config, cities: next });
  };

  const settings = (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-muted">Show cities</div>
      <div className="grid grid-cols-2 gap-1.5">
        {CITY_PRESETS.map((c) => (
          <label key={c.timeZone} className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={cities.includes(c.timeZone)} onChange={() => toggleCity(c.timeZone)} className="h-4 w-4 rounded border-border" />
            {c.label}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <WidgetFrame title={title(instance)} icon={<Globe className="h-4 w-4" />} settings={settings} {...controls}>
      <ul className="space-y-2">
        {cities.map((tz) => (
          <li key={tz} className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-fg">{cityLabel(tz)}</div>
              <div className="text-[11px] text-faint">{now ? dateInTz(tz, now) : ""}</div>
            </div>
            <div className="font-mono text-lg font-semibold text-fg tabular-nums">{now ? timeIn(tz, now) : "--:--"}</div>
          </li>
        ))}
        {cities.length === 0 ? <li className="py-2 text-center text-xs text-faint">Pick cities in settings ⚙</li> : null}
      </ul>
    </WidgetFrame>
  );
}

/* ── Progress ─────────────────────────────────────────────────────────────── */
function ProgressWidget({ instance, project, controls, onConfigChange }: Base) {
  const phaseCount = (instance.config?.phaseCount as number | undefined) ?? 6;
  const settings = (
    <label className="flex items-center justify-between gap-2 text-sm text-fg">
      Phases to show
      <select
        value={phaseCount}
        onChange={(e) => onConfigChange({ ...instance.config, phaseCount: Number(e.target.value) })}
        className="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-fg focus:border-brand focus:outline-none"
      >
        {[3, 4, 5, 6, 8, 12, 99].map((n) => (
          <option key={n} value={n}>{n === 99 ? "All" : n}</option>
        ))}
      </select>
    </label>
  );
  return (
    <WidgetFrame title={title(instance)} icon={<Activity className="h-4 w-4" />} settings={settings} {...controls}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Overall</span>
        <span className="text-sm font-semibold text-fg">{project.progressPct}%</span>
      </div>
      <ProgressBar value={project.progressPct} className="mt-2" />
      <ul className="mt-3 space-y-2">
        {project.phases.slice(0, phaseCount).map((ph) => (
          <li key={ph.name} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-xs text-fg">{ph.name}</span>
            <div className="w-24"><ProgressBar value={ph.progressPct} /></div>
            <span className="w-8 text-right text-[11px] text-muted">{ph.progressPct}%</span>
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}

/* ── Key Stats ────────────────────────────────────────────────────────────── */
function StatsWidget({ instance, project, controls, onConfigChange }: Base) {
  const now = useNow(3600000);
  const daysToEnd =
    project.targetEndDate && now
      ? Math.round((new Date(project.targetEndDate).getTime() - now.getTime()) / 86400000)
      : null;
  const tiles = [
    { key: "value", label: "Contract value", value: formatCurrency(project.value, project.currency) },
    { key: "end", label: "Target end", value: formatDate(project.targetEndDate) },
    { key: "countdown", label: "Countdown", value: daysToEnd === null ? "—" : daysToEnd >= 0 ? `${daysToEnd} days` : `${-daysToEnd}d over` },
    { key: "started", label: "Started", value: formatDate(project.startDate) },
    { key: "number", label: "Project no.", value: project.projectNumber },
    { key: "site", label: "Site", value: project.siteAddress ?? "—" },
  ];
  const hidden = (instance.config?.hidden as string[] | undefined) ?? ["number", "site"];
  const toggle = (key: string) => {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    onConfigChange({ ...instance.config, hidden: next });
  };
  const shown = tiles.filter((t) => !hidden.includes(t.key));

  const settings = (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-muted">Show tiles</div>
      <div className="grid grid-cols-2 gap-1.5">
        {tiles.map((t) => (
          <label key={t.key} className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={!hidden.includes(t.key)} onChange={() => toggle(t.key)} className="h-4 w-4 rounded border-border" />
            {t.label}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <WidgetFrame title={title(instance)} icon={<Gauge className="h-4 w-4" />} settings={settings} {...controls}>
      <div className="grid grid-cols-2 gap-3">
        {shown.map((t) => (
          <div key={t.key} className="rounded-lg bg-surface-2 px-3 py-2">
            <div className="text-[11px] text-muted">{t.label}</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-fg" title={t.value}>{t.value}</div>
          </div>
        ))}
        {shown.length === 0 ? <div className="col-span-2 py-2 text-center text-xs text-faint">All tiles hidden — pick some in settings ⚙</div> : null}
      </div>
    </WidgetFrame>
  );
}

/* ── Quick Links ──────────────────────────────────────────────────────────── */
function LinksWidget({ instance, project, controls, onConfigChange }: Base) {
  const base = `/projects/${project.id}`;
  const links = [
    { key: "overview", label: "Overview", href: `${base}/overview`, icon: ClipboardCheck },
    { key: "timeframe", label: "Timeframe", href: `${base}/timeframe`, icon: CalendarClock },
    { key: "punch-list", label: "Punch List", href: `${base}/punch-list`, icon: ListChecks },
    { key: "documents", label: "Documents", href: `${base}/documents`, icon: FolderOpen },
    { key: "drawings", label: "Drawings", href: `${base}/drawings`, icon: FileStack },
    { key: "estimates", label: "Estimates", href: `${base}/estimates`, icon: Calculator },
    { key: "proposals", label: "Proposals", href: `${base}/proposals`, icon: FileText },
    { key: "construction-admin", label: "Construction Admin", href: `${base}/construction-admin`, icon: HardHat },
  ];
  const hidden = (instance.config?.hidden as string[] | undefined) ?? [];
  const toggle = (key: string) => {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    onConfigChange({ ...instance.config, hidden: next });
  };
  const shown = links.filter((l) => !hidden.includes(l.key));

  const settings = (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-muted">Show sections</div>
      <div className="grid grid-cols-2 gap-1.5">
        {links.map((l) => (
          <label key={l.key} className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={!hidden.includes(l.key)} onChange={() => toggle(l.key)} className="h-4 w-4 rounded border-border" />
            <span className="truncate">{l.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <WidgetFrame title={title(instance)} icon={<Link2 className="h-4 w-4" />} settings={settings} {...controls}>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-fg transition-colors hover:border-brand/40 hover:bg-surface-2">
              <Icon className="h-4 w-4 text-faint" />
              <span className="truncate">{l.label}</span>
            </Link>
          );
        })}
        {shown.length === 0 ? <div className="col-span-2 py-2 text-center text-xs text-faint">No sections — enable some in settings ⚙</div> : null}
      </div>
    </WidgetFrame>
  );
}

/* ── Bookmarks (editable external links) ──────────────────────────────────── */
function normalizeUrl(raw: string) {
  const url = raw.trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function BookmarksWidget({ projectId, instance, controls }: Base) {
  const [items, setItems] = useSharedState<BookmarkItem[]>(keyOf(projectId, "bookmarks"), []);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    const href = normalizeUrl(url);
    if (!href) return;
    setItems((p) => [...p, { id: uid("bm"), label: label.trim() || hostOf(href), url: href }]);
    setLabel("");
    setUrl("");
  };

  return (
    <WidgetFrame title={title(instance)} icon={<Bookmark className="h-4 w-4" />} {...controls}>
      <div className="space-y-1.5">
        <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" />
        <div className="flex items-center gap-1.5">
          <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="example.com/link" />
          <button type="button" onClick={add} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg hover:bg-brand/90" aria-label="Add bookmark">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((b) => (
          <li key={b.id} className="group/bm flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-faint" />
            <a href={b.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm text-fg hover:text-brand hover:underline" title={b.url}>
              {b.label}
            </a>
            <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== b.id))} className="shrink-0 text-faint opacity-0 hover:text-red-600 group-hover/bm:opacity-100" aria-label="Remove bookmark">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="py-2 text-center text-xs text-faint">No bookmarks yet</li> : null}
      </ul>
    </WidgetFrame>
  );
}

/* ── Contacts ─────────────────────────────────────────────────────────────── */
function ContactsWidget({ projectId, instance, controls }: Base) {
  const [items, setItems] = useSharedState<ContactItem[]>(keyOf(projectId, "contacts"), []);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [detail, setDetail] = useState("");

  const add = () => {
    if (!name.trim()) return;
    setItems((p) => [...p, { id: uid("ct"), name: name.trim(), role: role.trim(), detail: detail.trim() }]);
    setName("");
    setRole("");
    setDetail("");
  };

  return (
    <WidgetFrame title={title(instance)} icon={<Contact className="h-4 w-4" />} {...controls}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <input className={`${inputCls} w-36`} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
        </div>
        <div className="flex items-center gap-1.5">
          <input className={inputCls} value={detail} onChange={(e) => setDetail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Phone or email" />
          <button type="button" onClick={add} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg hover:bg-brand/90" aria-label="Add contact">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((c) => {
          const isEmail = c.detail.includes("@");
          const href = c.detail ? (isEmail ? `mailto:${c.detail}` : `tel:${c.detail.replace(/\s+/g, "")}`) : null;
          return (
            <li key={c.id} className="group/ct flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold uppercase text-muted">
                {c.name.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg">
                  {c.name}
                  {c.role ? <span className="font-normal text-faint"> · {c.role}</span> : null}
                </div>
                {c.detail ? (
                  href ? (
                    <a href={href} className="truncate text-[11px] text-muted hover:text-brand hover:underline">{c.detail}</a>
                  ) : (
                    <div className="truncate text-[11px] text-muted">{c.detail}</div>
                  )
                ) : null}
              </div>
              <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== c.id))} className="shrink-0 text-faint opacity-0 hover:text-red-600 group-hover/ct:opacity-100" aria-label="Remove contact">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
        {items.length === 0 ? <li className="py-2 text-center text-xs text-faint">No contacts yet</li> : null}
      </ul>
    </WidgetFrame>
  );
}

/* ── Budget (committed cost vs contract value) ────────────────────────────── */
function BudgetWidget({ projectId, instance, project, controls }: Base) {
  const [items, setItems] = useSharedState<BudgetItem[]>(keyOf(projectId, "budget"), []);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  const add = () => {
    const value = Number(amount);
    if (!label.trim() || !Number.isFinite(value) || value === 0) return;
    setItems((p) => [...p, { id: uid("bg"), label: label.trim(), amount: value }]);
    setLabel("");
    setAmount("");
  };

  const committed = items.reduce((sum, i) => sum + i.amount, 0);
  const remaining = project.value - committed;
  const pct = project.value > 0 ? Math.min(100, Math.round((committed / project.value) * 100)) : 0;
  const over = remaining < 0;

  return (
    <WidgetFrame title={title(instance)} icon={<Wallet className="h-4 w-4" />} {...controls}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="text-[11px] text-muted">Contract</div>
          <div className="mt-0.5 text-sm font-semibold text-fg">{formatCurrency(project.value, project.currency)}</div>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="text-[11px] text-muted">Committed</div>
          <div className="mt-0.5 text-sm font-semibold text-fg">{formatCurrency(committed, project.currency)}</div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">{pct}% committed</span>
          <span className={over ? "font-medium text-red-600" : "text-muted"}>
            {over ? `${formatCurrency(-remaining, project.currency)} over` : `${formatCurrency(remaining, project.currency)} left`}
          </span>
        </div>
        <ProgressBar value={pct} className="mt-1.5" />
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Cost item…" />
        <input type="number" className={`${inputCls} w-28`} value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Amount" />
        <button type="button" onClick={add} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-fg hover:bg-brand/90" aria-label="Add cost item">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="group/bg flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-fg">{i.label}</span>
            <span className="shrink-0 text-sm tabular-nums text-muted">{formatCurrency(i.amount, project.currency)}</span>
            <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== i.id))} className="shrink-0 text-faint opacity-0 hover:text-red-600 group-hover/bg:opacity-100" aria-label="Remove cost item">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="py-2 text-center text-xs text-faint">Add committed costs to track the budget</li> : null}
      </ul>
    </WidgetFrame>
  );
}

/** Maps a widget instance to its component. */
export function renderWidget(props: Base) {
  switch (props.instance.type) {
    case "notes": return <NotesWidget {...props} />;
    case "tasks": return <TasksWidget {...props} />;
    case "agenda": return <AgendaWidget {...props} />;
    case "reminders": return <RemindersWidget {...props} />;
    case "clock": return <ClockWidget {...props} />;
    case "worldclock": return <WorldClockWidget {...props} />;
    case "progress": return <ProgressWidget {...props} />;
    case "stats": return <StatsWidget {...props} />;
    case "links": return <LinksWidget {...props} />;
    case "bookmarks": return <BookmarksWidget {...props} />;
    case "contacts": return <ContactsWidget {...props} />;
    case "budget": return <BudgetWidget {...props} />;
    default: return null;
  }
}
