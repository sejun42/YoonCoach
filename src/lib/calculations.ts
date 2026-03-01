import type { ActivityLevel, GoalType, PlanPhase, Sex } from "@prisma/client";
import { ACTIVITY_FACTORS, MIN_CALORIES_BY_SEX } from "@/lib/constants";

export type InitialPlanInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goalType: GoalType;
  goalValue: number;
  startDate: Date;
  endDate: Date;
  preferredPhase: PlanPhase;
};

export type MacroTargets = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
};

export function calculateBmr(sex: Sex, age: number, heightCm: number, weightKg: number) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function calculateTdee(
  sex: Sex,
  age: number,
  heightCm: number,
  weightKg: number,
  activity: ActivityLevel
) {
  const bmr = calculateBmr(sex, age, heightCm, weightKg);
  return bmr * ACTIVITY_FACTORS[activity];
}

export function calorieFloor(sex: Sex) {
  return MIN_CALORIES_BY_SEX[sex];
}

function round(num: number) {
  return Math.round(num);
}

export function calculateMacros(calories: number, weightKg: number): Omit<MacroTargets, "calories"> {
  const protein = Math.max(80, round(weightKg * 1.8));
  const fatMinByWeight = round(weightKg * 0.8);
  const fatMinByCalories = round((calories * 0.2) / 9);
  const fat = Math.max(fatMinByWeight, fatMinByCalories);

  const usedCalories = protein * 4 + fat * 9;
  const carbs = Math.max(40, round((calories - usedCalories) / 4));

  return { carbs, protein, fat };
}

function dailyEnergyFromGoal(
  goalType: GoalType,
  goalValue: number,
  startDate: Date,
  endDate: Date,
  weightKg: number,
  mode: "cut" | "bulk"
) {
  const msInDay = 1000 * 60 * 60 * 24;
  const daySpan = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / msInDay));
  const weekSpan = daySpan / 7;

  if (goalType === "weekly_rate") {
    // goalValue is expected to be weekly % body-weight change (e.g., 0.4 means 0.4% / week).
    const weeklyChangeKg = weightKg * (goalValue / 100);
    return (weeklyChangeKg * 7700) / 7;
  }

  // goalType target_weight: goalValue is target kg.
  if (mode === "cut") {
    const totalLossKg = Math.max(0, weightKg - goalValue);
    const weeklyLossKg = totalLossKg / Math.max(1, weekSpan);
    return (weeklyLossKg * 7700) / 7;
  }

  const totalGainKg = Math.max(0, goalValue - weightKg);
  const weeklyGainKg = totalGainKg / Math.max(1, weekSpan);
  return (weeklyGainKg * 7700) / 7;
}

export function calculateInitialPlan(input: InitialPlanInput): MacroTargets & { phase: PlanPhase } {
  const tdee = calculateTdee(input.sex, input.age, input.heightCm, input.weightKg, input.activity);
  const floor = calorieFloor(input.sex);
  let calories = tdee;
  const phase: PlanPhase = input.preferredPhase;

  if (phase === "cut") {
    const rawDeficit = dailyEnergyFromGoal(
      input.goalType,
      input.goalValue,
      input.startDate,
      input.endDate,
      input.weightKg,
      "cut"
    );
    const deficit = Math.max(150, Math.min(800, rawDeficit));
    calories = Math.max(floor, tdee - deficit);
  } else if (phase === "bulk") {
    const rawSurplus = dailyEnergyFromGoal(
      input.goalType,
      input.goalValue,
      input.startDate,
      input.endDate,
      input.weightKg,
      "bulk"
    );
    const surplus = rawSurplus <= 0 ? 120 : Math.max(80, Math.min(500, rawSurplus));
    calories = tdee + surplus;
  }

  const roundedCalories = Math.round(calories / 10) * 10;
  const macros = calculateMacros(roundedCalories, input.weightKg);

  return {
    phase,
    calories: roundedCalories,
    ...macros
  };
}

export function movingAverage(weights: Array<{ date: Date; weightKg: number }>, windowSize = 7) {
  return weights.map((item, idx) => {
    const slice = weights.slice(Math.max(0, idx - windowSize + 1), idx + 1);
    const avg = slice.reduce((sum, x) => sum + x.weightKg, 0) / slice.length;
    return { date: item.date, avg };
  });
}

export function calculateWeeklyRatePercent(avgStart: number, avgEnd: number) {
  if (avgStart <= 0) {
    return 0;
  }
  return ((avgEnd - avgStart) / avgStart) * 100;
}
