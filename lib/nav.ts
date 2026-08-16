import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  FolderKanban,
  Map,
  Calculator,
  Database,
  CalendarDays,
  CalendarClock,
  FileStack,
  FolderOpen,
  HardHat,
  UsersRound,
  MessageSquare,
  NotebookPen,
  BarChart3,
  Activity,
  Download,
  Upload,
  Bug,
  LayoutGrid,
  ListChecks,
  ShoppingCart,
  Boxes,
  Building2,
  PencilRuler,
  Sofa,
  FileSignature,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Grayed-out "coming soon" — visible in the nav but not navigable during the beta. */
  disabled?: boolean;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

/**
 * The drawings bin, defined ONCE.
 *
 * Two navigations reach these routes — this list (the full/Complete-AEC
 * sidebar) and `lib/modules.ts` (the per-module sidebars, which import these
 * constants). They were a copied literal away from disagreeing about a label,
 * and a "Drawings" that means one thing in Module 1 and another in Module 4 is
 * how a shipped feature comes to look missing.
 *
 * `/drawings` is the register; `/drawings/intake` is the drop zone that reads
 * the sheet number and title off a PDF's title block.
 */
export const DRAWINGS_REGISTER_ITEM: NavItem = {
  label: "Drawings",
  href: "/drawings",
  icon: FileStack,
};
export const DRAWINGS_INTAKE_ITEM: NavItem = {
  label: "Add Drawings",
  href: "/drawings/intake",
  icon: UploadCloud,
};

/** Section title used wherever the drawings bin appears. */
export const DRAWINGS_AND_DOCUMENTS = "Drawings & Documents";

/**
 * BETA launch scope (AEC Flow). Active modules: Clients, Meeting Minutes,
 * Estimates, Schedule, Proposals, Construction Administration, Drawings —
 * plus Dashboard and Settings. Everything else is `disabled` (grayed out)
 * until it is production-ready.
 */
export const navSections: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
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
  {
    title: "Business Development",
    items: [
      { label: "Clients", href: "/clients", icon: Users },
      { label: "Meeting Minutes", href: "/meetings", icon: NotebookPen },
      { label: "Estimates", href: "/estimates", icon: Calculator },
      { label: "Cost Database", href: "/cost-database", icon: Database, disabled: true },
      { label: "Proposals", href: "/proposals", icon: FileText },
      { label: "Orders", href: "/orders", icon: ClipboardList, disabled: true },
    ],
  },
  {
    title: "Delivery",
    items: [
      { label: "Schedule", href: "/schedule", icon: CalendarClock },
      { label: "Tasks", href: "/tasks", icon: ListChecks },
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Land Development", href: "/development", icon: Map, disabled: true },
    ],
  },
  {
    title: "Construction Administration",
    items: [
      { label: "Construction Admin", href: "/construction-admin", icon: HardHat },
      { label: "Procurement", href: "/procurement", icon: ShoppingCart },
      { label: "Material Selection", href: "/materials", icon: Boxes },
    ],
  },
  {
    // Its own section now, not a tail on Construction Administration. The
    // register and the intake are both live — a drawing uploaded here is stored,
    // read and downloadable. The Documents hub is still a placeholder.
    title: DRAWINGS_AND_DOCUMENTS,
    items: [
      DRAWINGS_REGISTER_ITEM,
      DRAWINGS_INTAKE_ITEM,
      { label: "Documents", href: "/documents", icon: FolderOpen, disabled: true },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Team", href: "/team", icon: UsersRound },
      { label: "Chat", href: "/chat", icon: MessageSquare },
      { label: "Leave", href: "/leave", icon: CalendarDays, disabled: true },
    ],
  },
  {
    items: [
      { label: "Activity", href: "/activity", icon: Activity, disabled: true },
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Imports", href: "/imports", icon: Upload, disabled: true },
      { label: "Exports", href: "/exports", icon: Download, disabled: true },
      { label: "Widgets", href: "/widgets", icon: LayoutGrid },
      { label: "Beta Reports", href: "/beta-reports", icon: Bug },
    ],
  },
];
