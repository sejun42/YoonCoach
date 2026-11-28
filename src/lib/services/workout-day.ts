import { dateFromYmd } from "@/lib/date";
import { db } from "@/lib/db";
import { readEntries } from "@/lib/services/workouts";

export async function readWorkoutDay(userId: string, ymd: string) {
  const date = dateFromYmd(ymd);
  const [session, legacy] = await Promise.all([
    db.workoutSession.findUnique({
      where: { userId_date: { userId, date } },
      select: { revision: true, entries: true, manualParts: true, note: true }
    }),
    db.workoutBodyPartLog.findMany({ where: { userId, date }, select: { bodyPart: true } })
  ]);
  return {
    session: { date: ymd, manualParts: session?.manualParts ?? [], revision: session?.revision ?? 0, entries: readEntries(session?.entries), note: session?.note ?? "" },
    legacyParts: legacy.map((row) => row.bodyPart)
  };
}
