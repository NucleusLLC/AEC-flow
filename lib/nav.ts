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
  Mail,
  ScrollText,
  ReceiptText,
  Clock3,
  Wallet,
  TrendingUp,
  Stamp,
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

/**
 * The Building Permit register, defined ONCE for the same reason the drawings
 * bin is: two navigations reach it — this list (the full/Complete-AEC sidebar)
 * and `lib/modules.ts` (Module 1's sidebar) — and a permit register that is
 * called one thing in one module and another elsewhere is a feature its owner
 * cannot find.
 */
export const BUILDING_PERMITS_ITEM: NavItem = {
  label: "Building Permits",
  href: "/design/building-permits",
  icon: Stamp,
};

/**
 * General Documents, defined ONCE for the same reason as the drawings bin and
 * the permit register: it appears in this list and in Module 1's sidebar, and a
 * section called one thing in one module and another elsewhere is a feature its
 * owner cannot find.
 */
export const GENERAL_DOCUMENTS_ITEM: NavItem = {
  label: "General Documents",
  href: "/documents/general",
  icon: ScrollText,
};

/**
 * Construction contracts, defined once like the invoice register and the
 * drawings bin: it appears in this list and in Module 1's sidebar, and a
 * contract filed under one name in one module and another elsewhere is a
 * document nobody finds twice.
 */
export const CONTRACTS_ITEM: NavItem = {
  label: "Contracts",
  href: "/documents/contracts",
  icon: FileSignature,
};

/**
 * Invoices, defined ONCE like the drawings bin and the permit register: the
 * receivables register appears in this list and in Module 1's sidebar, and a
 * finance section called one thing in one module and another elsewhere is a
 * feature the person chasing a payment cannot find.
 */
export const INVOICES_ITEM: NavItem = {
  label: "Invoices",
  href: "/finance/invoices",
  icon: ReceiptText,
};

/**
 * Time and expenses, defined here for the same reason as the invoice register:
 * they appear both in this list and in Module 1's sidebar, and a finance
 * section called one thing in one module and another elsewhere is a feature the
 * person logging an hour cannot find.
 */
export const TIME_ITEM: NavItem = {
  label: "Time",
  href: "/finance/time",
  icon: Clock3,
};

export const EXPENSES_ITEM: NavItem = {
  label: "Expenses",
  href: "/finance/expenses",
  icon: Wallet,
};

export const PROFIT_ITEM: NavItem = {
  label: "Profitability",
  href: "/finance/profit",
  icon: TrendingUp,
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
      BUILDING_PERMITS_ITEM,
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
      GENERAL_DOCUMENTS_ITEM,
      CONTRACTS_ITEM,
      { label: "Documents", href: "/documents", icon: FolderOpen, disabled: true },
    ],
  },
  {
    title: "Finance",
    items: [INVOICES_ITEM, TIME_ITEM, EXPENSES_ITEM, PROFIT_ITEM],
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
      // The record of every outbound send, successes AND failures. It is in the
      // sidebar rather than tucked inside Settings because the question it
      // answers ("did that actually go out?") is asked by whoever pressed Send,
      // not by an administrator.
      { label: "Sent Email", href: "/email", icon: Mail },
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Imports", href: "/imports", icon: Upload, disabled: true },
      { label: "Exports", href: "/exports", icon: Download, disabled: true },
      { label: "Widgets", href: "/widgets", icon: LayoutGrid },
      { label: "Beta Reports", href: "/beta-reports", icon: Bug },
    ],
  },
];
