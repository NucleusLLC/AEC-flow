import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, FolderOpen, Plus } from "lucide-react";
import { getProject } from "@/lib/data/projects";
import { listGeneralDocuments } from "@/lib/data/general-documents";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DocumentStatusBadge } from "@/components/general-documents/badges";
import { PermitStatusBadge } from "@/components/building-permits/badges";
import { listContracts } from "@/lib/data/contracts";
import { listBuildingPermits } from "@/lib/data/building-permits";
import { LinkExistingDocument } from "@/components/general-documents/project-link";
import { militaryDate } from "@/lib/building-permits/register";
import { getServerT } from "@/lib/i18n/server";

/**
 * A project's Documents tab: only this project's paperwork, never the practice
 * directory. The General Documents filed under it (POAs, notices, letters…)
 * with a way to start a new one already filed here and to file one written
 * without a project; then its construction contracts and building permit files.
 *
 * WAS A PLACEHOLDER that sent the user to the global Documents module.
 */
export default async function ProjectDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [t, all, contracts, permits] = await Promise.all([
    getServerT(),
    listGeneralDocuments(),
    listContracts(id),
    listBuildingPermits({ projectId: id }),
  ]);

  const filed = all.filter((d) => d.projectId === id);
  const unfiled = all
    .filter((d) => !d.projectId)
    .map((d) => ({
      id: d.id,
      name: `${d.number} · ${d.title}${d.clientName ? ` · ${d.clientName}` : ""}`,
    }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={t("General Documents")}
          subtitle={t("Letters, powers of attorney, notices and agreements filed under this project.")}
          action={
            <Link
              href={`/documents/general/new?project=${encodeURIComponent(id)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t("New document")}
            </Link>
          }
        />
        <CardBody>
          {filed.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FolderOpen className="h-8 w-8 text-faint" />
              <p className="mt-3 text-sm font-medium text-fg">
                {t("No General Documents filed under this project yet.")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="px-4 pb-1.5 font-medium">{t("Number")}</th>
                    <th className="px-3 pb-1.5 font-medium">{t("Document")}</th>
                    <th className="px-3 pb-1.5 font-medium">{t("Addressed to")}</th>
                    <th className="px-3 pb-1.5 font-medium">{t("Dated")}</th>
                    <th className="px-4 pb-1.5 font-medium">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filed.map((d) => (
                    <tr
                      key={d.id}
                      className="zebra-row border-b border-border/60 transition-colors last:border-0 zebra-hover"
                    >
                      <td className="px-4 py-2.5 align-top">
                        <Link
                          href={`/documents/general/${d.id}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-brand hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {d.number}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="truncate font-medium text-fg" title={d.title}>
                          {d.title}
                        </div>
                        <div className="truncate text-[11px] text-faint">{t(d.docTypeLabel)}</div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-muted">
                        <span className="truncate">{d.counterpartyName ?? d.clientName ?? "—"}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                        {militaryDate(d.issueDate)}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <DocumentStatusBadge status={d.status} />
                        {d.signedAt ? (
                          <div className="mt-1 font-mono text-[10px] text-faint">
                            {militaryDate(d.signedAt)}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("Construction contracts")}
          action={
            <Link href="/documents/contracts/new" className="text-sm font-medium text-brand hover:underline">
              {t("New contract")}
            </Link>
          }
        />
        <CardBody>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted">{t("No construction contracts for this project.")}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {contracts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                  <Link
                    href={`/documents/contracts/${c.id}`}
                    className="inline-flex min-w-0 items-center gap-1.5 font-medium text-brand hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono text-xs">{c.number}</span>
                    <span className="truncate text-fg">{c.contractorName}</span>
                  </Link>
                  <span className="flex items-center gap-3 font-mono text-xs text-muted">
                    {militaryDate(c.signedAt ?? c.issuedAt)}
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase">
                      {c.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("Building permits")}
          action={
            <Link href="/design/building-permits/new" className="text-sm font-medium text-brand hover:underline">
              {t("New permit file")}
            </Link>
          }
        />
        <CardBody>
          {permits.length === 0 ? (
            <p className="text-sm text-muted">{t("No building permit files for this project.")}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {permits.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                  <Link
                    href={`/design/building-permits/${p.id}`}
                    className="inline-flex min-w-0 items-center gap-1.5 font-medium text-brand hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono text-xs">{p.permitNumber ?? p.reference}</span>
                    <span className="truncate text-fg">{p.title}</span>
                  </Link>
                  <span className="flex items-center gap-3 font-mono text-xs text-muted">
                    {militaryDate(p.latestSubmissionAt)}
                    <PermitStatusBadge status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("Link an existing document")}
          subtitle={t("Written without a project? File it here. Signed documents can be filed too — the document itself is not altered.")}
        />
        <CardBody>
          <LinkExistingDocument projectId={id} documents={unfiled} />
        </CardBody>
      </Card>
    </div>
  );
}
