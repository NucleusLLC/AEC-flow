"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
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
  const t = useT();
  return <Badge tone={statusTone[status]}>{t(statusLabel[status])}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  const t = useT();
  return <Badge tone={roleTone[role]}>{t(ROLE_LABEL[role])}</Badge>;
}
