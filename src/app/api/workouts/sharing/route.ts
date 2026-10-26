import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, parseJson, jsonError } from "@/lib/api";
import { nextExercisePublication } from "@/lib/exercise-sharing";
import { exerciseSharingStatus, lockExerciseSharing } from "@/lib/services/exercise-sharing";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await exerciseSharingStatus(auth.userId), { headers });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = z.object({ enabled: z.boolean() }).strict().safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("주간 공유 설정을 확인해 주세요.");
  await db.$transaction(async (tx) => {
    await lockExerciseSharing(tx, auth.userId);
    const now = new Date();
    const shareExercisesWeekly = parsed.data.enabled;
    await tx.userSetting.upsert({ where: { userId: auth.userId },
      create: { userId: auth.userId, shareExercisesWeekly }, update: { shareExercisesWeekly } });
    if (shareExercisesWeekly) {
      await tx.customExercise.updateMany({ where: { userId: auth.userId, publicAt: null }, data: { publicAt: nextExercisePublication(now) } });
    } else {
      // Stop only upcoming releases. Already shared identities remain available
      // so other users can keep saving their existing workouts and routines.
      await tx.customExercise.updateMany({ where: { userId: auth.userId, publicAt: { gt: now } }, data: { publicAt: null } });
    }
  }, { timeout: 15000 });
  return NextResponse.json(await exerciseSharingStatus(auth.userId), { headers });
}

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const publishedNow = await db.$transaction(async (tx) => {
    await lockExerciseSharing(tx, auth.userId);
    const now = new Date();
    return (await tx.customExercise.updateMany({
      where: { userId: auth.userId, OR: [{ publicAt: null }, { publicAt: { gt: now } }] }, data: { publicAt: now }
    })).count;
  }, { timeout: 15000 });
  return NextResponse.json({ ...await exerciseSharingStatus(auth.userId), publishedNow }, { headers });
}
