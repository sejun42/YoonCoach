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
            plan: dashboard.plan
              ? {
                  phase: dashboard.plan.phase,
                  goalType: dashboard.plan.goalType,
                  goalValue: dashboard.plan.goalValue,
                  startDate: dashboard.plan.startDate.toISOString().slice(0, 10),
                  endDate: dashboard.plan.endDate.toISOString().slice(0, 10)
                }
              : null
          }}
        />
        <WeightsManager />
      </div>
    </AppShell>
  );
}
