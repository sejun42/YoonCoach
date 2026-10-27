import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseJson, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { readEntries } from "@/lib/services/workouts";
import { routineEntries } from "@/lib/workouts";

const input = z.object({ id: z.string().min(1).max(180) });
// Sharing is explicit and snapshots only the plan, never personal performance/settings.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = input.safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("공유할 루틴을 선택해 주세요.");
  const routine = await db.workoutRoutine.findFirst({ where: { id: parsed.data.id, userId: auth.userId } });
  if (!routine) return jsonError("루틴을 찾을 수 없습니다.", 404);
  const entries = routineEntries(readEntries(routine.entries));
  if (!entries.length) return jsonError("종목이 없는 루틴은 공유할 수 없습니다.");
  const share = await db.routineShare.upsert({ where: { routineId: routine.id },
    create: { token: randomBytes(24).toString("hex"), routineId: routine.id, name: routine.name, entries },
    update: { name: routine.name, entries } });
  return NextResponse.json({ path: "/routines/shared/" + share.token });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return jsonError("루틴을 선택해 주세요.");
  await db.routineShare.deleteMany({ where: { routineId: id, routine: { userId: auth.userId } } });
  return NextResponse.json({ ok: true });
}
