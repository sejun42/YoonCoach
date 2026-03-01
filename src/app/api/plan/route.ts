import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { planPatchSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { calculateInitialPlan } from "@/lib/calculations";
import { dateFromYmd } from "@/lib/date";

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const userId = auth.userId;

  const body = await parseJson<unknown>(req);
  const parsed = planPatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid plan patch payload");
  }

  const [profile, currentPlan, latestWeight] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.plan.findFirst({ where: { userId, isActive: true }, orderBy: { updatedAt: "desc" } }),
    db.weighIn.findFirst({ where: { userId }, orderBy: { date: "desc" } })
  ]);

  if (!profile || !currentPlan || !latestWeight) {
    return jsonError("Profile, plan, and weight are required", 400);
  }

  const goalType = parsed.data.goal_type ?? currentPlan.goalType;
  const goalValue = parsed.data.goal_value ?? currentPlan.goalValue;
  const endDate = parsed.data.end_date ? dateFromYmd(parsed.data.end_date) : currentPlan.endDate;
  const preferredPhase = parsed.data.preferred_phase ?? currentPlan.phase;

  if (preferredPhase === "bulk" && goalType === "target_weight" && goalValue <= latestWeight.weightKg) {
    return jsonError("For bulk phase, target_weight must be higher than current weight");
  }

  if (preferredPhase === "cut" && goalType === "target_weight" && goalValue >= latestWeight.weightKg) {
    return jsonError("For cut phase, target_weight must be lower than current weight");
  }

  const recalculated = calculateInitialPlan({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: latestWeight.weightKg,
    activity: profile.activity,
    goalType,
    goalValue,
    startDate: currentPlan.startDate,
    endDate,
    preferredPhase
  });

  const updated = await db.plan.update({
    where: { id: currentPlan.id },
    data: {
      goalType,
      goalValue,
      endDate,
      phase: recalculated.phase,
      targetCalories: recalculated.calories,
      targetCarbsG: recalculated.carbs,
      targetProteinG: recalculated.protein,
      targetFatG: recalculated.fat
    }
  });

  return NextResponse.json({ ok: true, plan: updated });
}
