import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { ProfitView } from "@/components/finance/profit-view";
import { canSeeProfit, profitByProject } from "@/lib/data/finance-analysis";

export const metadata: Metadata = { title: "Profitability · AEC-flow" };

/**
 * What each job earned against what it cost.
 *
 * ADMINISTRATORS ONLY, and the gate is checked twice: here, so the page says so
 * plainly, and again inside `profitByProject`, because a page is a public
 * endpoint and margin is computed from internal cost rates — which are close to
 * what people are paid.
 */
export default async function ProfitPage() {
  const allowed = await canSeeProfit();

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Profitability</h2>
        <p className="text-sm text-muted">
          What each job is worth at charge-out, what it has cost, and what is still to be billed.
        </p>
      </div>

      {allowed ? (
        <ProfitView analyses={await profitByProject()} />
      ) : (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium text-fg">This one is for directors and administrators.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Margin is worked out from internal cost rates, which are close to what people are
              paid. Your own hours and their worth are on the Time screen.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
