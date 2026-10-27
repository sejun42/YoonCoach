import { NextRequest, NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { exerciseCatalog, exerciseIdentity, type Exercise } from "@/lib/exercise-catalog";
import { readEntries } from "@/lib/services/workouts";
import { lockExerciseSharing } from "@/lib/services/exercise-sharing";
import { routineEntries, type WorkoutEntry } from "@/lib/workouts";

type Context = { params: Promise<{ token: string }> };
const validToken = (token: string) => /^[a-f0-9]{48}$/.test(token);
export async function GET(_req: NextRequest, context: Context) {
  const { token } = await context.params;
  const share = validToken(token) ? await db.routineShare.findUnique({ where: { token } }) : null;
  if (!share) return jsonError("공유가 종료되었거나 올바르지 않은 링크입니다.", 404);
  return NextResponse.json({ routine: { name: share.name, entries: routineEntries(readEntries(share.entries)) } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(_req: NextRequest, context: Context) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { token } = await context.params;
  if (!validToken(token)) return jsonError("올바르지 않은 링크입니다.", 404);
  const result = await db.$transaction(async (tx) => {
    // Serialize repeat imports and exercise-name allocation for this recipient.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${auth.userId}), hashtext('routine-import'))::text`;
    await lockExerciseSharing(tx, auth.userId);
    const share = await tx.routineShare.findUnique({ where: { token }, include: { routine: { select: { userId: true, id: true } } } });
    if (!share) return null;
    if (share.routine.userId === auth.userId) return { id: share.routineId, existing: true };
    const existing = await tx.workoutRoutine.findUnique({ where: { userId_importedFrom: { userId: auth.userId, importedFrom: token } } });
    if (existing) return { id: existing.id, existing: true };
    const own = await tx.customExercise.findMany({ where: { userId: auth.userId } });
    const publicExercises = await tx.customExercise.findMany({ where: { publicAt: { lte: new Date() }, userId: { not: auth.userId } }, orderBy: [{ publicAt: "asc" }, { id: "asc" }] });
    const available = [...exerciseCatalog, ...own, ...publicExercises] as Exercise[];
    const names = new Set(own.map((item) => item.name));
    const used = new Set<string>();
    const entries: WorkoutEntry[] = [];
    for (const entry of routineEntries(readEntries(share.entries))) {
      const key = exerciseIdentity(entry);
      let exercise = available.find((item) => item.id === entry.id && !used.has(item.id))
        ?? available.find((item) => exerciseIdentity(item) === key && !used.has(item.id));
      if (!exercise) {
        let name = entry.name;
        for (let n = 2; names.has(name); n++) name = entry.name.slice(0, 85) + ` (공유 ${n})`;
        exercise = await tx.customExercise.create({ data: { userId: auth.userId, name, tags: entry.tags, equipment: entry.equipment } }) as Exercise;
        names.add(name); available.push(exercise);
      }
      used.add(exercise.id);
      entries.push({ ...entry, id: exercise.id, name: exercise.name, equipment: exercise.equipment });
    }
    const routines = await tx.workoutRoutine.findMany({ where: { userId: auth.userId }, select: { name: true } });
    const routineNames = new Set(routines.map((item) => item.name));
    let name = share.name;
    for (let n = 2; routineNames.has(name); n++) name = share.name.slice(0, 45) + ` (공유 ${n})`;
    const routine = await tx.workoutRoutine.create({ data: { userId: auth.userId, name, entries, importedFrom: token } });
    return { id: routine.id, existing: false };
  }, { timeout: 15000 });
  if (!result) return jsonError("공유가 종료되었거나 올바르지 않은 링크입니다.", 404);
  return NextResponse.json(result);
}
