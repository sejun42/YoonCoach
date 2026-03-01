import { NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { canRunManualCoaching, runCoaching } from "@/lib/services/coaching";

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const manualAllowed = await canRunManualCoaching(auth.userId);
  if (!manualAllowed.ok) {
    return jsonError(manualAllowed.message, 429);
  }

  const result = await runCoaching(auth.userId, "manual_request");
  if (!result.executed) {
    return NextResponse.json({
      ok: false,
      reason: result.reason,
      detail: result.detail
    });
  }

  return NextResponse.json({
    ok: true,
    coaching_log_id: result.coachingLogId,
    applied: result.applied,
    output: result.output
  });
}
