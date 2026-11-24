import { serialize, lockDay, saveNutrition } from "@/lib/services/nutrition";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseJson, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { dateFromYmd } from "@/lib/date";
import { calendarDateSchema } from "@/lib/schemas";
import { nutritionWriteSchema } from "@/lib/nutrition";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const records = await db.dailyCheckin.findMany({ where: { userId: auth.userId, OR: [
    { intakeCalories: { not: null } }, { intakeCarbsG: { not: null } }, { intakeProteinG: { not: null } },
    { intakeFatG: { not: null } }, { nutritionSource: { not: null } }, { nutritionTargetCalories: { not: null } },
    { nutritionTargetCarbsG: { not: null } }, { nutritionTargetProteinG: { not: null } }, { nutritionTargetFatG: { not: null } }
  ] }, orderBy: { date: "asc" } });
  return NextResponse.json({ ok: true, records: records.map(serialize) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = nutritionWriteSchema.safeParse(await parseJson<unknown>(req));
  if (!parsed.success) return jsonError("Invalid nutrition record");
  const result = await saveNutrition(auth.userId, parsed.data);
  if ("conflict" in result) return NextResponse.json({ error: "다른 곳에서 기록이 변경됐습니다. 최신 기록을 확인한 뒤 다시 저장해 주세요.", current: result.conflict ? serialize(result.conflict) : null }, { status: 409 });
  return NextResponse.json({ ok: true, record: serialize(result.saved) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = z.object({ date: calendarDateSchema, expectedUpdatedAt: z.string().datetime() }).strict().safeParse(await parseJson<unknown>(req));
  if (!parsed.success) return jsonError("Invalid nutrition record");
  const deleted = await db.$transaction(async (tx) => {
    await lockDay(tx, auth.userId, parsed.data.date);
    const row = await tx.dailyCheckin.findUnique({ where: { userId_date: { userId: auth.userId, date: dateFromYmd(parsed.data.date) } } });
    if (!row || row.updatedAt.toISOString() !== parsed.data.expectedUpdatedAt) return false;
    // Removing nutrition must not remove a legacy adherence check-in.
    if (row.adherenceStatus === null) await tx.dailyCheckin.delete({ where: { id: row.id } });
    else await tx.dailyCheckin.update({ where: { id: row.id }, data: {
      intakeKnown: false, intakeCalories: null, intakeCarbsG: null, intakeProteinG: null, intakeFatG: null,
      nutritionTargetCalories: null, nutritionTargetCarbsG: null, nutritionTargetProteinG: null,
      nutritionTargetFatG: null, nutritionSource: null
    } });
    return true;
  });
  if (!deleted) return jsonError("기록이 변경됐습니다. 새로고침 후 다시 확인해 주세요.", 409);
  return NextResponse.json({ ok: true });
}
