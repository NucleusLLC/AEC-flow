import type { Metadata } from "next";
import Link from "next/link";
import { Clause, ContactLink, LegalDocument, Points } from "@/components/legal/legal-document";
import { getServerT } from "@/lib/i18n/server";
import { LEGAL, LEGAL_PATHS, PRIVACY_VERSION } from "@/lib/legal/policy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Privacy Policy")} · AEC-flow` };
}

/*
 * Every statement here was checked against the code on 1 Oct 2026. When a
 * feature starts sending data somewhere new, storing something new about a
 * person, or setting a new cookie, this page has to change with it — and
 * PRIVACY_VERSION in lib/legal/policy.ts with it.
 */
export default async function PrivacyPage() {
  const { operator, product } = LEGAL;
  return (
    <LegalDocument
      title="Privacy Policy"
      version={PRIVACY_VERSION}
      intro={
        <p>
          This policy describes how {product} actually handles data during the beta. No selling
          your information, no advertising trackers. The operating legal entity and governing
          law will be finalised before general release, and everyone using {product} will be told
          before anything material changes.
        </p>
      }
    >
      <Clause id="who" title="Who we are">
        <p>
          {product} is made by {operator} (“we”, “us”). This policy covers
          aec-flow.com and beta.aec-flow.com. {operator}’s other products publish their own
          policies on cad-flow.com. If anything here is unclear, email <ContactLink /> and a
          person will answer.
        </p>
      </Clause>

      <Clause id="roles" title="Two kinds of data">
        <p>
          <strong>Your account.</strong> Your name, email and how you use {product}. We decide how
          this is handled, and this policy explains it.
        </p>
        <p>
          <strong>What your practice puts in.</strong> Clients, contacts, contractors, projects,
          drawings, letters, contracts and invoices often contain other people’s personal
          details. Your practice decides what is collected and why; we store and process it on
          your practice’s behalf and for no other purpose. If you are one of those people
          and want to see or change what a practice holds about you, contact that practice
          first — we will help it answer you.
        </p>
      </Clause>

      <Clause id="collect" title="What we collect">
        <Points>
          <li>
            <strong>Account details</strong> — name, email, role, your practice’s name, and
            your password, stored only as a one-way hash we cannot read back.
          </li>
          <li>
            <strong>Sign-up record</strong> — when you sign up for the beta: the time, the access
            code you used, your IP address, the country it resolves to, and your browser’s
            description of itself, so we can tell where beta users come from and spot abuse.
          </li>
          <li>
            <strong>Agreement record</strong> — when you accepted these terms and this policy,
            and which versions.
          </li>
          <li>
            <strong>Security records</strong> — to limit password guessing and code guessing, we
            count recent attempts per IP address and per email address; these counters are
            removed after about a day. A password-reset or email-confirmation link records the IP
            address that asked for it and the one that used it.
          </li>
          <li>
            <strong>Your practice’s work</strong> — everything you enter or upload, including
            drawings and letters, and the activity record the app keeps of changes.
          </li>
          <li>
            <strong>Email you send from {product}</strong> — when you email a document from the
            app, we keep a record for your practice of who it went to, the subject and the
            message, so you can see what was sent. Attachments are not kept.
          </li>
          <li>
            <strong>Feedback</strong> — when you use the Feedback button: your message, the page
            you were on, your browser’s description, and the screenshot if you attach one.
          </li>
        </Points>
      </Clause>

      <Clause id="dont" title="What we don't do">
        <Points>
          <li>We don’t sell or rent personal information to anyone.</li>
          <li>We don’t run advertising, analytics or tracking scripts in {product}.</li>
          <li>We don’t use your practice’s data to train AI models, or let our AI provider do so.</li>
          <li>We don’t look at your practice’s data except to support you or fix a problem.</li>
        </Points>
      </Clause>

      <Clause id="processors" title="Who processes data for us">
        <p>We use a small number of providers, each only for the job described:</p>
        <Points>
          <li>
            <strong>Supabase</strong> — the database and private file storage where all{" "}
            {product} data lives, in the United States (US West). Files are never public; each
            download uses a link that expires within minutes.
          </li>
          <li>
            <strong>Vercel</strong> — hosts and runs the {product} application.
          </li>
          <li>
            <strong>Resend</strong> — delivers email: invitations, password resets, email
            confirmation, and documents you choose to email.
          </li>
          <li>
            <strong>Anthropic</strong> — the AI model behind the AI features, used only when one
            of them runs (see below). Anthropic does not train its models on this data.
          </li>
          <li>
            <strong>Nucleus</strong> — our own licensing service. Where licence checking is
            switched on, for a workspace that signed up with a personal beta code, the app checks
            the licence at most once an hour, sending the code, the app version and the IP address
            of the person using it.
          </li>
        </Points>
        <p>
          When you choose to email something through Gmail or Outlook on the web, your browser
          opens that service with the message filled in; what happens there is between you and
          that provider.
        </p>
      </Clause>

      <Clause id="ai" title="AI features and what they send">
        <p>Nothing is sent to the AI provider unless one of these runs:</p>
        <Points>
          <li>
            <strong>Write with AI</strong> (General Documents) — the summary you type and the
            details of the letter: your practice, the client, the project, the recipient, subject,
            reference and date.
          </li>
          <li>
            <strong>Construction Contract Generator</strong> — your contract template PDF and the
            contract particulars: the parties’ names, addresses and contact details, the
            project, the sum, dates and payment stages.
          </li>
          <li>
            <strong>Permit process summary</strong> — the permit’s history: authority,
            site, applicant, dates, meeting decisions, letter summaries and open actions.
          </li>
          <li>
            <strong>Drawing sheet detection</strong> — when an uploaded drawing’s type
            can’t be read reliably from its title block, up to 1,200 characters of that title
            block text, which can include project and client names.
          </li>
          <li>
            <strong>Estimates wiki</strong> — the topic you ask about.
          </li>
        </Points>
      </Clause>

      <Clause id="cookies" title="Cookies and storage in your browser">
        <p>{product} uses only what it needs to work. There is no cookie banner because there are no tracking cookies.</p>
        <Points>
          <li>
            <strong>Sign-in cookies</strong> — keep you signed in and protect forms against
            cross-site requests.
          </li>
          <li>
            <strong>
              <code>lang</code> and <code>aecflow_module</code>
            </strong>{" "}
            — remember your language and which module you were in, for a year.
          </li>
          <li>
            <strong>Browser storage</strong> — your theme, language and widget settings, and on
            some screens your working state, such as an estimate draft or the notes, tasks and
            layout of a project dashboard. This stays in that browser on that device; clearing the
            site’s data removes it.
          </li>
        </Points>
      </Clause>

      <Clause id="security" title="How we protect it">
        <Points>
          <li>Each practice’s workspace is isolated from every other in the application itself.</li>
          <li>The database is closed to direct public access; only the application can reach it.</li>
          <li>Passwords are hashed; sign-in and reset attempts are rate-limited; changing a password signs out every other session.</li>
          <li>All traffic is encrypted in transit.</li>
        </Points>
      </Clause>

      <Clause id="retention" title="How long we keep it">
        <p>
          We keep your account and your practice’s data for as long as the account or
          workspace is active. Attempt counters are cleared after about a day. If you ask us to
          close an account or a workspace, we delete the personal data in it within 30 days,
          except where we must keep limited records by law; copies in our provider’s
          backups expire on their own schedule after that.
        </p>
      </Clause>

      <Clause id="rights" title="Your choices and rights">
        <p>
          You can change your name and password yourself under Account. To see the personal data
          we hold about you, correct it, have it deleted, or get a copy, email <ContactLink /> from
          the address on your account. If you are in a country with data-protection law, such as
          the EU or UK, you may also complain to your data-protection authority; we would rather
          you came to us first.
        </p>
      </Clause>

      <Clause id="transfers" title="Where your data is">
        <p>
          {product}’s data is stored in the United States. If you use {product} from
          elsewhere, your data is transferred there, and our providers process it under their own
          data-protection commitments.
        </p>
      </Clause>

      <Clause id="children" title="Children">
        <p>{product} is a tool for professional practices and is not meant for anyone under 16.</p>
      </Clause>

      <Clause id="payments" title="Payments">
        <p>
          The beta is free, so we take no payment details. Before paid plans launch, this policy
          will be updated to name the payment provider; we won’t store full card numbers
          ourselves.
        </p>
      </Clause>

      <Clause id="changes" title="Changes to this policy">
        <p>
          If we change how we handle data, we will update this page and, for anything material,
          tell you before it takes effect. The date at the top always shows the current version.
          See also the{" "}
          <Link href={LEGAL_PATHS.terms} className="font-medium text-brand hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </Clause>

      <Clause id="contact" title="Contact">
        <p>
          Questions about your data, or want it removed? Email <ContactLink />. It reaches the same
          small team that builds {product}.
        </p>
      </Clause>
    </LegalDocument>
  );
}
