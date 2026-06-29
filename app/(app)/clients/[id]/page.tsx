import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  Hash,
  Plus,
  Pencil,
  FileText,
  FolderKanban,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ClientTypeBadge, ClientStatusBadge } from "@/components/clients/badges";
import { getClient, type ProposalStatus } from "@/lib/data/clients";
import { getActivityForClient } from "@/lib/data/activity";
import { formatCurrency, formatDate } from "@/lib/format";
import { initials } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  return { title: `${client?.name ?? "Client"} · AEC-flow` };
}

const proposalTone: Record<ProposalStatus, Parameters<typeof Badge>[0]["tone"]> = {
  DRAFT: "slate",
  SENT: "blue",
  PENDING: "amber",
  APPROVED: "green",
  ON_HOLD: "amber",
  REJECTED: "red",
  VOID: "slate",
};

function InfoRow({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
      <span className="min-w-0 break-words text-fg">{children}</span>
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const activity = await getActivityForClient(client.id);

  const lifetimeValue = client.proposals
    .filter((p) => p.status === "APPROVED")
    .reduce((n, p) => n + p.value, 0);
  const pipelineValue = client.proposals
    .filter((p) => ["DRAFT", "SENT", "PENDING", "ON_HOLD"].includes(p.status))
    .reduce((n, p) => n + p.value, 0);
  const activeProjects = client.projects.filter((p) => p.status === "ACTIVE").length;

  const metrics = [
    { label: "Open Pipeline", value: formatCurrency(pipelineValue) },
    { label: "Won to Date", value: formatCurrency(lifetimeValue) },
    { label: "Active Projects", value: `${activeProjects} of ${client.projects.length}` },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to clients
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-lg font-semibold text-brand">
            {initials(client.name)}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-fg">{client.name}</h2>
            {client.companyName ? (
              <p className="text-sm text-muted">{client.companyName}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ClientTypeBadge type={client.type} />
              <ClientStatusBadge status={client.status} />
              {client.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={`/print/clients/${client.id}`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            Print
          </a>
          <Link
            href={`/clients/${client.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <Link
            href="/proposals/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            New Proposal
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.label} className="p-5">
            <div className="text-sm text-muted">{m.label}</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-fg">{m.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Proposals */}
          <Card>
            <CardHeader
              title="Proposals"
              subtitle={`${client.proposals.length} total`}
              action={<FileText className="h-4 w-4 text-faint" />}
            />
            {client.proposals.length ? (
              <div className="divide-y divide-border">
                {client.proposals.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{p.ref}</span>
                        <Badge tone={proposalTone[p.status]}>
                          {p.status.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </div>
                      <div className="mt-0.5 truncate text-sm font-medium text-fg">{p.title}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium text-fg">{formatCurrency(p.value)}</div>
                      <div className="text-xs text-faint">{formatDate(p.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <CardBody className="text-sm text-muted">No proposals yet.</CardBody>
            )}
          </Card>

          {/* Projects */}
          <Card>
            <CardHeader
              title="Projects"
              subtitle={`${client.projects.length} total`}
              action={<FolderKanban className="h-4 w-4 text-faint" />}
            />
            {client.projects.length ? (
              <div className="divide-y divide-border">
                {client.projects.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{p.number}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-0.5 truncate text-sm font-medium text-fg">{p.name}</div>
                      <div className="truncate text-xs text-muted">{p.manager}</div>
                    </div>
                    <div className="hidden w-40 shrink-0 sm:block">
                      <div className="mb-1 text-right text-[11px] text-muted">{p.progressPct}%</div>
                      <ProgressBar value={p.progressPct} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <CardBody className="text-sm text-muted">No projects yet.</CardBody>
            )}
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title="Recent Activity" />
            <CardBody>
              {activity.length === 0 ? (
                <p className="text-sm text-muted">No recent activity.</p>
              ) : (
                <ol className="space-y-4">
                  {activity.map((entry) => (
                    <li key={entry.id} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand/70" />
                      <div className="min-w-0">
                        <p className="text-sm text-fg">
                          <span className="font-medium">{entry.actor}</span>{" "}
                          <span className="text-muted">{entry.action} {entry.entityType}</span>{" "}
                          {entry.href ? (
                            <Link href={entry.href} className="font-medium hover:text-brand hover:underline">
                              {entry.entityLabel}
                            </Link>
                          ) : (
                            <span className="font-medium">{entry.entityLabel}</span>
                          )}
                        </p>
                        <p className="text-xs text-faint">{entry.at}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="space-y-3">
              {client.email ? (
                <InfoRow icon={Mail}>
                  <a href={`mailto:${client.email}`} className="hover:text-brand">
                    {client.email}
                  </a>
                </InfoRow>
              ) : null}
              {client.phone ? <InfoRow icon={Phone}>{client.phone}</InfoRow> : null}
              {client.website ? (
                <InfoRow icon={Globe}>
                  <a
                    href={/^https?:\/\//i.test(client.website) ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand"
                  >
                    {client.website}
                  </a>
                </InfoRow>
              ) : null}
              {client.taxNumber ? (
                <InfoRow icon={Hash}>
                  <span className="text-muted">TRN</span> {client.taxNumber}
                </InfoRow>
              ) : null}
            </CardBody>
          </Card>

          {client.contacts.length ? (
            <Card>
              <CardHeader title="Key Contacts" />
              <div className="divide-y divide-border">
                {client.contacts.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                      {initials(p.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-fg">{p.name}</span>
                        {p.isPrimary ? <Badge tone="blue">primary</Badge> : null}
                      </div>
                      <div className="truncate text-xs text-muted">{p.role}</div>
                      {p.email ? (
                        <a href={`mailto:${p.email}`} className="truncate text-xs text-faint hover:text-brand">
                          {p.email}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Addresses" />
            <CardBody className="space-y-3">
              {client.addresses.map((a) => (
                <InfoRow key={a.label} icon={MapPin}>
                  <span className="block font-medium text-fg">
                    {a.label}
                    {a.isPrimary ? <span className="ml-1.5 text-xs text-faint">· primary</span> : null}
                  </span>
                  <span className="text-muted">
                    {[a.line1, a.city, a.emirate, a.country].filter(Boolean).join(", ")}
                  </span>
                </InfoRow>
              ))}
            </CardBody>
          </Card>

          {client.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <CardBody className="text-sm text-muted">{client.notes}</CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
