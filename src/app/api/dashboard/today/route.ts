import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { getDashboardData, makeWeeklySummary } from "@/lib/services/dashboard";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const data = await getDashboardData(auth.userId);
  const summary = makeWeeklySummary(data.delta7dAvgKg, data.adherence.bad, data.plan?.phase);

  return NextResponse.json({
    ok: true,
    ...data,
    weeklySummary: summary
  });
}
