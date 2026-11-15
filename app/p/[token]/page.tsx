import type { Metadata } from "next";
import { CheckCircle2, Link2Off, XCircle } from "lucide-react";
import { translate } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import { companyOverride, runAsCompany } from "@/lib/server/request-company";
import { getFirmIdentity } from "@/lib/server/firm";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getServiceProposalIdentification } from "@/lib/data/service-proposals";
import { loadPublicAcceptance, resolveAcceptanceToken } from "@/lib/data/proposal-acceptance";
import {
  LINK_INVALID_MESSAGE,
  isWellFormedAcceptanceToken,
  proposalLanguage,
} from "@/lib/proposals/acceptance";
import { ServiceProposalDocument } from "@/components/print/service-proposal-document";
import { ClientDecisionForm } from "@/components/service-proposals/client-decision-form";

// Live state, per request — never prerendered or cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Service Proposal · AEC-flow",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** "2026-11-14 09:30 UTC". */
function stamp(iso: string | null): string {
  return iso ? `${iso.slice(0, 16).replace("T", " ")} UTC` : "—";
}

/**
 * /p/<token> — a practice's client reads a Service Proposal and accepts or declines it.
 * PUBLIC (proxy.ts): the client has no AEC-flow account and never sees a login page.
 *
 * The token is the only key (lib/proposals/acceptance.ts). The first lookup is a raw query
 * by its hash that returns only the link id and company (lib/data/proposal-acceptance.ts);
 * the company is then fixed for the rest of this render with `companyOverride()` BEFORE any
 * scoped query, so every read below is that practice's — the /pay/<token> pattern.
 *
 * WHAT IS SHOWN is the client document itself (components/print/service-proposal-document.tsx,
 * the same renderer as the print route): client-safe fields only, every figure from the fee
 * engine. Nothing about the link's creator, other proposals or internal notes.
 *
 * ONE DEAD-LINK PAGE. A malformed, unknown, expired, revoked or superseded link all render
 * the same English page — the visitor cannot tell a guess from a link that once worked.
 */
export default async function ProposalAcceptancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hit = isWellFormedAcceptanceToken(token) ? await resolveAcceptanceToken(token) : null;
  if (!hit) return <InvalidLink />;
  companyOverride().companyId = hit.companyId;

  // Every read for this page happens HERE, inside the link's company (runAsCompany), and
  // the document below is handed the results. Relying on the per-request override alone
  // proved unsafe: in a dev RSC re-render the document's own reads ran as "no company".
  const loaded = await runAsCompany(hit.companyId, async () => {
    const view = await loadPublicAcceptance(hit.linkId);
    if (view.state === "invalid" || !view.proposal) return null;
    const [identification, settings, firm] = await Promise.all([
      getServiceProposalIdentification(view.proposal),
      getPracticeSettings(),
      getFirmIdentity(),
    ]);
    return { view, identification, settings, firmName: firm.name };
  });
  if (!loaded) return <InvalidLink />;
  const { view, identification, settings } = loaded;
  const p = view.proposal!;
  const firm = { name: loaded.firmName };

  // The proposal's language, not the viewer's cookie (lib/proposals/acceptance.ts).
  const lang = proposalLanguage(p.input.languageCode);
  const t = (s: string) => translate(lang, s);

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-3xl px-4 pt-8 print:hidden">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{firm.name}</p>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">
            {t("Service Proposal")} <span className="font-mono">{p.number}</span>
          </h1>
          <p className="text-sm text-gray-600">
            {p.title}
            {view.versionLabel ? ` · ${fmt(t("Version {version}"), { version: view.versionLabel })}` : ""}
          </p>

          {view.state === "decided" ? (
            <DecisionBanner
              accepted={view.decision === "ACCEPTED"}
              text={
                view.decision === "ACCEPTED"
                  ? fmt(t("Accepted by {name} on {date}."), {
                      name: [view.signerName, view.signerTitle, view.signerCompany].filter(Boolean).join(", "),
                      date: stamp(view.decidedAt),
                    })
                  : view.signerName
                    ? fmt(t("Declined by {name} on {date}."), { name: view.signerName, date: stamp(view.decidedAt) })
                    : fmt(t("Declined on {date}."), { date: stamp(view.decidedAt) })
              }
              note={fmt(t("Your answer has been recorded and passed to {practice}."), { practice: firm.name })}
            />
          ) : (
            <p className="mt-4 text-sm text-gray-700">
              {t("Please review the proposal below. You can accept or decline it at the end of this page.")}{" "}
              <a href="#respond" className="font-medium text-gray-900 underline">
                {t("Go to the acceptance form")}
              </a>
            </p>
          )}
        </div>
      </div>

      <ServiceProposalDocument
        p={p}
        preloaded={{ identification, context: { settings, firmName: firm.name, t } }}
      />

      {view.state === "open" ? (
        <div id="respond" className="mx-auto max-w-3xl px-4 pb-16 print:hidden">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <ClientDecisionForm token={token} lang={lang} practiceName={firm.name} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DecisionBanner({ accepted, text, note }: { accepted: boolean; text: string; note: string }) {
  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        accepted ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-gray-300 bg-gray-50 text-gray-900"
      }`}
    >
      {accepted ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        <div className="font-medium">{text}</div>
        <div className="text-xs opacity-80">{note}</div>
      </div>
    </div>
  );
}

/** The single page for every link that does not work. English, whatever the link was. */
function InvalidLink() {
  const t = (s: string) => translate("en", s);
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <Link2Off className="mx-auto h-8 w-8 text-gray-400" />
        <h1 className="mt-3 text-lg font-semibold text-gray-900">{t(LINK_INVALID_MESSAGE)}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {t(
            "The link may have expired or been replaced by a newer one, or the proposal may have changed. Please ask the practice that sent it to you for a new link.",
          )}
        </p>
      </div>
    </main>
  );
}
