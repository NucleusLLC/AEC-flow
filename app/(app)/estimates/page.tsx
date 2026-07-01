import { EstimatesApp } from "@/components/estimates/estimates-app";
import { getEstimate, getEstimateProjects } from "@/lib/data/estimates";
import { getPriceBook } from "@/lib/data/price-lists";
import { getNormSet } from "@/lib/data/norm-set";
import { getGeneralConditions } from "@/lib/data/general-conditions-db";
import { getTemplates } from "@/lib/data/estimate-templates";
import { getWikiArticles } from "@/lib/data/estimating-wiki-db";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Cost Estimation · AEC-flow" };

export default async function EstimatesPage() {
  const [projects, baseEstimate, priceBook, normSet, generalConditions, templates, wiki, practice] = await Promise.all([
    getEstimateProjects(),
    getEstimate(),
    getPriceBook(),
    getNormSet(),
    getGeneralConditions(),
    getTemplates(),
    getWikiArticles(),
    getPracticeSettings(),
  ]);
  const tr = await getServerT();

  return (
    <div className="w-full space-y-6">
      <div className="no-print">
        <h2 className="text-xl font-semibold text-fg">{tr("Cost Estimation")}</h2>
        <p className="text-sm text-muted">
          {tr(
            "Select a project to open its bill-of-quantities estimate — labor norms, materials, equipment and subcontractor costs roll up by section, with profit and overhead applied to the total.",
          )}
        </p>
      </div>

      <EstimatesApp
        projects={projects}
        baseEstimate={baseEstimate}
        priceBook={priceBook}
        normSet={normSet}
        generalConditions={generalConditions}
        templates={templates}
        wiki={wiki}
        logoDataUrl={practice.logoDataUrl}
        footer={practice.footer}
      />
    </div>
  );
}
