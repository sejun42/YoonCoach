import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const logs = await db.coachingLog.findMany({
    where: { userId: auth.userId },
    orderBy: { runAt: "desc" },
    take: 20
  });

  return NextResponse.json({
    ok: true,
    logs: logs.map((log) => ({
      id: log.id,
      run_at: log.runAt.toISOString(),
      reason: log.reason,
      applied: log.applied,
      output_json: log.outputJson
    }))
  });
}
