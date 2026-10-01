import type { Metadata } from "next";
import Link from "next/link";
import { Clause, ContactLink, LegalDocument, Points } from "@/components/legal/legal-document";
import { getServerT } from "@/lib/i18n/server";
import { LEGAL, LEGAL_PATHS, TERMS_VERSION } from "@/lib/legal/policy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Terms of Service")} · AEC-flow` };
}

export default async function TermsPage() {
  const { operator, product, companySite } = LEGAL;
  return (
    <LegalDocument
      title="Terms of Service"
      version={TERMS_VERSION}
      intro={
        <p>
          These are beta terms. {product} is pre-release software, offered free to practices
          that join the beta while we build it. The operating legal entity and governing law
          will be finalised before general release, and everyone using {product} will be told
          before anything material changes.
        </p>
      }
    >
      <Clause id="service" title="1. The service">
        <p>
          {product} is a web platform for architecture, engineering and construction practices:
          service proposals, estimates, schedules, projects, building permits, drawings, general
          documents, contracts, finance and the office work around them. It is made by{" "}
          {operator}, the company behind{" "}
          <a href={companySite} className="font-medium text-brand hover:underline">
            cad-flow.com
          </a>
          . By creating an account, accepting an invitation or using {product}, you agree to these
          terms and to the way we handle data described in the{" "}
          <Link href={LEGAL_PATHS.privacy} className="font-medium text-brand hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          These terms cover {product} at aec-flow.com and beta.aec-flow.com. {operator}’s
          other products, such as CADBlockStudio, have their own terms on cad-flow.com.
        </p>
      </Clause>

      <Clause id="accounts" title="2. Your firm's workspace and accounts">
        <p>
          Signing up creates a workspace for your practice, and the person who signs up becomes
          its owner. The owner, and anyone the owner makes a Director or Administrator, decides
          who is invited, what role each person has, and who can see what. Everyone who uses the
          workspace must have their own account; don’t share a sign-in.
        </p>
        <p>
          You are responsible for keeping your password safe and for what happens under your
          account. Tell us promptly at <ContactLink /> if you think an account has been
          compromised.
        </p>
      </Clause>

      <Clause id="beta" title="3. Your beta access">
        <p>
          While the beta runs, we give your practice free access to {product} for the period
          shown when you signed up. Because this is beta software, we may add, change or remove
          features, and the service may occasionally be interrupted. We may end the beta with
          reasonable notice.
        </p>
        <p>
          The beta comes with one ask: tell us what is broken and what you wish it did, through
          the Feedback button in the app. We may use feedback you send to improve {product},
          without owing you anything for it.
        </p>
      </Clause>

      <Clause id="content" title="4. Your content stays yours">
        <p>
          Everything your practice puts into {product} — projects, clients, proposals, estimates,
          drawings, letters, contracts, invoices and the files you upload — remains yours. You
          give us permission to store, process, copy and display it only as far as we need to
          run {product} for you, keep it backed up and fix problems.
        </p>
        <p>
          Your workspace is kept separate from every other practice’s. We don’t sell
          your content, and we don’t use it to build products for anyone else.
        </p>
        <p>
          You are responsible for having the right to put that content into {product},
          including the personal details of your clients, contractors and contacts. For that
          information your practice decides what is collected and why; we handle it on your
          behalf, as described in the Privacy Policy.
        </p>
      </Clause>

      <Clause id="professional" title="5. Your professional judgement">
        <p>
          {product} helps you work; it does not replace the professional responsibility of the
          people using it. You are responsible for checking anything it produces before you rely
          on it or send it to anyone, including:
        </p>
        <Points>
          <li>estimate totals, schedules, fees, invoices and profitability figures;</li>
          <li>
            contracts, letters and other documents, including those filled in or drafted with
            AI — they are not legal advice, and a contract should be reviewed by someone qualified
            before it is signed;
          </li>
          <li>sheet sizes and drawing types detected from uploaded drawings;</li>
          <li>summaries of a permit’s history and any other AI-written text.</li>
        </Points>
      </Clause>

      <Clause id="ai" title="6. AI features">
        <p>
          Some features use an AI model to draft or summarise text. When you use one, the
          information that feature needs is sent to our AI provider, Anthropic, to produce the
          result; the Privacy Policy lists what each feature sends. AI output can be wrong or
          incomplete. If your practice enters its own AI key in Settings, those requests are
          also covered by your agreement with that provider.
        </p>
      </Clause>

      <Clause id="use" title="7. Acceptable use">
        <p>You agree not to:</p>
        <Points>
          <li>try to reach another practice’s data, or get round roles, seats or access controls;</li>
          <li>probe, overload or break the service, or reverse-engineer it;</li>
          <li>upload malware, or content you have no right to share;</li>
          <li>use {product} for anything unlawful, or to send unsolicited bulk email;</li>
          <li>resell or give access to {product} to people outside your practice without our agreement.</li>
        </Points>
      </Clause>

      <Clause id="ours" title="8. What stays ours">
        <p>
          The {product} software, its design and the {operator} and {product} names remain our
          property. Using {product} gives you no rights in them beyond using the service under
          these terms.
        </p>
      </Clause>

      <Clause id="paid" title="9. Paid plans">
        <p>
          The beta is free. When paid plans launch, we will publish the prices and tell you in
          advance. Nothing will be charged to your practice unless you choose a paid plan.
        </p>
      </Clause>

      <Clause id="warranty" title="10. No warranty">
        <p>
          During the beta, {product} is provided “as is” and “as available”,
          without warranties of any kind. We work hard to keep it accurate and available, but we
          don’t promise that it will be uninterrupted or error-free.
        </p>
      </Clause>

      <Clause id="liability" title="11. Limitation of liability">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential loss,
          lost profit, or lost data arising from using, or being unable to use, the beta. Nothing
          in these terms limits any liability that cannot legally be limited.
        </p>
      </Clause>

      <Clause id="ending" title="12. Ending your use">
        <p>
          You can stop using {product} at any time. To close your account, or your
          practice’s whole workspace, email <ContactLink /> from the address on the account;
          an owner or Director must ask for a workspace to be closed. Before you go, you can
          export clients, projects, proposals, orders, team and leave as CSV from Exports, and
          print or save your documents; ask us if you need anything else.
        </p>
        <p>
          We may suspend or end access if these terms are broken, or when the beta ends. Unless
          the account is being misused, we will give notice first and a chance to take your data
          with you.
        </p>
      </Clause>

      <Clause id="changes" title="13. Changes to these terms">
        <p>
          We may update these terms as {product} moves toward general release. The date at the
          top shows the current version. We will tell you about material changes before they
          take effect, and may ask you to accept the new version to keep using {product}.
        </p>
      </Clause>

      <Clause id="contact" title="14. Contact">
        <p>
          Questions about these terms? Email <ContactLink />.
        </p>
      </Clause>
    </LegalDocument>
  );
}
