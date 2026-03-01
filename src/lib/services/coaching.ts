import { Prisma, type CoachingReason, type PlanPhase } from "@prisma/client";
import { db } from "@/lib/db";
import {
  calculateMacros,
  calculateWeeklyRatePercent,
  calorieFloor,
  movingAverage
} from "@/lib/calculations";
import { daysAgo, isSameIsoWeek, toYmd } from "@/lib/date";

type CoachingDecision = {
  decision: "decrease" | "maintain" | "increase";
  next_calories: number;
  next_macros_g: { carbs: number; protein: number; fat: number };
  rationale_short: string;
  behavior_tip: string;
  data_quality: "good" | "medium" | "low";
  risk_flags: string[];
};

type CoachingInput = {
  profile: {
    sex: "male" | "female";
    age: number;
    height_cm: number;
    current_weight_kg: number;
  };
  goal: {
    goal_type: "target_weight" | "weekly_rate";
    goal_value: number;
    plan_phase: PlanPhase;
    plan_start: string;
    plan_end: string;
  };
  currentTargets: {
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
  };
  recentWeighIns: Array<{ date: string; weight_kg: number }>;
  stats: {
    delta_7d_avg_kg: number;
    weekly_rate_percent: number;
    adherence_counts_7d: { good: number; ok: number; bad: number };
    intake_unknown_days_7d: number;
    intake_macros_summary_if_any: null | {
      avg_calories: number | null;
      avg_carbs: number | null;
      avg_protein: number | null;
      avg_fat: number | null;
      median_calories: number | null;
    };
  };
};

type RunCoachingResult =
  | {
      executed: false;
      reason: "insufficient_data";
      detail: {
        weigh_in_count_7d: number;
        checkin_count_7d: number;
      };
    }
  | {
      executed: true;
      coachingLogId: string;
      applied: boolean;
      output: CoachingDecision;
    };

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function median(numbers: number[]) {
  if (numbers.length === 0) {
    return null;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function parseDecision(raw: unknown): CoachingDecision | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Record<string, unknown>;

  const decision = candidate.decision;
  const quality = candidate.data_quality;
  const macros = candidate.next_macros_g as Record<string, unknown> | undefined;

  if (decision !== "decrease" && decision !== "maintain" && decision !== "increase") {
    return null;
  }
  if (quality !== "good" && quality !== "medium" && quality !== "low") {
    return null;
  }
  if (!macros || typeof macros.carbs !== "number" || typeof macros.protein !== "number" || typeof macros.fat !== "number") {
    return null;
  }

  return {
    decision,
    next_calories: Number(candidate.next_calories) || 0,
    next_macros_g: {
      carbs: Math.round(Number(macros.carbs) || 0),
      protein: Math.round(Number(macros.protein) || 0),
      fat: Math.round(Number(macros.fat) || 0)
    },
    rationale_short: String(candidate.rationale_short || "").slice(0, 220),
    behavior_tip: String(candidate.behavior_tip || "").slice(0, 140),
    data_quality: quality,
    risk_flags: Array.isArray(candidate.risk_flags)
      ? candidate.risk_flags.map((x) => String(x)).slice(0, 8)
      : []
  };
}

function safeJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fenced) {
      return null;
    }
    try {
      return JSON.parse(fenced[1]);
    } catch {
      return null;
    }
  }
}

function evaluateDataQuality(input: CoachingInput) {
  const totalChecks =
    input.stats.adherence_counts_7d.good +
    input.stats.adherence_counts_7d.ok +
    input.stats.adherence_counts_7d.bad;

  if (input.recentWeighIns.length < 6 || totalChecks < 5) {
    return "low" as const;
  }
  if (input.stats.intake_unknown_days_7d >= 3) {
    return "medium" as const;
  }
  return "good" as const;
}

function makeRationale(delta: number, badRatio: number, phase: PlanPhase) {
  if (badRatio >= 0.5) {
    return "준수율이 낮아 칼로리 추가 감량보다 루틴 안정화가 우선이에요.";
  }

  if (phase === "bulk") {
    if (delta < 0.1) {
      return "최근 7일 평균 체중 증가가 작아 벌크 칼로리 상향이 필요해요.";
    }
    if (delta > 0.7) {
      return "최근 체중 증가 속도가 빠른 편이라 지방 증가를 줄이도록 완화가 필요해요.";
    }
    return "최근 7일 평균 체중 증가 추세가 벌크 목표 범위와 유사해요.";
  }

  if (delta > -0.2 && delta < 0.2) {
    return "최근 7일 평균 체중 변화가 작아 미세 조정이 필요해요.";
  }
  if (delta <= -0.6) {
    return "최근 체중 감소 속도가 빠른 편이라 안전하게 유지/완화가 좋아요.";
  }
  return "최근 7일 평균 체중 추세가 목표 범위와 유사해요.";
}

