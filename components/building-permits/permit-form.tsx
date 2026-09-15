"use client";

/**
 * The permit case-file form — create and edit, one component.
 *
 * Controlled state and a transition, like components/design/deliverable-form.tsx:
 * the repo has no form library convention on this screen and no date picker, so
 * every date is a native `<input type="date">`, which is also the only control
 * that hands the zod gate the `YYYY-MM-DD` it asks for.
 *
 * NOTHING is validated here. The schema already words every rule (a decision
 * cannot predate the submission, a status that claims more than its dates do);
 * re-wording those in the browser is how two copies of the same rule drift, and
 * the browser's copy is the one that cannot be trusted anyway. The server's
 * message is shown verbatim.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { currencyOptions, getSystemCurrency } from "@/lib/format";
import {
  PERMIT_STATUSES,
  PERMIT_STATUS_LABEL,
  PERMIT_TYPES,
  PERMIT_TYPE_LABEL,
  type BuildingPermitDTO,
  type BuildingPermitInput,
  type BuildingPermitStatus,
  type BuildingPermitType,
} from "@/lib/building-permits/types";
import {
  createPermitAction,
  updatePermitAction,
} from "@/app/(app)/design/building-permits/actions";

/** Offered alongside the practice's System Currency, which always leads the list. */
const OTHER_CURRENCIES = ["AWG", "USD", "ANG", "EUR"];

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const area = `${field} h-auto py-2`;
const label = "mb-1 block text-xs font-medium text-muted";

