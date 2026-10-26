import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { nextExercisePublication, type ExerciseSharingStatus } from "@/lib/exercise-sharing";

export async function lockExerciseSharing(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext('exercise-sharing'))::text`;
}

export async function exerciseSharingStatus(userId: string): Promise<ExerciseSharingStatus> {
  const now = new Date();
  const [settings, privateCount, scheduledCount, publishedCount] = await Promise.all([
    db.userSetting.findUnique({ where: { userId }, select: { shareExercisesWeekly: true } }),
    db.customExercise.count({ where: { userId, publicAt: null } }),
    db.customExercise.count({ where: { userId, publicAt: { gt: now } } }),
    db.customExercise.count({ where: { userId, publicAt: { lte: now } } })
  ]);
  return { enabled: settings?.shareExercisesWeekly ?? false, nextPublicationAt: nextExercisePublication(now).toISOString(),
    privateCount, scheduledCount, publishedCount };
}
