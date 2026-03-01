import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: { id: ctx.user.id, email: ctx.user.email },
    onboarding_completed: Boolean(ctx.profile && ctx.activePlan),
    has_profile: Boolean(ctx.profile),
    has_plan: Boolean(ctx.activePlan)
  });
}
