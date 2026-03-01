import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const latest = await db.coachingLog.findFirst({
    where: { userId: auth.userId },
    orderBy: { runAt: "desc" }
  });

  return NextResponse.json({
    ok: true,
    coaching: latest
      ? {
          id: latest.id,
          run_at: latest.runAt.toISOString(),
          reason: latest.reason,
          applied: latest.applied,
          output_json: latest.outputJson
        }
      : null
  });
}
