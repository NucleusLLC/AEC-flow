/**
 * Project dashboard — widget catalogue, presets and the persisted layout shape.
 *
 * The dashboard is "programmable": each project owns an ordered list of widget
 * instances that the user can add, remove, reorder and configure. The layout and
 * every widget's data persist to localStorage (keyed per project) — see
 * components/projects/dashboard/use-persistent-state.ts. This is the right model
 * for a personalisable board today and maps cleanly onto a DB table later.
 */

export type WidgetType =
  | "notes"
  | "tasks"
  | "agenda"
  | "reminders"
  | "clock"
  | "worldclock"
  | "progress"
  | "stats"
  | "links"
  | "bookmarks"
  | "contacts"
  | "budget";

export type WidgetInstance = {
  /** Stable per-instance id — also the localStorage suffix for the widget's data. */
  id: string;
  type: WidgetType;
  /** User-overridable title (falls back to the catalogue name). */
  title?: string;
  /** Free-form per-widget settings (e.g. world-clock cities). */
  config?: Record<string, unknown>;
};

export type WidgetMeta = {
  type: WidgetType;
  name: string;
  description: string;
  /** lucide-react icon name, resolved in the client. */
  icon: string;
};

export const WIDGET_CATALOG: WidgetMeta[] = [
  { type: "notes", name: "Notes", description: "Free-form project notepad", icon: "StickyNote" },
  { type: "tasks", name: "Tasks", description: "Checklist with due dates", icon: "ListChecks" },
  { type: "agenda", name: "Agenda", description: "Upcoming tasks & reminders", icon: "CalendarDays" },
  { type: "reminders", name: "Reminders", description: "Timed reminders", icon: "BellRing" },
  { type: "clock", name: "Time Clock", description: "Live clock + work timer", icon: "Clock" },
  { type: "worldclock", name: "World Clocks", description: "Clocks for chosen cities", icon: "Globe" },
  { type: "progress", name: "Progress", description: "Overall % and phases", icon: "Activity" },
  { type: "stats", name: "Key Stats", description: "Contract, dates, countdown", icon: "Gauge" },
  { type: "links", name: "Quick Links", description: "Jump to project sections", icon: "Link2" },
  { type: "bookmarks", name: "Bookmarks", description: "Saved external links", icon: "Bookmark" },
  { type: "contacts", name: "Contacts", description: "Project contact list", icon: "Contact" },
  { type: "budget", name: "Budget", description: "Committed cost vs contract", icon: "Wallet" },
];

export function widgetMeta(type: WidgetType): WidgetMeta {
  return WIDGET_CATALOG.find((w) => w.type === type) ?? WIDGET_CATALOG[0];
}

/** City presets spanning the suite's footprint (Aruba/NL/Colombia/Curaçao/USA/UAE). */
export const CITY_PRESETS: { label: string; timeZone: string }[] = [
  { label: "Oranjestad", timeZone: "America/Aruba" },
  { label: "Willemstad", timeZone: "America/Curacao" },
  { label: "Bogotá", timeZone: "America/Bogota" },
  { label: "New York", timeZone: "America/New_York" },
  { label: "Amsterdam", timeZone: "Europe/Amsterdam" },
  { label: "London", timeZone: "Europe/London" },
  { label: "Dubai", timeZone: "Asia/Dubai" },
  { label: "Singapore", timeZone: "Asia/Singapore" },
];

/** Default board for a project on first visit. */
export function defaultWidgets(): WidgetInstance[] {
  return [
    { id: "w_progress", type: "progress" },
    { id: "w_tasks", type: "tasks" },
    { id: "w_agenda", type: "agenda" },
    { id: "w_notes", type: "notes" },
    { id: "w_clock", type: "clock" },
    {
      id: "w_worldclock",
      type: "worldclock",
      config: { cities: ["America/Aruba", "Europe/Amsterdam", "America/Bogota"] },
    },
    { id: "w_reminders", type: "reminders" },
    { id: "w_stats", type: "stats" },
    { id: "w_links", type: "links" },
  ];
}

/** Lightweight, serialisable project context passed from the server page. */
export type ProjectSummary = {
  id: string;
  name: string;
  projectNumber: string;
  progressPct: number;
  value: number;
  currency: string;
  startDate: string | null;
  targetEndDate: string | null;
  siteAddress: string | null;
  phases: { name: string; status: string; progressPct: number }[];
};

/** Stored shapes for the interactive widgets. */
export type TaskItem = { id: string; text: string; done: boolean; due: string | null };
export type ReminderItem = { id: string; text: string; at: string; done: boolean };
export type BookmarkItem = { id: string; label: string; url: string };
export type ContactItem = { id: string; name: string; role: string; detail: string };
export type BudgetItem = { id: string; label: string; amount: number };
