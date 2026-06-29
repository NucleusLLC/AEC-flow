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
  Settings,
  Bug,
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
 * BETA launch scope (AEC Flow). Active modules: Clients, Estimates, Schedule,
 * Proposals, Construction Administration (which now houses Drawings, Documents and
 * Meeting Minutes) — plus Dashboard and Settings. Everything else is `disabled`
 * (grayed out) until it is production-ready.
 */
export const navSections: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Business Development",
    items: [
      { label: "Clients", href: "/clients", icon: Users },
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
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Land Development", href: "/development", icon: Map, disabled: true },
    ],
  },
  {
    title: "Construction Administration",
    items: [
      { label: "Construction Admin", href: "/construction-admin", icon: HardHat },
      { label: "Meeting Minutes", href: "/meetings", icon: NotebookPen },
      // Drawings & Documents are still placeholder (no persistence) — grayed until wired.
      { label: "Drawings", href: "/drawings", icon: FileStack },
      { label: "Documents", href: "/documents", icon: FolderOpen, disabled: true },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Team", href: "/team", icon: UsersRound, disabled: true },
      { label: "Chat", href: "/chat", icon: MessageSquare },
      { label: "Leave", href: "/leave", icon: CalendarDays, disabled: true },
    ],
  },
  {
    items: [
      { label: "Activity", href: "/activity", icon: Activity, disabled: true },
      { label: "Reports", href: "/reports", icon: BarChart3, disabled: true },
      { label: "Imports", href: "/imports", icon: Upload, disabled: true },
      { label: "Exports", href: "/exports", icon: Download, disabled: true },
      { label: "Beta Reports", href: "/beta-reports", icon: Bug },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
