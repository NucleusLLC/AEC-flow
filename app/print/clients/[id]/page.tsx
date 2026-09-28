import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import { getClient } from "@/lib/data/clients";
import { CLIENT_TYPE_LABEL, type ClientStatus } from "@/lib/data/clients.types";
import { getSystemCurrency, getPracticeSettings } from "@/lib/server/practice-config";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";
import { PROPOSAL_STATUS_LABEL } from "@/lib/data/proposals.types";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

const STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PROSPECT: "Prospect",
};

/** Project status wording; unknown statuses print as stored. */
const PROJECT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const c = await getClient(id);
  const t = await getServerT();
  return { title: c ? `${c.name} — ${t("Client Profile")}` : t("Client") };
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
  const t = await getServerT();

  const lifetime = c.proposals.filter((p) => p.status === "APPROVED").reduce((n, p) => n + p.value, 0);
  const pipeline = c.proposals
    .filter((p) => ["DRAFT", "SENT", "PENDING", "ON_HOLD"].includes(p.status))
    .reduce((n, p) => n + p.value, 0);

  return (
    <PrintSurface backHref={`/clients/${c.id}`} backLabel={t("Back to client")}>
      {/* Letterhead */}
      <DocumentLetterhead
        logo={{ dataUrl: practice.logoDataUrl, position: practice.logo.position, size: practice.logo.size }}
        name={companyName}
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{t("Client Profile")}</div>
            <div className="mt-1 text-xs text-gray-500">{fmt(t("Client since {date}"), { date: formatDate(c.createdAt) })}</div>
          </div>
        }
      />

      <h1 className="mt-5 text-xl font-bold text-gray-900">{c.name}</h1>
      {c.companyName ? <p className="mt-0.5 text-gray-600">{c.companyName}</p> : null}

      {/* Key facts */}
      <div className="mt-5 grid grid-cols-4 gap-4 rounded-md bg-gray-50 px-4 py-3 text-xs print:bg-gray-50">
        <Meta label={t("Type")} value={t(CLIENT_TYPE_LABEL[c.type])} />
        <Meta label={t("Status")} value={t(STATUS_LABEL[c.status])} />
        <Meta label={t("Primary Contact")} value={c.contactPerson || "—"} />
        <Meta label="TRN" value={c.taxNumber || "—"} />
        <Meta label={t("Email")} value={c.email || "—"} />
        <Meta label={t("Phone")} value={c.phone || "—"} />
        <Meta label={t("Website")} value={c.website || "—"} />
        <Meta label={t("Tags")} value={c.tags.length ? c.tags.join(", ") : "—"} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <Meta label={t("Lifetime Value (approved)")} value={formatCurrency(lifetime, currency)} />
        <Meta label={t("Open Pipeline")} value={formatCurrency(pipeline, currency)} />
      </div>

      {c.notes ? (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-400">{t("Notes")}</div>
          <p className="mt-0.5 whitespace-pre-wrap text-gray-700">{c.notes}</p>
        </div>
      ) : null}

      {/* Addresses */}
      {c.addresses.length ? (
        <>
          <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Addresses")}</h2>
          <table className="mt-2 w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-semibold">{t("Label")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Address")}</th>
                <th className="py-2 pr-3 font-semibold">{t("City")}</th>
                <th className="py-2 font-semibold">{t("Country")}</th>
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
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Proposals")}</h2>
      <table className="mt-2 w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-3 font-semibold">{t("Ref")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Title")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Status")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Date")}</th>
            <th className="py-2 text-right font-semibold">{t("Value")}</th>
          </tr>
        </thead>
        <tbody>
          {c.proposals.length ? (
            c.proposals.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 font-mono text-[10px] text-gray-600">{p.ref}</td>
                <td className="py-1.5 pr-3 text-gray-900">{p.title}</td>
                <td className="py-1.5 pr-3 text-gray-600">{t(PROPOSAL_STATUS_LABEL[p.status] ?? p.status)}</td>
                <td className="py-1.5 pr-3 text-gray-600">{formatDate(p.date)}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">{formatCurrency(p.value, currency)}</td>
              </tr>
            ))
          ) : (
            <tr><td className="py-3 text-gray-400" colSpan={5}>{t("No proposals.")}</td></tr>
          )}
        </tbody>
      </table>

      {/* Projects */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Projects")}</h2>
      <table className="mt-2 w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-3 font-semibold">{t("No.")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Name")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Manager")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Status")}</th>
            <th className="py-2 text-right font-semibold">{t("Progress")}</th>
          </tr>
        </thead>
        <tbody>
          {c.projects.length ? (
            c.projects.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 font-mono text-[10px] text-gray-600">{p.number}</td>
                <td className="py-1.5 pr-3 text-gray-900">{p.name}</td>
                <td className="py-1.5 pr-3 text-gray-600">{p.manager}</td>
                <td className="py-1.5 pr-3 text-gray-600">{PROJECT_STATUS_LABEL[p.status] ? t(PROJECT_STATUS_LABEL[p.status]) : p.status}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">{p.progressPct}%</td>
              </tr>
            ))
          ) : (
            <tr><td className="py-3 text-gray-400" colSpan={5}>{t("No projects.")}</td></tr>
          )}
        </tbody>
      </table>

      <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {companyName} · {c.name} · {t("Client Profile")} · {fmt(t("Generated {date}"), { date: formatDate(new Date()) })}
      </div>
    </PrintSurface>
  );
}
