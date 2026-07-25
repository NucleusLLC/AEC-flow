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
import { formatCurrencyCompact } from "@/lib/format";

const BRAND = "#1d4ed8";
const PIE_COLORS = ["#1d4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #e6e8eb",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
};

type NameValue = { name: string; value: number };
type MonthValue = { month: string; value: number };

export function ProposalAnalyticsCharts({
  pipeline,
  byStatus,
  byBasis,
  valueByMonth,
  currency,
}: {
  pipeline: NameValue[];
  byStatus: NameValue[];
  byBasis: NameValue[];
  valueByMonth: MonthValue[];
  currency: string;
}) {
  const fmt = (n: number) => formatCurrencyCompact(n, currency);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Open pipeline by stage" subtitle="Fee value of live proposals" />
        <CardBody>
          <div className="h-64">
            {pipeline.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline} layout="vertical" margin={{ left: 20, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f2" />
                  <XAxis type="number" tickFormatter={fmt} fontSize={11} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} stroke="#94a3b8" />
                  <Tooltip formatter={(v) => fmt(Number(v) || 0)} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={BRAND} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Value by fee type" subtitle="Percentage-based vs fixed" />
        <CardBody>
          <div className="h-64">
            {byBasis.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byBasis} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                    {byBasis.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v) || 0)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Proposals by status" subtitle="Count across the lifecycle" />
        <CardBody>
          <div className="h-64">
            {byStatus.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStatus} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f2" />
                  <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Proposals" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Proposed value by month" subtitle="Last 6 months (by created date)" />
        <CardBody>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={valueByMonth} margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" />
                <XAxis dataKey="month" fontSize={11} stroke="#94a3b8" />
                <YAxis tickFormatter={fmt} fontSize={11} stroke="#94a3b8" width={56} />
                <Tooltip formatter={(v) => fmt(Number(v) || 0)} contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-muted">No data yet.</div>;
}
