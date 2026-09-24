import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContractComposer } from "@/components/contracts/contract-composer";
import { listTemplates, practicePeople } from "@/lib/data/contracts";
import { getProjects } from "@/lib/data/projects";
import { getAnthropicKeyStatus } from "@/lib/server/ai-config";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { getSystemCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "New contract · AEC-flow" };

/**
 * Everything the composer needs is resolved here, on the server — including
 * whether an AI key exists, which the pre-flight checklist reports. The browser
 * is told that a key is configured, never what it is.
 */
export default async function NewContractPage() {
  const [projects, templates, people, keyStatus, practice, firm] = await Promise.all([
    getProjects(),
    listTemplates(),
    practicePeople(),
    getAnthropicKeyStatus(),
    getPracticeSettings(),
    getFirmIdentity(),
  ]);

  return (
    <div className="w-full space-y-4">
      <Link
        href="/documents/contracts"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Contracts
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">New construction contract</h2>
        <p className="text-sm text-muted">
          Your own contract, filled in with this job&apos;s particulars. The wording stays as it is.
        </p>
      </div>

      <ContractComposer
        projects={projects.map((p) => ({
          id: p.id,
          projectNumber: p.projectNumber,
          name: p.name,
          siteAddress: null,
        }))}
        templates={templates}
        people={people}
        practiceName={firm.name || practice.footer.text}
        hasAiKey={keyStatus.configured}
        hasLogo={Boolean(firm.logo?.dataUrl)}
        defaultCurrency={getSystemCurrency()}
      />
    </div>
  );
}
