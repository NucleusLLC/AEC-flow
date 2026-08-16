/**
 * Module registry — the outer modular shell that wraps AEC-Flow's existing
 * features. This is INTEGRATION-LAYER code: it points module navigation at the
 * EXISTING routes (e.g. `/estimates`, `/schedule`). It does not, and must not,
 * change how the Estimates or Schedule systems work internally.
 *
 * See docs/protected-systems.md. The protected systems (Estimates, Schedule) are
 * exposed here as-is; every href below is an existing route.
 */
import {
  LayoutDashboard,
  Calculator,
  CalendarClock,
  FileOutput,
  FolderArchive,
  FileStack,
  HardHat,
  ShoppingCart,
  Boxes,
  Building2,
  PencilRuler,
  Sofa,
  FolderKanban,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import {
  DRAWINGS_AND_DOCUMENTS,
  DRAWINGS_INTAKE_ITEM,
  DRAWINGS_REGISTER_ITEM,
  navSections,
  type NavSection,
} from "@/lib/nav";

/** The module version domain — distinct from Estimate/Schedule record versions. */
export const MODULE_VERSION = "Beta V0.015";

export type ModuleKey =
  | "design"
  | "construction_admin"
  | "estimating_timeframe"
  | "complete_aec";

/** Capability keys (spec §6). Capabilities grant access; they do not redefine
 *  how the underlying systems work. */
export type Capability =
  | "estimates_access"
  | "schedule_access"
  | "document_generator"
  | "architecture"
  | "engineering"
  | "interior_design"
  | "construction_administration"
  | "procurement";

export interface AppModule {
  key: ModuleKey;
  /** 1–4, for the "Module N" label. */
  number: number;
  name: string;
  tagline: string;
  icon: LucideIcon;
  version: string;
  capabilities: Capability[];
  /** Landing route for this module. */
  dashboardHref: string;
  /** Sidebar navigation shown while this module is active. */
  nav: NavSection[];
}

// Shared "Documents" group (the shared Document Generator, spec §11).
const DOC_GENERATOR = { label: "Document Generator", href: "/documents/generate", icon: FileOutput };
const DOC_REGISTER = { label: "Document Register", href: "/documents/register", icon: FolderArchive };
const DOC_TEMPLATES = { label: "Templates", href: "/documents/templates", icon: FileStack };

/**
 * The drawings bin — imported from `lib/nav.ts`, never redeclared here.
 *
 * A drawing IS the document a design module produces, so it belongs in the same
 * section as the document tools rather than in a group of its own. A "Documents"
 * section that held no drawings is precisely why the shipped register looked to
 * its owner like it did not exist.
 */
const DRAWINGS_REGISTER = DRAWINGS_REGISTER_ITEM;
const DRAWINGS_INTAKE = DRAWINGS_INTAKE_ITEM;

const DASHBOARD_HREF: Record<ModuleKey, string> = {
  design: "/modules/design",
  construction_admin: "/modules/construction-admin",
  estimating_timeframe: "/modules/estimating-timeframe",
  complete_aec: "/modules/complete-aec",
};

/**
 * MODULE 3 — Construction Estimates & Construction Timeframe.
 * The primary home of the two protected systems. Estimates and Schedule are
 * named directly (spec §4) and point at their existing routes.
 */
const MODULE_3: AppModule = {
  key: "estimating_timeframe",
  number: 3,
  name: "Construction Estimates & Construction Timeframe",
  tagline: "Estimating & Planning",
  icon: Calculator,
  version: MODULE_VERSION,
  capabilities: ["estimates_access", "schedule_access", "document_generator"],
  dashboardHref: DASHBOARD_HREF.estimating_timeframe,
  nav: [
    { title: "Overview", items: [{ label: "Module 3 Dashboard", href: DASHBOARD_HREF.estimating_timeframe, icon: LayoutDashboard }] },
    { title: "Estimating", items: [{ label: "Estimates", href: "/estimates", icon: Calculator }] },
    { title: "Planning", items: [{ label: "Schedule", href: "/schedule", icon: CalendarClock }] },
    { title: "Documents", items: [DOC_GENERATOR, DOC_REGISTER, DOC_TEMPLATES] },
  ],
};

/**
 * MODULE 1 — Architecture & Engineering Design.
 * Design capabilities are not yet built; those items are shown "coming soon".
 */
const MODULE_1: AppModule = {
  key: "design",
  number: 1,
  name: "Architecture & Engineering Design",
  tagline: "Design",
  icon: Building2,
  version: MODULE_VERSION,
  capabilities: ["architecture", "engineering", "interior_design", "document_generator"],
  dashboardHref: DASHBOARD_HREF.design,
  nav: [
    { title: "Overview", items: [{ label: "Module 1 Dashboard", href: DASHBOARD_HREF.design, icon: LayoutDashboard }] },
    {
      title: "Design",
      items: [
        { label: "Design Register", href: "/design", icon: FileStack },
        { label: "Service Proposals", href: "/design/service-proposals", icon: FileSignature },
        { label: "Architecture", href: "/design/architecture", icon: Building2 },
        { label: "Engineering", href: "/design/engineering", icon: PencilRuler },
        { label: "Interior Design", href: "/design/interior", icon: Sofa },
      ],
    },
    { title: "Delivery", items: [{ label: "Projects", href: "/projects", icon: FolderKanban }] },
    {
      title: DRAWINGS_AND_DOCUMENTS,
      items: [DRAWINGS_REGISTER, DRAWINGS_INTAKE, DOC_GENERATOR, DOC_REGISTER],
    },
  ],
};

/**
 * MODULE 2 — Construction Administration.
 * Construction Admin exists; Procurement & Material Selection are "coming soon".
 */
const MODULE_2: AppModule = {
  key: "construction_admin",
  number: 2,
  name: "Construction Administration",
  tagline: "Construction Admin",
  icon: HardHat,
  version: MODULE_VERSION,
  capabilities: ["construction_administration", "procurement", "document_generator"],
  dashboardHref: DASHBOARD_HREF.construction_admin,
  nav: [
    { title: "Overview", items: [{ label: "Module 2 Dashboard", href: DASHBOARD_HREF.construction_admin, icon: LayoutDashboard }] },
    {
      title: "Construction",
      items: [
        { label: "Construction Admin", href: "/construction-admin", icon: HardHat },
        { label: "Procurement", href: "/procurement", icon: ShoppingCart },
        { label: "Material Selection", href: "/materials", icon: Boxes },
      ],
    },
    {
      title: DRAWINGS_AND_DOCUMENTS,
      items: [DRAWINGS_REGISTER, DRAWINGS_INTAKE, DOC_GENERATOR, DOC_REGISTER],
    },
  ],
};

/**
 * MODULE 4 — Complete AEC.
 * The superset: the entire existing navigation, unchanged, plus the shared
 * Documents group. It exposes the SAME Estimates and Schedule routes/records as
 * Module 3 — there is exactly one of each system (spec §5). This is the default
 * module so existing users keep the full navigation they know.
 */
const MODULE_4: AppModule = {
  key: "complete_aec",
  number: 4,
  name: "Complete AEC",
  tagline: "Everything",
  icon: Boxes,
  version: MODULE_VERSION,
  capabilities: [
    "architecture",
    "engineering",
    "interior_design",
    "estimates_access",
    "schedule_access",
    "construction_administration",
    "procurement",
    "document_generator",
  ],
  dashboardHref: DASHBOARD_HREF.complete_aec,
  nav: [
    // The full existing navigation, verbatim …
    ...navSections,
    // … plus the shared Document Generator.
    { title: "Documents", items: [DOC_GENERATOR, DOC_REGISTER, DOC_TEMPLATES] },
  ],
};

/** Modules in display order (1 → 4). */
export const MODULES: AppModule[] = [MODULE_1, MODULE_2, MODULE_3, MODULE_4];

export const MODULE_MAP: Record<ModuleKey, AppModule> = {
  design: MODULE_1,
  construction_admin: MODULE_2,
  estimating_timeframe: MODULE_3,
  complete_aec: MODULE_4,
};

/** Default active module: Complete AEC (the full existing nav). */
export const DEFAULT_MODULE: ModuleKey = "complete_aec";

/** Cookie the active module is persisted under (read server-side in the layout). */
export const MODULE_COOKIE = "aecflow_module";

export function isModuleKey(v: unknown): v is ModuleKey {
  return typeof v === "string" && v in MODULE_MAP;
}

export function getModule(key: ModuleKey): AppModule {
  return MODULE_MAP[key];
}

export function moduleHasCapability(key: ModuleKey, cap: Capability): boolean {
  return MODULE_MAP[key].capabilities.includes(cap);
}

/** Every nav item across all modules — used for page-title resolution so routes
 *  introduced by the module shell (/modules/*, /documents/*) resolve a title. */
export function allModuleNavItems() {
  const seen = new Set<string>();
  const items: { label: string; href: string }[] = [];
  for (const m of MODULES) {
    for (const section of m.nav) {
      for (const item of section.items) {
        if (seen.has(item.href)) continue;
        seen.add(item.href);
        items.push({ label: item.label, href: item.href });
      }
    }
  }
  // Settings is a shell-level link pinned in the sidebar footer (present in every
  // module) rather than a per-module nav item, so include it here for page-title
  // resolution.
  if (!seen.has("/settings")) items.push({ label: "Settings", href: "/settings" });
  return items;
}
