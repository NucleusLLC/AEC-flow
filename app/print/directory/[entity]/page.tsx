import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print/print-button";
import { formatCurrency, formatDate, getSystemCurrency, setSystemCurrency } from "@/lib/format";
import { getSystemCurrency as getConfiguredCurrency, getPracticeSettings } from "@/lib/server/practice-config";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { getProposals } from "@/lib/data/proposals";
import { getOrders } from "@/lib/data/orders";
import { getTeam } from "@/lib/data/team";
import { getLeaveRequests } from "@/lib/data/leave";
import { getFirmIdentity } from "@/lib/server/firm";

type Row = Record<string, unknown>;
type Col = { label: string; key: string; right?: boolean; fmt?: (v: unknown, row: Row) => string };

const money = (v: unknown, row: Row) => formatCurrency(Number(v ?? 0), (row.currency as string) || getSystemCurrency());

const CONFIG: Record<string, { title: string; getter: () => Promise<unknown[]>; columns: Col[]; factSheet?: string }> = {
  clients: {
    title: "Client Directory",
    getter: getClients,
    factSheet: "/print/clients",
    columns: [
      { label: "Name", key: "name" },
      { label: "Company", key: "companyName" },
      { label: "Contact", key: "contactPerson" },
      { label: "Type", key: "type" },
      { label: "Status", key: "status" },
      { label: "Location", key: "location" },
    ],
  },
  projects: {
    title: "Project Register",
    getter: getProjects,
    factSheet: "/print/projects",
    columns: [
      { label: "No.", key: "projectNumber" },
      { label: "Name", key: "name" },
      { label: "Client", key: "clientName" },
      { label: "Manager", key: "manager" },
      { label: "Status", key: "status" },
      { label: "Progress", key: "progressPct", right: true, fmt: (v) => `${Number(v ?? 0)}%` },
    ],
  },
  proposals: {
    title: "Proposals Register",
    getter: getProposals,
    columns: [
      { label: "Ref", key: "refNumber" },
      { label: "Title", key: "title" },
      { label: "Client", key: "clientName" },
      { label: "Status", key: "status" },
      { label: "Fee", key: "totalFee", right: true, fmt: money },
    ],
  },
  orders: {
    title: "Orders Register",
    getter: getOrders,
    factSheet: "/print/orders",
    columns: [
      { label: "No.", key: "orderNumber" },
      { label: "Title", key: "title" },
      { label: "Client", key: "clientName" },
      { label: "Status", key: "status" },
      { label: "Fee", key: "fee", right: true, fmt: money },
    ],
  },
  team: {
    title: "Team Roster",
    getter: getTeam,
    factSheet: "/print/team",
    columns: [
      { label: "Name", key: "name" },
      { label: "Email", key: "email" },
      { label: "Role", key: "role" },
      { label: "Department", key: "department" },
      { label: "Status", key: "status" },
    ],
  },
  leave: {
    title: "Leave Register",
    getter: getLeaveRequests,
    columns: [
      { label: "Member", key: "userName" },
      { label: "Type", key: "type" },
      { label: "Status", key: "status" },
      { label: "Start", key: "startDate" },
      { label: "End", key: "endDate" },
      { label: "Days", key: "days", right: true },
    ],
  },
};

type PageProps = { params: Promise<{ entity: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { entity } = await params;
  return { title: CONFIG[entity] ? `${CONFIG[entity].title} · AEC-flow` : "Directory" };
}

export default async function DirectoryPrintPage({ params }: PageProps) {
  const { entity } = await params;
  const cfg = CONFIG[entity];
  if (!cfg) notFound();

  // Print routes aren't wrapped by the (app) layout that normally seeds the
  // System Currency, so seed it here for the money() fallback (per-row
  // currencies still override).
  const [configuredCurrency, practice] = await Promise.all([getConfiguredCurrency(), getPracticeSettings()]);
  setSystemCurrency(configuredCurrency);
  const firm = await getFirmIdentity();
  const companyName = firm.name;
  const rows = (await cfg.getter()) as Row[];
  const cell = (c: Col, row: Row) => {
    const v = row[c.key];
    if (c.fmt) return c.fmt(v, row);
    return v === null || v === undefined || v === "" ? "—" : String(v);
  };

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`@page { size: A4 portrait; margin: 14mm; } @media print { html, body { background: #fff; } }`}</style>

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link href="/exports" className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Data
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto my-6 w-[210mm] max-w-full bg-white p-[16mm] text-[12px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:w-auto print:p-0 print:shadow-none">
        {/* Letterhead */}
        <DocumentLetterhead
          logo={{ dataUrl: practice.logoDataUrl, position: practice.logo.position, size: practice.logo.size }}
          name={companyName}
          borderClass="border-b-2 border-gray-900 pb-4"
          details={
            <div className="text-right">
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{cfg.title}</div>
              <div className="mt-1 text-xs text-gray-500">{rows.length} records · {formatDate(new Date())}</div>
            </div>
          }
        />

        <table className="mt-5 w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
              {cfg.columns.map((c) => (
                <th key={c.key} className={`py-2 pr-3 font-semibold ${c.right ? "text-right" : ""}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 align-top">
                  {cfg.columns.map((c, ci) => (
                    <td key={c.key} className={`py-1.5 pr-3 ${c.right ? "text-right tabular-nums" : ""} text-gray-800`}>
                      {ci === 0 && cfg.factSheet ? (
                        <a href={`${cfg.factSheet}/${String(row.id)}`} className="text-gray-900 underline-offset-2 hover:underline print:no-underline">
                          {cell(c, row)}
                        </a>
                      ) : (
                        cell(c, row)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-4 text-gray-400" colSpan={cfg.columns.length}>No records.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          {companyName} · {cfg.title} · {rows.length} records
        </div>
      </div>
    </div>
  );
}
