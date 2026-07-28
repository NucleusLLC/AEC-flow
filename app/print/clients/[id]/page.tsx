import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print/print-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { getClient } from "@/lib/data/clients";
import { CLIENT_TYPE_LABEL, type ClientStatus } from "@/lib/data/clients.types";
import { getSystemCurrency, getPracticeSettings } from "@/lib/server/practice-config";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getFirmIdentity } from "@/lib/server/firm";
import { PageRules } from "@/components/print/page-rules";
import { PagedPreview } from "@/components/print/paged-preview";

const STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PROSPECT: "Prospect",
};

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const c = await getClient(id);
  return { title: c ? `${c.name} — Client Profile` : "Client" };
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-medium text-gray-900">{value}</div>
    </div>
  );
}

export default async function ClientFactSheet({ params }: PageProps) {
  const { id } = await params;
  const [c, currency, practice] = await Promise.all([getClient(id), getSystemCurrency(), getPracticeSettings()]);
  if (!c) notFound();
  const firm = await getFirmIdentity();
  const companyName = firm.name;

  const lifetime = c.proposals.filter((p) => p.status === "APPROVED").reduce((n, p) => n + p.value, 0);
  const pipeline = c.proposals
    .filter((p) => ["DRAFT", "SENT", "PENDING", "ON_HOLD"].includes(p.status))
    .reduce((n, p) => n + p.value, 0);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <PageRules margins={{ top: 14, right: 14, bottom: 14, left: 14 }} />

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link href={`/clients/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to client
        </Link>
        <PrintButton />
      </div>

      <div className="aec-doc mx-auto my-6 w-[210mm] max-w-full bg-white p-[14mm] text-[12px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:w-auto print:p-0 print:shadow-none">
        <PagedPreview pageContentHeightMm={269}>
        {/* Letterhead */}
        <DocumentLetterhead
          logo={{ dataUrl: practice.logoDataUrl, position: practice.logo.position, size: practice.logo.size }}
          name={companyName}
          borderClass="border-b-2 border-gray-900 pb-4"
          details={
            <div className="text-right">
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">Client Profile</div>
              <div className="mt-1 text-xs text-gray-500">Client since {formatDate(c.createdAt)}</div>
            </div>
          }
        />

        <h1 className="mt-5 text-xl font-bold text-gray-900">{c.name}</h1>
        {c.companyName ? <p className="mt-0.5 text-gray-600">{c.companyName}</p> : null}

        {/* Key facts */}
        <div className="mt-5 grid grid-cols-4 gap-4 rounded-md bg-gray-50 px-4 py-3 text-xs print:bg-gray-50">
          <Meta label="Type" value={CLIENT_TYPE_LABEL[c.type]} />
          <Meta label="Status" value={STATUS_LABEL[c.status]} />
          <Meta label="Primary Contact" value={c.contactPerson || "—"} />
          <Meta label="TRN" value={c.taxNumber || "—"} />
          <Meta label="Email" value={c.email || "—"} />
          <Meta label="Phone" value={c.phone || "—"} />
          <Meta label="Website" value={c.website || "—"} />
          <Meta label="Tags" value={c.tags.length ? c.tags.join(", ") : "—"} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <Meta label="Lifetime Value (approved)" value={formatCurrency(lifetime, currency)} />
          <Meta label="Open Pipeline" value={formatCurrency(pipeline, currency)} />
        </div>

        {c.notes ? (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Notes</div>
            <p className="mt-0.5 whitespace-pre-wrap text-gray-700">{c.notes}</p>
          </div>
        ) : null}

        {/* Addresses */}
        {c.addresses.length ? (
          <>
            <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Addresses</h2>
            <table className="mt-2 w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-semibold">Label</th>
                  <th className="py-2 pr-3 font-semibold">Address</th>
                  <th className="py-2 pr-3 font-semibold">City</th>
                  <th className="py-2 font-semibold">Country</th>
                </tr>
              </thead>
              <tbody>
                {c.addresses.map((a, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 text-gray-900">{a.label}{a.isPrimary ? " ★" : ""}</td>
                    <td className="py-1.5 pr-3 text-gray-700">{a.line1}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{[a.city, a.emirate].filter(Boolean).join(", ") || "—"}</td>
                    <td className="py-1.5 text-gray-600">{a.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {/* Proposals */}
        <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Proposals</h2>
        <table className="mt-2 w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-3 font-semibold">Ref</th>
              <th className="py-2 pr-3 font-semibold">Title</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Date</th>
              <th className="py-2 text-right font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            {c.proposals.length ? (
              c.proposals.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 font-mono text-[10px] text-gray-600">{p.ref}</td>
                  <td className="py-1.5 pr-3 text-gray-900">{p.title}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{p.status}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{formatDate(p.date)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{formatCurrency(p.value, currency)}</td>
                </tr>
              ))
            ) : (
              <tr><td className="py-3 text-gray-400" colSpan={5}>No proposals.</td></tr>
            )}
          </tbody>
        </table>

        {/* Projects */}
        <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Projects</h2>
        <table className="mt-2 w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-3 font-semibold">No.</th>
              <th className="py-2 pr-3 font-semibold">Name</th>
              <th className="py-2 pr-3 font-semibold">Manager</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 text-right font-semibold">Progress</th>
            </tr>
          </thead>
          <tbody>
            {c.projects.length ? (
              c.projects.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 font-mono text-[10px] text-gray-600">{p.number}</td>
                  <td className="py-1.5 pr-3 text-gray-900">{p.name}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{p.manager}</td>
                  <td className="py-1.5 pr-3 text-gray-600">{p.status}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{p.progressPct}%</td>
                </tr>
              ))
            ) : (
              <tr><td className="py-3 text-gray-400" colSpan={5}>No projects.</td></tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          {companyName} · {c.name} · Client Profile · Generated {formatDate(new Date())}
        </div>
      </PagedPreview>
      </div>
    </div>
  );
}
