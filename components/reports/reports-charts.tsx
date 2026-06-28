"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardHeader, CardBody } from "@/components/ui/card";

export type NameValue = { name: string; value: number };
export type MonthValue = { month: string; value: number };

const BRAND = "#1d4ed8";
const PIE_COLORS = ["#1d4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

function aed(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}k`;
  return `AED ${n}`;
}

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #e6e8eb",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
};

export function ReportsCharts({
  pipelineByStatus,
  projectsByStatus,
  projectsByDiscipline,
  monthlyPipeline,
}: {
  pipelineByStatus: NameValue[];
  projectsByStatus: NameValue[];
  projectsByDiscipline: NameValue[];
  monthlyPipeline: MonthValue[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Pipeline value by status */}
      <Card>
        <CardHeader title="Pipeline Value by Status" subtitle="Proposal fee value (AED)" />
        <CardBody>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineByStatus} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => aed(Number(v))} tick={{ fontSize: 11, fill: "#9aa1ab" }} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={(v) => aed(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "rgba(29,78,216,0.06)" }} />
                <Bar dataKey="value" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Projects by status (donut) */}
      <Card>
        <CardHeader title="Projects by Status" subtitle="Active portfolio breakdown" />
        <CardBody>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectsByStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  label={(e) => `${e.name}: ${e.value}`}
                  labelLine={false}
                  fontSize={11}
                >
                  {projectsByStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Projects by discipline */}
      <Card>
        <CardHeader title="Projects by Discipline" subtitle="Discipline coverage across the portfolio" />
        <CardBody>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={projectsByDiscipline}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#9aa1ab" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(29,78,216,0.06)" }} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Monthly pipeline trend */}
      <Card>
        <CardHeader title="Proposal Value by Month" subtitle="When proposals were raised (AED)" />
        <CardBody>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyPipeline} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => aed(Number(v))} tick={{ fontSize: 11, fill: "#9aa1ab" }} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={(v) => aed(Number(v))} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={BRAND} strokeWidth={2.5} dot={{ r: 3, fill: BRAND }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
