import AppShell from "@/components/AppShell";
import WeightsManager from "@/components/WeightsManager";
import GraphView from "@/components/GraphView";
import { requireSessionUser } from "@/lib/session";
import { getDashboardData } from "@/lib/services/dashboard";

export default async function WeightsPage() {
  const userId = await requireSessionUser();
  const dashboard = await getDashboardData(userId);
  return (
    <AppShell>
      <div className="space-y-6">
        <GraphView
          initialData={{
            weighIns: dashboard.weighIns,
            movingAverages: dashboard.movingAverages,
            delta7dAvgKg: dashboard.delta7dAvgKg,
            weeklyRatePercent: dashboard.weeklyRatePercent
          }}
        />
        <WeightsManager />
      </div>
    </AppShell>
  );
}