function fallbackCoach(input: CoachingInput): CoachingDecision {
  const currentCalories = input.currentTargets.calories;
  const delta = input.stats.delta_7d_avg_kg;
  const phase = input.goal.plan_phase;
  const checks =
    input.stats.adherence_counts_7d.good +
    input.stats.adherence_counts_7d.ok +
    input.stats.adherence_counts_7d.bad;
  const badRatio = checks > 0 ? input.stats.adherence_counts_7d.bad / checks : 0;
  const unknown = input.stats.intake_unknown_days_7d;

  let decision: CoachingDecision["decision"] = "maintain";
  let nextCalories = currentCalories;
  const quality = evaluateDataQuality(input);
  const riskFlags: string[] = [];

  if (phase === "bulk") {
    if (input.stats.weekly_rate_percent >= 1.0) {
      riskFlags.push("weight_gain_too_fast");
    }
  } else if (Math.abs(input.stats.weekly_rate_percent) > 1.2) {
    riskFlags.push("weight_change_too_fast");
  }

  if (badRatio >= 0.5 || unknown >= 3) {
    decision = "maintain";
    riskFlags.push("adherence_low");
  } else if (phase === "bulk") {
    if (delta < 0.1) {
      decision = "increase";
      nextCalories = currentCalories + 120;
    } else if (delta > 0.7) {
      decision = "decrease";
      nextCalories = currentCalories - 100;
    }
  } else if (delta > -0.2) {
    decision = "decrease";
    nextCalories = currentCalories - 120;
  } else if (delta < -0.8) {
    decision = "increase";
    nextCalories = currentCalories + 100;
  }

  const floor = calorieFloor(input.profile.sex);
  if (nextCalories < floor) {
    nextCalories = floor;
    riskFlags.push("calorie_floor_reached");
    if (decision === "decrease") {
      decision = "maintain";
    }
  }

  if (quality === "low" && decision === "decrease") {
    decision = "maintain";
    nextCalories = currentCalories - 80;
    riskFlags.push("low_data_quality");
  }

  const macros = calculateMacros(nextCalories, input.profile.current_weight_kg);
  return {
    decision,
    next_calories: nextCalories,
    next_macros_g: macros,
    rationale_short: makeRationale(delta, badRatio, phase),
    behavior_tip:
      quality === "low"
        ? "이번 주는 공복 체중 4회, 체크인 3회를 먼저 채워보세요."
        : "기상 직후 체중 기록과 저녁 10초 체크인을 고정해보세요.",
    data_quality: quality,
    risk_flags: riskFlags
  };
}

function buildPrompt(input: CoachingInput) {
  return `아래 사용자 데이터를 보고 다음 주 목표 칼로리와 탄단지를 조정하라.

[Profile]
sex: ${input.profile.sex}
age: ${input.profile.age}
height_cm: ${input.profile.height_cm}
current_weight_kg: ${input.profile.current_weight_kg}

[Goal]
goal_type: ${input.goal.goal_type}
goal_value: ${input.goal.goal_value}
plan_phase: ${input.goal.plan_phase}
plan_start: ${input.goal.plan_start}
plan_end: ${input.goal.plan_end}

[Current Targets]
calories: ${input.currentTargets.calories}
macros_g: carbs=${input.currentTargets.carbs} protein=${input.currentTargets.protein} fat=${input.currentTargets.fat}

[Recent Weigh-ins (last 14 days)]
${JSON.stringify(input.recentWeighIns)}

[Stats]
delta_7d_avg_kg: ${input.stats.delta_7d_avg_kg}
weekly_rate_percent: ${input.stats.weekly_rate_percent}
adherence_counts_7d: good=${input.stats.adherence_counts_7d.good} ok=${input.stats.adherence_counts_7d.ok} bad=${input.stats.adherence_counts_7d.bad}
intake_unknown_days_7d: ${input.stats.intake_unknown_days_7d}
intake_macros_summary_if_any: ${JSON.stringify(input.stats.intake_macros_summary_if_any)}

[Rules]
1. 데이터 품질을 data_quality로 평가하라.
2. data_quality=low이면 decrease를 피하거나 감소폭을 최소화하라.
3. 체중 변화는 7일 평균 기반으로 판단하라.
4. adherence bad가 많으면 칼로리 감소보다 준수 개선을 우선하라.
5. plan_phase=cut이면 주간 체중 변화 목표를 음수로, plan_phase=bulk이면 양수(대략 +0.2~+0.5%/주)로 맞춰라.
6. 반드시 JSON 스키마로만 응답하라.

[Output JSON Schema]
{
  "decision":"decrease|maintain|increase",
  "next_calories":0,
  "next_macros_g":{"carbs":0,"protein":0,"fat":0},
  "rationale_short":"",
  "behavior_tip":"",
  "data_quality":"good|medium|low",
  "risk_flags":[]
}`;
}

