import { CostDatabaseView } from "@/components/cost-data/cost-database-view";

export const metadata = { title: "Cost Database · ZenArch" };

export default function CostDatabasePage() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg">Cost Database</h2>
        <p className="text-sm text-muted">
          Reference cost data, providers and indexation — Netherlands (licensed import), Aruba, Colombia and USA.
          Licensed third-party data is imported by authorised users only; nothing is scraped.
        </p>
      </div>
      <CostDatabaseView />
    </div>
  );
}
