import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, type UserRole, type UserStatus } from "@/lib/data/team.types";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const statusTone: Record<UserStatus, Tone> = {
  ACTIVE: "green",
  ON_LEAVE: "amber",
  INACTIVE: "slate",
};

const statusLabel: Record<UserStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  INACTIVE: "Inactive",
};

const roleTone: Record<UserRole, Tone> = {
  DIRECTOR: "violet",
  MANAGER: "blue",
  ADMIN: "slate",
  STAFF: "neutral",
  VIEWER: "neutral",
};

export function TeamStatusBadge({ status }: { status: UserStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge tone={roleTone[role]}>{ROLE_LABEL[role]}</Badge>;
}
