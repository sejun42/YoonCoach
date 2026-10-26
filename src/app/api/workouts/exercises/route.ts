import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth, parseJson, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { customExerciseSchema } from "@/lib/workouts";
import { nextExercisePublication } from "@/lib/exercise-sharing";
import { exerciseIdentity } from "@/lib/exercise-catalog";
import { userExercises } from "@/lib/services/workouts";
import { lockExerciseSharing } from "@/lib/services/exercise-sharing";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = customExerciseSchema.safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("종목 이름과 부위 태그 1–2개를 입력해 주세요.");
  if ((await userExercises(auth.userId)).some((item) => exerciseIdentity(item) === exerciseIdentity(parsed.data))) {
    return jsonError("이미 선택할 수 있는 종목입니다. 운동 검색에서 추가해 주세요.", 409);
  }
  try {
    const exercise = await db.$transaction(async (tx) => {
      await lockExerciseSharing(tx, auth.userId);
      const own = await tx.customExercise.findMany({ where: { userId: auth.userId }, select: { name: true, equipment: true } });
      if (own.some((item) => exerciseIdentity(item) === exerciseIdentity(parsed.data))) return null;
      const settings = await tx.userSetting.findUnique({ where: { userId: auth.userId }, select: { shareExercisesWeekly: true } });
      return tx.customExercise.create({ data: { userId: auth.userId, ...parsed.data,
        publicAt: settings?.shareExercisesWeekly ? nextExercisePublication() : null } });
    }, { timeout: 15000 });
    if (!exercise) return jsonError("같은 이름의 내 종목이 이미 있습니다.", 409);
    return NextResponse.json({ exercise: { id: exercise.id, name: exercise.name, tags: exercise.tags, equipment: exercise.equipment, custom: true } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("같은 이름의 내 종목이 이미 있습니다.", 409);
    throw error;
  }
}
