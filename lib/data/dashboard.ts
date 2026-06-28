/**
 * Dashboard data-access layer.
 *
 * Composes the dashboard view from the per-module data layers (projects,
 * proposals, team, leave) so the dashboard stays consistent with each module's
 * own pages. When those modules move to Prisma, this file needs no changes —
 * it only calls their public getters/summaries.
 */

import { getProjects, summarizeProjects } from "./projects";
import {
  getProposals,
  summarizeProposals,
  PROPOSAL_STATUS_LABEL,
  type ProposalStatus,
} from "./proposals";
import { getTeam, summarizeTeam } from "./team";
import { getWhoIsOut, LEAVE_TYPE_LABEL } from "./leave";
import { formatCurrencyCompact, formatDate } from "@/lib/format";

export type Trend = { value: number; direction: "up" | "down" | "flat" };

export type DashboardStat = {
  key: string;
  label: string;
  value: string;
  hint: string;
  trend?: Trend;
};

export type PipelineStage = {
  stage: string;
  count: number;
  value: number;
};

export type ActiveProject = {
  id: string;
  number: string;
  name: string;
  client: string;
  manager: string;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  progressPct: number;
  targetEndDate: string;
};

export type ActivityEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
};

export type LeaveToday = {
  id: string;
  name: string;
  type: string;
  until: string;
};

export type DashboardData = {
  stats: DashboardStat[];
  pipeline: PipelineStage[];
  projects: ActiveProject[];
  activity: ActivityEntry[];
  onLeave: LeaveToday[];
};

const PIPELINE_STAGES: ProposalStatus[] = ["DRAFT", "SENT", "PENDING", "APPROVED", "ON_HOLD"];

const ACTIVITY_VERB: Record<ProposalStatus, string> = {
  DRAFT: "drafted proposal",
  SENT: "sent proposal",
  PENDING: "submitted proposal",
  APPROVED: "approved proposal",
  ON_HOLD: "put on hold",
  REJECTED: "lost proposal",
  VOID: "voided proposal",
};

export async function getDashboardData(): Promise<DashboardData> {
  const [projects, proposals, team, whoIsOut] = await Promise.all([
    getProjects(),
    getProposals(),
    getTeam(),
    getWhoIsOut(),
  ]);

  const projSummary = summarizeProjects(projects);
  const propSummary = summarizeProposals(proposals);
  const teamSummary = summarizeTeam(team);

  const stats: DashboardStat[] = [
    {
      key: "active-projects",
      label: "Active Projects",
      value: String(projSummary.active),
      hint: `${projSummary.atRisk} at risk`,
      trend: { value: 12, direction: "up" },
    },
    {
      key: "pipeline-value",
      label: "Pipeline Value",
      value: formatCurrencyCompact(propSummary.openValue),
      hint: `across ${propSummary.openCount} open proposals`,
      trend: { value: 8, direction: "up" },
    },
    {
      key: "awaiting-approval",
      label: "Awaiting Approval",
      value: String(propSummary.awaitingCount),
      hint: `${formatCurrencyCompact(propSummary.awaitingValue)} pending`,
      trend: { value: 2, direction: "down" },
    },
    {
      key: "team-utilisation",
      label: "Team Utilisation",
      value: `${teamSummary.avgUtilisation}%`,
      hint: `${teamSummary.onLeave} of ${teamSummary.total} on leave`,
      trend: { value: 3, direction: "up" },
    },
  ];

  const pipeline: PipelineStage[] = PIPELINE_STAGES.map((status) => {
    const matches = proposals.filter((p) => p.status === status);
    return {
      stage: PROPOSAL_STATUS_LABEL[status],
      count: matches.length,
      value: matches.reduce((n, p) => n + p.totalFee, 0),
    };
  });

  const projects4: ActiveProject[] = projects
    .filter((p) => p.status === "ACTIVE" || p.status === "ON_HOLD")
    .sort((a, b) => (a.targetEndDate ?? "").localeCompare(b.targetEndDate ?? ""))
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      number: p.projectNumber,
      name: p.name,
      client: p.clientName,
      manager: p.manager,
      status: p.status as ActiveProject["status"],
      priority: p.priority,
      progressPct: p.progressPct,
      targetEndDate: p.targetEndDate ?? "",
    }));

  const activity: ActivityEntry[] = [...proposals]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      actor: p.owner,
      action: ACTIVITY_VERB[p.status],
      target: `${p.refNumber} · ${p.title}`,
      at: formatDate(p.createdAt),
    }));

  const onLeave: LeaveToday[] = whoIsOut.map((w) => ({
    id: w.id,
    name: w.name,
    type: LEAVE_TYPE_LABEL[w.type],
    until: w.until,
  }));

  return { stats, pipeline, projects: projects4, activity, onLeave };
}
