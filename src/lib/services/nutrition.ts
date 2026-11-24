import type { DailyCheckin, Prisma } from "@prisma/client";
import type { z } from "zod";
import type { nutritionWriteSchema } from "@/lib/nutrition";
import { db } from "@/lib/db";
import { dateFromYmd, toYmd } from "@/lib/date";
export function serialize(row: DailyCheckin) {
  return { id: row.id, date: toYmd(row.date), updatedAt: row.updatedAt.toISOString(),
    calories: row.intakeCalories, carbs: row.intakeCarbsG, protein: row.intakeProteinG, fat: row.intakeFatG,
    targetCalories: row.nutritionTargetCalories, targetCarbs: row.nutritionTargetCarbsG,
    targetProtein: row.nutritionTargetProteinG, targetFat: row.nutritionTargetFatG, sourceText: row.nutritionSource };
}

export function hasNutrition(row: DailyCheckin) {
  return row.nutritionSource !== null || [row.intakeCalories, row.intakeCarbsG, row.intakeProteinG, row.intakeFatG,
    row.nutritionTargetCalories, row.nutritionTargetCarbsG, row.nutritionTargetProteinG, row.nutritionTargetFatG].some((value) => value !== null);
}

export async function lockDay(tx: Prisma.TransactionClient, userId: string, date: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${"nutrition:" + date}))::text`;
}

export async function saveNutrition(userId: string, { record, sourceText, expectedUpdatedAt }: z.infer<typeof nutritionWriteSchema>) {
  return db.$transaction(async (tx) => {
    await lockDay(tx, userId, record.date);
    const where = { userId_date: { userId: userId, date: dateFromYmd(record.date) } };
    const existing = await tx.dailyCheckin.findUnique({ where });
    if ((existing && hasNutrition(existing) ? existing.updatedAt.toISOString() : null) !== expectedUpdatedAt) return { conflict: existing && hasNutrition(existing) ? existing : null };
    const data = { updatedAt: new Date(Math.max(Date.now(), (existing?.updatedAt.getTime() ?? 0) + 1)),
      intakeKnown: record.calories !== null, intakeCalories: record.calories,
      intakeCarbsG: record.carbs, intakeProteinG: record.protein, intakeFatG: record.fat,
      nutritionTargetCalories: record.targetCalories, nutritionTargetCarbsG: record.targetCarbs,
      nutritionTargetProteinG: record.targetProtein, nutritionTargetFatG: record.targetFat,
      nutritionSource: sourceText ?? existing?.nutritionSource ?? "" };
    return { saved: await tx.dailyCheckin.upsert({ where, create: { ...where.userId_date, ...data }, update: data }) };
  });
}
