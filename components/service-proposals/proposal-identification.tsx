/**
 * The project / client identification block that opens a Service Proposal — the standard
 * "who is this for, and where is the work" section an AEC fee proposal starts with.
 *
 * Presentational only. Every sourcing decision is made by
 * lib/proposals/identification.resolveProposalIdentification, and rows with no value never
 * reach here — so neither variant can print an empty labelled row.
 *
 * Two variants because the two surfaces use different type scales: the print document uses
 * the document tokens (11px, gray ramp) shared with the rest of app/print, the in-app view
 * uses the application tokens (text-fg / text-muted). The CONTENT is identical, so what is on
 * screen matches what prints.
 *
 * This describes the CLIENT. The firm's own identity is the letterhead's job
 * (components/print/document-letterhead.tsx) and is deliberately not touched here.
 */
import { Fragment } from "react";
import type { IdentificationRow, ProposalIdentification } from "@/lib/proposals/identification";

type Translate = (text: string) => string;
const identity: Translate = (text) => text;

function PrintColumn({ rows, t }: { rows: IdentificationRow[]; t: Translate }) {
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1">
      {rows.map((r) => (
        <Fragment key={r.label}>
          <dt className="text-gray-500">{t(r.label)}</dt>
          <dd className="font-medium text-gray-900">{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** Document variant — drop inside a `PrintSection`. Renders nothing when there is no data. */
/** `t` translates the row labels (the print route passes the server translator). */
export function ProposalIdentificationPrint({
  identification,
  t = identity,
}: {
  identification: ProposalIdentification;
  t?: Translate;
}) {
  if (!identification.hasAny) return null;
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[11px]">
      <PrintColumn rows={identification.project} t={t} />
      <PrintColumn rows={identification.client} t={t} />
    </div>
  );
}

function AppColumn({ rows, t }: { rows: IdentificationRow[]; t: Translate }) {
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map((r) => (
        <Fragment key={r.label}>
          <dt className="text-muted">{t(r.label)}</dt>
          <dd className="font-medium text-fg">{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** In-app variant — drop inside a `CardBody`. Renders nothing when there is no data. */
export function ProposalIdentificationDetail({
  identification,
  t = identity,
}: {
  identification: ProposalIdentification;
  t?: Translate;
}) {
  if (!identification.hasAny) return null;
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <AppColumn rows={identification.project} t={t} />
      <AppColumn rows={identification.client} t={t} />
    </div>
  );
}
