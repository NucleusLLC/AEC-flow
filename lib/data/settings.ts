/**
 * Settings data-access layer.
 *
 * IMPORTANT (single-tenant -> SaaS hedge): pages call functions from this module
 * rather than touching Prisma directly. When the suite becomes multi-tenant,
 * org scoping (orgId) gets added HERE and nowhere else.
 *
 * Placeholder data for now (no DB until the morning Supabase setup). The shapes
 * mirror the practice profile + ProposalTemplate + User(role) parts of the schema
 * so the bodies can be swapped for Prisma queries without touching call sites.
 */

export type UserRole = "ADMIN" | "DIRECTOR" | "MANAGER" | "STAFF" | "VIEWER";
export type Department = "DESIGN" | "ENGINEERING" | "MANAGEMENT" | "ADMIN" | "FINANCE";

export type PracticeProfile = {
  name: string;
  legalName: string;
  trn: string;
  founded: string;
  addressLine: string;
  city: string;
  emirate: string;
  country: string;
  phone: string;
  email: string;
  website: string;
};

export type ProposalTemplate = {
  id: string;
  name: string;
  discipline: string;
  sections: number;
  isDefault: boolean;
  updatedAt: string;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: Department | null;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
};

export type RoleInfo = {
  role: UserRole;
  label: string;
  description: string;
  memberCount: number;
};

export type Preferences = {
  defaultCurrency: string;
  locale: string;
  fiscalYearStart: string;
  vatPercent: number;
  proposalValidityDays: number;
  projectNumberFormat: string;
  weekStart: string;
  notifyProposalApproved: boolean;
  notifyPhaseOverdue: boolean;
  notifyLeaveRequest: boolean;
  weeklyDigest: boolean;
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrator",
  DIRECTOR: "Director",
  MANAGER: "Manager",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

const ROLE_DESCRIPTION: Record<UserRole, string> = {
  ADMIN: "Full access including org settings, billing, and member management.",
  DIRECTOR: "Practice-wide visibility, can approve proposals and manage all projects.",
  MANAGER: "Manages assigned projects, phases, proposals, and meeting minutes.",
  STAFF: "Works on assigned phases; can log time, minutes, and deliverables.",
  VIEWER: "Read-only access to dashboards and assigned records.",
};

// Generic blank defaults — each company fills in its own profile. (No ZenArch
// branding shipped as defaults.) Becomes per-company config once multi-tenant.
export const PRACTICE: PracticeProfile = {
  name: "",
  legalName: "",
  trn: "",
  founded: "",
  addressLine: "",
  city: "",
  emirate: "",
  country: "",
  phone: "",
  email: "",
  website: "",
};

const TEMPLATES: ProposalTemplate[] = [
  { id: "tpl-arch", name: "Architecture — Full Services", discipline: "Architecture", sections: 9, isDefault: true, updatedAt: "2026-05-12" },
  { id: "tpl-interior", name: "Interior Design Package", discipline: "Interior", sections: 7, isDefault: false, updatedAt: "2026-04-28" },
  { id: "tpl-struct", name: "Structural Engineering", discipline: "Structural", sections: 6, isDefault: false, updatedAt: "2026-03-15" },
  { id: "tpl-mep", name: "MEP Consultancy", discipline: "MEP", sections: 6, isDefault: false, updatedAt: "2026-03-15" },
  { id: "tpl-pm", name: "Project Management & Supervision", discipline: "Project Mgmt", sections: 8, isDefault: false, updatedAt: "2026-02-02" },
  { id: "tpl-villa", name: "Private Villa — Concept to Handover", discipline: "Architecture", sections: 10, isDefault: false, updatedAt: "2026-05-30" },
];

const MEMBERS: Member[] = [
  { id: "u-greg", name: "Greg Lacle", email: "greg@zenarch.ae", role: "DIRECTOR", department: "MANAGEMENT", status: "ACTIVE" },
  { id: "u-layla", name: "Layla Hassan", email: "l.hassan@zenarch.ae", role: "MANAGER", department: "MANAGEMENT", status: "ACTIVE" },
  { id: "u-omar", name: "Omar Farouk", email: "o.farouk@zenarch.ae", role: "MANAGER", department: "DESIGN", status: "ACTIVE" },
  { id: "u-sara", name: "Sara Khan", email: "s.khan@zenarch.ae", role: "MANAGER", department: "DESIGN", status: "ACTIVE" },
  { id: "u-idris", name: "Idris Mansour", email: "i.mansour@zenarch.ae", role: "STAFF", department: "DESIGN", status: "ACTIVE" },
  { id: "u-hana", name: "Hana Yusuf", email: "h.yusuf@zenarch.ae", role: "STAFF", department: "DESIGN", status: "ACTIVE" },
  { id: "u-wei", name: "Wei Chen", email: "w.chen@zenarch.ae", role: "STAFF", department: "ENGINEERING", status: "ACTIVE" },
  { id: "u-nadia", name: "Nadia Roy", email: "n.roy@zenarch.ae", role: "STAFF", department: "ENGINEERING", status: "ON_LEAVE" },
  { id: "u-tom", name: "Tom Becker", email: "t.becker@zenarch.ae", role: "STAFF", department: "DESIGN", status: "ACTIVE" },
  { id: "u-mariam", name: "Mariam Al Suwaidi", email: "m.alsuwaidi@zenarch.ae", role: "ADMIN", department: "ADMIN", status: "ACTIVE" },
  { id: "u-finance", name: "Rashid Karim", email: "r.karim@zenarch.ae", role: "VIEWER", department: "FINANCE", status: "ACTIVE" },
];

/** Practice-wide preference defaults; a user's saved prefs are merged over these. */
export const PREFERENCES: Preferences = {
  defaultCurrency: "AWG",
  locale: "en-GB",
  fiscalYearStart: "January",
  vatPercent: 5,
  proposalValidityDays: 30,
  projectNumberFormat: "ZA-{YYYY}-{seq}",
  weekStart: "Monday",
  notifyProposalApproved: true,
  notifyPhaseOverdue: true,
  notifyLeaveRequest: true,
  weeklyDigest: false,
};

export async function getPracticeProfile(): Promise<PracticeProfile> {
  return PRACTICE;
}

export async function getProposalTemplates(): Promise<ProposalTemplate[]> {
  return TEMPLATES;
}

export async function getMembers(): Promise<Member[]> {
  return MEMBERS;
}

export async function getRoles(): Promise<RoleInfo[]> {
  return rolesFromMembers(MEMBERS);
}

/**
 * Build the role-summary cards from a live member list. Pure + client-safe
 * (no DB import) so the page can derive counts from the real User rows.
 */
export function rolesFromMembers(members: ReadonlyArray<{ role: UserRole }>): RoleInfo[] {
  const order: UserRole[] = ["ADMIN", "DIRECTOR", "MANAGER", "STAFF", "VIEWER"];
  return order.map((role) => ({
    role,
    label: ROLE_LABEL[role],
    description: ROLE_DESCRIPTION[role],
    memberCount: members.filter((m) => m.role === role).length,
  }));
}

export async function getPreferences(): Promise<Preferences> {
  return PREFERENCES;
}
