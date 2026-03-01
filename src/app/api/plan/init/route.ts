import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { planInitSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { calculateInitialPlan } from "@/lib/calculations";
import { dateFromYmd } from "@/lib/date";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const userId = auth.userId;

  const body = await parseJson<unknown>(req);
  const parsed = planInitSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid plan init payload");
  }

  const [profile, latestWeight] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.weighIn.findFirst({
      where: { userId },
      orderBy: { date: "desc" }
    })
  ]);

  if (!profile || !latestWeight) {
    return jsonError("Profile and initial weight are required first", 400);
  }

  const startDate = dateFromYmd(parsed.data.start_date);
  const endDate = dateFromYmd(parsed.data.end_date);
  if (endDate <= startDate) {
    return jsonError("end_date must be after start_date");
  }

  if (
    parsed.data.preferred_phase === "bulk" &&
    parsed.data.goal_type === "target_weight" &&
    parsed.data.goal_value <= latestWeight.weightKg
  ) {
    return jsonError("For bulk phase, target_weight must be higher than current weight");
  }

  if (
    parsed.data.preferred_phase === "cut" &&
    parsed.data.goal_type === "target_weight" &&
    parsed.data.goal_value >= latestWeight.weightKg
  ) {
    return jsonError("For cut phase, target_weight must be lower than current weight");
  }

  const initial = calculateInitialPlan({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: latestWeight.weightKg,
    activity: profile.activity,
    goalType: parsed.data.goal_type,
    goalValue: parsed.data.goal_value,
    startDate,
    endDate,
    preferredPhase: parsed.data.preferred_phase
  });

  const plan = await db.$transaction(async (tx) => {
    await tx.plan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false }
    });
    return tx.plan.create({
      data: {
        userId,
        phase: initial.phase,
        goalType: parsed.data.goal_type,
        goalValue: parsed.data.goal_value,
        startDate,
        endDate,
        targetCalories: initial.calories,
        targetCarbsG: initial.carbs,
        targetProteinG: initial.protein,
        targetFatG: initial.fat,
        isActive: true
      }
    });
  });

  return NextResponse.json({ ok: true, plan });
}
