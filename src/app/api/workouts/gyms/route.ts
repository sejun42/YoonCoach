import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, parseJson, jsonError } from "@/lib/api";
import { gymNames, hasGymSelector } from "@/lib/exercise-catalog";
import { db } from "@/lib/db";
import { userExercises } from "@/lib/services/workouts";

const selection = z.object({ exerciseId: z.string().min(1).max(150), gym: z.enum(gymNames), selected: z.boolean() });

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = selection.safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("종목과 헬스장을 확인해 주세요.");
  const { exerciseId, gym, selected } = parsed.data;
  const exercise = (await userExercises(auth.userId)).find(item => item.id === exerciseId);
  if (!exercise || !hasGymSelector(exercise.equipment)) return jsonError("헬스장을 지정할 수 없는 종목입니다.");
  const location = { userId: auth.userId, exerciseId, gym };
  if (selected) await db.exerciseGym.createMany({ data: [location], skipDuplicates: true });
  else await db.exerciseGym.deleteMany({ where: location });
  return NextResponse.json({ ok: true });
}
