import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth, parseJson, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { customExerciseSchema } from "@/lib/workouts";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = customExerciseSchema.safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("종목 이름과 부위 태그 1–2개를 입력해 주세요.");
  try {
    const exercise = await db.customExercise.create({ data: { userId: auth.userId, ...parsed.data } });
    return NextResponse.json({ exercise: { id: exercise.id, name: exercise.name, tags: exercise.tags, equipment: exercise.equipment, custom: true } }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("같은 이름의 내 종목이 이미 있습니다.", 409);
    throw error;
  }
}