async function maybeCallLlm(input: CoachingInput): Promise<CoachingDecision | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "너는 다이어트 코치다. 입력 데이터가 부족하면 조정을 보수적으로 하라. 출력은 반드시 JSON 하나만 반환하라."
          },
          { role: "user", content: buildPrompt(input) }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return parseDecision(safeJsonFromText(content));
  } catch {
    return null;
  }
}

function applyGuardrails(
  decision: CoachingDecision,
  currentCalories: number,
  sex: "male" | "female",
  weightKg: number,
  weeklyRatePercent: number,
  phase: PlanPhase
) {
  const result = { ...decision, risk_flags: [...decision.risk_flags] };
  const floor = calorieFloor(sex);

  if (result.data_quality === "low" && result.decision === "decrease") {
    result.decision = "maintain";
    result.next_calories = Math.max(floor, currentCalories - 80);
    result.risk_flags.push("low_data_quality");
  }

  if (phase === "cut" && weeklyRatePercent <= -1.2 && result.decision === "decrease") {
    result.decision = "maintain";
    result.next_calories = currentCalories;
    result.risk_flags.push("weight_loss_too_fast");
  }

  if (phase === "bulk" && weeklyRatePercent >= 1.0 && result.decision === "increase") {
    result.decision = "maintain";
    result.next_calories = currentCalories;
    result.risk_flags.push("weight_gain_too_fast");
  }

  if (result.next_calories < floor) {
    result.next_calories = floor;
    if (result.decision === "decrease") {
      result.decision = "maintain";
    }
    result.risk_flags.push("calorie_floor_reached");
  }

  const macros = calculateMacros(result.next_calories, weightKg);
  result.next_macros_g = macros;
  return result;
}

async function buildCoachingInput(userId: string) {
  const [profile, plan, weighIns14d, checkins7d] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.plan.findFirst({ where: { userId, isActive: true }, orderBy: { updatedAt: "desc" } }),
    db.weighIn.findMany({
      where: { userId, date: { gte: daysAgo(13) } },
      orderBy: { date: "asc" }
    }),
    db.dailyCheckin.findMany({
      where: { userId, date: { gte: daysAgo(6) } },
      orderBy: { date: "asc" }
    })
  ]);

  if (!profile || !plan || weighIns14d.length === 0) {
    return {
      ok: false as const,
      detail: {
        weigh_in_count_7d: weighIns14d.filter((w) => w.date >= daysAgo(6)).length,
        checkin_count_7d: checkins7d.length
      }
    };
  }

  const weighIns7d = weighIns14d.filter((w) => w.date >= daysAgo(6));
  if (weighIns7d.length < 4 || checkins7d.length < 3) {
    return {
      ok: false as const,
      detail: {
        weigh_in_count_7d: weighIns7d.length,
        checkin_count_7d: checkins7d.length
      }
    };
  }

  const ma = movingAverage(
    weighIns14d.map((w) => ({
      date: w.date,
      weightKg: w.weightKg
    })),
    7
  );
  const last = ma[ma.length - 1]?.avg ?? weighIns14d[weighIns14d.length - 1].weightKg;
  const oneWeekAgo = ma.find((m) => m.date >= daysAgo(6))?.avg ?? ma[0].avg;
  const delta = last - oneWeekAgo;
  const weeklyRate = calculateWeeklyRatePercent(oneWeekAgo, last);

  const good = checkins7d.filter((c) => c.adherenceStatus === "good").length;
  const ok = checkins7d.filter((c) => c.adherenceStatus === "ok").length;
  const bad = checkins7d.filter((c) => c.adherenceStatus === "bad").length;
  const unknown = checkins7d.filter((c) => !c.intakeKnown).length;

  const intakeKnownRows = checkins7d.filter((c) => c.intakeKnown);
  const caloriesList = intakeKnownRows
    .map((c) => c.intakeCalories)
    .filter((v): v is number => typeof v === "number");
  const carbsList = intakeKnownRows
    .map((c) => c.intakeCarbsG)
    .filter((v): v is number => typeof v === "number");
  const proteinList = intakeKnownRows
    .map((c) => c.intakeProteinG)
    .filter((v): v is number => typeof v === "number");
  const fatList = intakeKnownRows
    .map((c) => c.intakeFatG)
    .filter((v): v is number => typeof v === "number");

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null;

  const currentWeight = weighIns14d[weighIns14d.length - 1].weightKg;
  const input: CoachingInput = {
    profile: {
      sex: profile.sex,
      age: profile.age,
      height_cm: profile.heightCm,
      current_weight_kg: currentWeight
    },
    goal: {
      goal_type: plan.goalType,
      goal_value: plan.goalValue,
      plan_phase: plan.phase,
      plan_start: toYmd(plan.startDate),
      plan_end: toYmd(plan.endDate)
    },
    currentTargets: {
      calories: plan.targetCalories,
      carbs: plan.targetCarbsG,
      protein: plan.targetProteinG,
      fat: plan.targetFatG
    },
    recentWeighIns: weighIns14d.map((w) => ({ date: toYmd(w.date), weight_kg: w.weightKg })),
    stats: {
      delta_7d_avg_kg: Number(delta.toFixed(2)),
      weekly_rate_percent: Number(weeklyRate.toFixed(2)),
      adherence_counts_7d: { good, ok, bad },
      intake_unknown_days_7d: unknown,
      intake_macros_summary_if_any:
        intakeKnownRows.length > 0
          ? {
              avg_calories: avg(caloriesList),
              avg_carbs: avg(carbsList),
              avg_protein: avg(proteinList),
              avg_fat: avg(fatList),
              median_calories: median(caloriesList)
            }
          : null
    }
  };

  return { ok: true as const, input, plan, profile };
}