/** Empty means "not recorded", which is null — never the empty string. */
function text(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/** Empty means "not recorded". A number input cannot produce anything else. */
function number(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function PermitForm({
  mode,
  initial,
}: {
  mode: "new" | "edit";
  initial?: BuildingPermitDTO;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Identification
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [permitNumber, setPermitNumber] = useState(initial?.permitNumber ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [permitType, setPermitType] = useState<BuildingPermitType>(
    initial?.permitType ?? "NEW_BUILD",
  );
  const [status, setStatus] = useState<BuildingPermitStatus>(initial?.status ?? "DRAFT");
  const [description, setDescription] = useState(initial?.description ?? "");

  // Property
  const [applicantName, setApplicantName] = useState(initial?.applicantName ?? "");
  const [siteAddress, setSiteAddress] = useState(initial?.siteAddress ?? "");
  const [parcelNumber, setParcelNumber] = useState(initial?.parcelNumber ?? "");
  const [landRegistry, setLandRegistry] = useState(initial?.landRegistry ?? "");
  const [lotAreaM2, setLotAreaM2] = useState(initial?.lotAreaM2?.toString() ?? "");
  const [builtAreaM2, setBuiltAreaM2] = useState(initial?.builtAreaM2?.toString() ?? "");

  // Authority
  const [authority, setAuthority] = useState(initial?.authority ?? "");
  const [authorityContact, setAuthorityContact] = useState(initial?.authorityContact ?? "");
  const [authorityEmail, setAuthorityEmail] = useState(initial?.authorityEmail ?? "");

  // Dates
  const [submittedAt, setSubmittedAt] = useState(initial?.submittedAt ?? "");
  const [acknowledgedAt, setAcknowledgedAt] = useState(initial?.acknowledgedAt ?? "");
  const [conceptApprovalAt, setConceptApprovalAt] = useState(initial?.conceptApprovalAt ?? "");
  const [conceptApprovalRef, setConceptApprovalRef] = useState(initial?.conceptApprovalRef ?? "");
  const [decisionAt, setDecisionAt] = useState(initial?.decisionAt ?? "");
  const [issuedAt, setIssuedAt] = useState(initial?.issuedAt ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? "");
  const [targetDecisionAt, setTargetDecisionAt] = useState(initial?.targetDecisionAt ?? "");

  // Money
  const [estimatedValue, setEstimatedValue] = useState(initial?.estimatedValue?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? getSystemCurrency());
  const [feeAmount, setFeeAmount] = useState(initial?.feeAmount?.toString() ?? "");
  const [feePaidAt, setFeePaidAt] = useState(initial?.feePaidAt ?? "");

  // Assignment & notes
  const [responsibleName, setResponsibleName] = useState(initial?.responsibleName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: BuildingPermitInput = {
      // Blank means "assign the next reference in the practice sequence", which
      // is `undefined` and not "" — the empty string would be a reference.
      reference: reference.trim() || undefined,
      permitNumber: text(permitNumber),
      title,
      permitType,
      status,
      description: text(description),

      // The update replaces the whole record, so the links this form does not
      // edit are carried through. Dropping them would silently unfile a permit
      // from its project the first time someone corrected a typo in the title.
      projectId: initial?.projectId ?? null,
      projectName: initial?.projectName ?? null,
      clientId: initial?.clientId ?? null,
      clientName: initial?.clientName ?? null,
      responsibleId: initial?.responsibleId ?? null,

      applicantName: text(applicantName),
      siteAddress: text(siteAddress),
      parcelNumber: text(parcelNumber),
      landRegistry: text(landRegistry),

      authority: text(authority),
      authorityContact: text(authorityContact),
      authorityEmail: text(authorityEmail),

      lotAreaM2: number(lotAreaM2),
      builtAreaM2: number(builtAreaM2),
      estimatedValue: number(estimatedValue),
      currency: currency.trim() || undefined,

      submittedAt: text(submittedAt),
      acknowledgedAt: text(acknowledgedAt),
      conceptApprovalAt: text(conceptApprovalAt),
      conceptApprovalRef: text(conceptApprovalRef),
      decisionAt: text(decisionAt),
      issuedAt: text(issuedAt),
      expiresAt: text(expiresAt),
      targetDecisionAt: text(targetDecisionAt),

      feeAmount: number(feeAmount),
      feePaidAt: text(feePaidAt),

      responsibleName: text(responsibleName),
      notes: text(notes),
    };

    start(async () => {
      const res =
        mode === "edit" && initial
          ? await updatePermitAction(initial.id, input)
          : await createPermitAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/design/building-permits/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title="Identification" subtitle="What this file is, and what the authority calls it." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Our reference</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={`${field} font-mono`}
              placeholder="Leave blank for the next reference"
            />
          </div>
          <div>
            <label className={label}>Authority&rsquo;s permit number</label>
            <input
              value={permitNumber}
              onChange={(e) => setPermitNumber(e.target.value)}
              className={`${field} font-mono`}
              placeholder="Request number"
            />
          </div>
          <div>
            <label className={label}>Permit type</label>
            <select
              value={permitType}
              onChange={(e) => setPermitType(e.target.value as BuildingPermitType)}
              className={field}
            >
              {PERMIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PERMIT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={field}
              placeholder="Two-storey residence, Sabana Blanco"
            />
          </div>
          <div>
            <label className={label}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BuildingPermitStatus)}
              className={field}
            >
              {PERMIT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PERMIT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Scope of works</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={area}
              placeholder="What is being applied for, in the words the application uses."
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Property" subtitle="The parcel the application is filed against." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Applicant</label>
            <input
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className={field}
              placeholder="Filed in the name of"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Site address</label>
            <input
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Parcel number</label>
            <input
              value={parcelNumber}
              onChange={(e) => setParcelNumber(e.target.value)}
              className={`${field} font-mono`}
              placeholder="Meetbrief / cadastral"
            />
          </div>
          <div>
            <label className={label}>Land registry</label>
            <input
              value={landRegistry}
              onChange={(e) => setLandRegistry(e.target.value)}
              className={field}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Lot area (m²)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={lotAreaM2}
                onChange={(e) => setLotAreaM2(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Built area (m²)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={builtAreaM2}
                onChange={(e) => setBuiltAreaM2(e.target.value)}
                className={field}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Authority" subtitle="Who is deciding, and who to chase." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Authority</label>
            <input
              value={authority}
              onChange={(e) => setAuthority(e.target.value)}
              className={field}
              placeholder="DOW / Public Works"
            />
          </div>
          <div>
            <label className={label}>Contact</label>
            <input
              value={authorityContact}
              onChange={(e) => setAuthorityContact(e.target.value)}
              className={field}
              placeholder="Case officer"
            />
          </div>
          <div>
            <label className={label}>Email</label>
            <input
              type="email"
              value={authorityEmail}
              onChange={(e) => setAuthorityEmail(e.target.value)}
              className={field}
              placeholder="name@authority.aw"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Dates"
          subtitle="The milestones the case file is read for. Leave a date empty until it has happened."
        />
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className={label}>Submittal date</label>
            <input type="date" value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Acknowledged</label>
            <input type="date" value={acknowledgedAt} onChange={(e) => setAcknowledgedAt(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Concept approval</label>
            <input type="date" value={conceptApprovalAt} onChange={(e) => setConceptApprovalAt(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Concept approval ref.</label>
            <input
              value={conceptApprovalRef}
              onChange={(e) => setConceptApprovalRef(e.target.value)}
              className={`${field} font-mono`}
            />
          </div>
          <div>
            <label className={label}>Decision</label>
            <input type="date" value={decisionAt} onChange={(e) => setDecisionAt(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Permit ready date</label>
            <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Expires</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Target decision</label>
            <input type="date" value={targetDecisionAt} onChange={(e) => setTargetDecisionAt(e.target.value)} className={field} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Money" subtitle="Declared value of the works and the authority's fee." />
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={label}>Estimated value</label>
            <input
              type="number"
              min={0}
              step="any"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
              {currencyOptions(OTHER_CURRENCIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div />
          <div className="sm:col-span-2">
            <label className={label}>Fee amount</label>
            <input
              type="number"
              min={0}
              step="any"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Fee paid</label>
            <input type="date" value={feePaidAt} onChange={(e) => setFeePaidAt(e.target.value)} className={field} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Assignment & notes" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Responsible</label>
            <input
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              className={field}
              placeholder="Who runs this file"
            />
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className={area}
            />
          </div>
        </CardBody>
      </Card>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Open permit file"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
