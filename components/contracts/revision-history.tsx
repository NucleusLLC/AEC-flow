/**
 * The versions of one contract, and what changed in the latest one.
 *
 * ─── A SERVER COMPONENT ON PURPOSE ──────────────────────────────────────────
 * The diff is computed on the server from two stored documents. Sending both
 * full contracts to the browser so it can subtract them would ship thirty pages
 * of legal text to render a dozen lines.
 *
 * ─── IT SHOWS THE CHANGE, NOT A DIFF VIEW ───────────────────────────────────
 * Two columns of coloured text is what a developer wants. What the person
 * signing wants is a sentence: the contract sum went from this to that, clause
 * 18 was reworded, one clause was added. Renumbering is reported as renumbering
 * rather than as a rewrite — inserting one clause moves thirty numbers, and a
 * list that calls all thirty "changed" is a list nobody reads twice.
 */
import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/contracts/types";
import { diffSummary, revisionLabel, type ContractDiff } from "@/lib/contracts/revision";
import { formatDate } from "@/lib/format";
import type { ContractSummaryDTO } from "@/lib/data/contracts";

export function RevisionHistory({
  family,
  currentId,
  diff,
  previousNumber,
}: {
  family: ContractSummaryDTO[];
  currentId: string;
  /** Against the version immediately before this one; null for the original. */
  diff: ContractDiff | null;
  previousNumber: string | null;
}) {
  if (family.length < 2) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Versions"
          subtitle="The agreement keeps its number; the revision letter says which version."
        />
        <CardBody>
          <ul className="divide-y divide-border/60">
            {family.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/documents/contracts/${v.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <GitBranch className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">
                        <span className="font-mono">{v.number}</span>
                        {v.id === currentId ? " · this one" : ""}
                      </span>
                      <span className="block truncate text-[11px] text-faint">
                        {revisionLabel(v.number)}
                        {v.issuedAt ? ` · issued ${formatDate(v.issuedAt.slice(0, 10))}` : ""}
                        {v.createdByName ? ` · ${v.createdByName}` : ""}
                      </span>
                    </span>
                  </span>
                  <Badge tone={CONTRACT_STATUS_TONE[v.status]}>
                    {CONTRACT_STATUS_LABEL[v.status]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {diff && previousNumber ? (
        <Card>
          <CardHeader
            title={`What changed since ${previousNumber}`}
            subtitle={diffSummary(diff)}
          />
          <CardBody className="space-y-4">
            {diff.identical ? (
              <p className="text-sm text-muted">
                Nothing differs between these two versions. That is worth knowing before anybody
                signs the second one.
              </p>
            ) : null}

            {diff.facts.length > 0 ? (
              <Section title="Particulars">
                {diff.facts.map((f) => (
                  <Row key={f.label} label={f.label} from={f.from} to={f.to} />
                ))}
              </Section>
            ) : null}

            {diff.schedule.length > 0 ? (
              <Section title="Payment schedule">
                {diff.schedule.map((f) => (
                  <Row key={f.label} label={f.label} from={f.from} to={f.to} />
                ))}
              </Section>
            ) : null}

            {diff.articles.length > 0 ? (
              <Section title="Clauses">
                {diff.articles.map((c, i) => (
                  <div key={`${c.kind}-${i}`} className="py-1.5 text-sm">
                    {c.kind === "added" ? (
                      <p className="text-fg">
                        <span className="font-medium text-green-700">Added</span> · {c.number}{" "}
                        {c.heading}
                      </p>
                    ) : null}
                    {c.kind === "removed" ? (
                      <p className="text-fg">
                        <span className="font-medium text-red-600">Removed</span> · {c.number}{" "}
                        {c.heading}
                      </p>
                    ) : null}
                    {c.kind === "renumbered" ? (
                      <p className="text-muted">
                        {c.heading} · now {c.to}, was {c.from}
                      </p>
                    ) : null}
                    {c.kind === "reworded" ? (
                      <div>
                        <p className="text-fg">
                          <span className="font-medium text-amber-700">Reworded</span> · {c.number}{" "}
                          {c.heading}
                          {c.renumberedFrom ? (
                            <span className="text-muted"> (was {c.renumberedFrom})</span>
                          ) : null}
                        </p>
                        {c.paragraphs.map((p, j) => (
                          <div key={j} className="mt-1 space-y-0.5 pl-4 text-[13px]">
                            <p className="text-muted line-through decoration-red-500/40">{p.from}</p>
                            <p className="text-fg">{p.to}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </Section>
            ) : null}

            {diff.unchanged > 0 ? (
              <p className="text-xs text-muted">
                {diff.unchanged} clause{diff.unchanged === 1 ? "" : "s"} came through unchanged.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-[11px] uppercase tracking-wide text-faint">{title}</h4>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

function Row({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-sm">
      <span className="min-w-[10rem] font-medium text-fg">{label}</span>
      <span className="text-muted line-through decoration-red-500/40">{from}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint" />
      <span className="font-medium text-fg">{to}</span>
    </div>
  );
}