async function pickDecision(input: CoachingInput) {
  const llm = await maybeCallLlm(input);
  if (llm) {
    return llm;
  }
  return fallbackCoach(input);
}

export async function canRunManualCoaching(userId: string) {
  const logs = await db.coachingLog.findMany({
    where: { userId, reason: "manual_request" },
    orderBy: { runAt: "desc" },
    take: 10
  });

  const now = new Date();
  const latest = logs[0];
  if (latest) {
    const elapsedMs = now.getTime() - latest.runAt.getTime();
    if (elapsedMs < 48 * 60 * 60 * 1000) {
      return {
        ok: false as const,
        message: "마지막 수동 코칭 후 48시간이 지나야 합니다."
      };
    }
  }

  const thisWeekCount = logs.filter((x) => isSameIsoWeek(x.runAt, now)).length;
  if (thisWeekCount >= 2) {
    return {
      ok: false as const,
      message: "수동 코칭은 주 2회까지만 가능합니다."
    };
  }

  return { ok: true as const };
}

function shouldEndCalibration(planStart: Date, phase: PlanPhase) {
  if (phase !== "calibration") {
    return false;
  }
  const elapsedMs = Date.now() - planStart.getTime();
  return elapsedMs >= 14 * 24 * 60 * 60 * 1000;
}

function inferPostCalibrationPhase(
  goalType: "target_weight" | "weekly_rate",
  goalValue: number,
  currentWeightKg: number
): PlanPhase {
  if (goalType === "target_weight" && goalValue > currentWeightKg) {
    return "bulk";
  }
  return "cut";
}

export async function runCoaching(
  userId: string,
  reason: "weekly_auto" | "manual_request" | "calibration_end"
): Promise<RunCoachingResult> {
  const inputResult = await buildCoachingInput(userId);
  if (!inputResult.ok) {
    return {
      executed: false,
      reason: "insufficient_data",
      detail: inputResult.detail
    };
  }

  const { input, plan, profile } = inputResult;
  let selectedReason: CoachingReason = reason;
  if (shouldEndCalibration(plan.startDate, plan.phase) && reason !== "manual_request") {
    selectedReason = "calibration_end";
  }

  const rawDecision = await pickDecision(input);
  const guarded = applyGuardrails(
    rawDecision,
    plan.targetCalories,
    profile.sex,
    input.profile.current_weight_kg,
    input.stats.weekly_rate_percent,
    plan.phase
  );

  const nextPhase =
    selectedReason === "calibration_end"
      ? inferPostCalibrationPhase(plan.goalType, plan.goalValue, input.profile.current_weight_kg)
      : plan.phase;

  const log = await db.$transaction(async (tx) => {
    await tx.plan.updateMany({
      where: { userId, isActive: true },
      data: {
        targetCalories: guarded.next_calories,
        targetCarbsG: guarded.next_macros_g.carbs,
        targetProteinG: guarded.next_macros_g.protein,
        targetFatG: guarded.next_macros_g.fat,
        phase: nextPhase
      }
    });

    return tx.coachingLog.create({
      data: {
        userId,
        reason: selectedReason,
        inputSnapshot: input as unknown as Prisma.InputJsonValue,
        outputJson: guarded as unknown as Prisma.InputJsonValue,
        applied: true
      }
    });
  });

  return {
    executed: true,
    coachingLogId: log.id,
    applied: true,
    output: guarded
  };
}
