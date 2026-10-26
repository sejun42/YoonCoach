import { NextRequest, NextResponse } from "next/server";
import { requireAuth, parseJson, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { routineSchema, routineEntries } from "@/lib/workouts";
import { canonicalEntries } from "@/lib/services/workouts";

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = routineSchema.safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("루틴 이름과 운동 종목을 확인해 주세요.");
  const resolved = await canonicalEntries(auth.userId, parsed.data.entries);
  if (!resolved) return jsonError("사용할 수 없는 운동 종목입니다.");
  const entries = routineEntries(resolved);
  const routine = await db.workoutRoutine.upsert({ where: { userId_name: { userId: auth.userId, name: parsed.data.name } },
    create: { userId: auth.userId, name: parsed.data.name, entries }, update: { entries } });
  return NextResponse.json({ routine: { id: routine.id, name: routine.name, entries } });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return jsonError("루틴을 선택해 주세요.");
  await db.workoutRoutine.deleteMany({ where: { id, userId: auth.userId } });
  return NextResponse.json({ ok: true });
}
