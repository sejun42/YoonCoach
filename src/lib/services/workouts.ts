import { db } from "@/lib/db";
import { exerciseCatalog, exerciseIdentity, type Exercise } from "@/lib/exercise-catalog";
import { type WorkoutEntry, workoutEntriesSchema } from "@/lib/workouts";

async function availableExercises(userId: string): Promise<Exercise[]> {
  const now = new Date();
  const [own, shared] = await Promise.all([
    db.customExercise.findMany({ where: { userId }, orderBy: { name: "asc" },
      select: { id: true, name: true, tags: true, equipment: true, publicAt: true } }),
    db.customExercise.findMany({ where: { userId: { not: userId }, publicAt: { lte: now } },
      orderBy: [{ publicAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, tags: true, equipment: true } })
  ]);
  return [...exerciseCatalog,
    ...own.map(({ publicAt, ...item }) => ({ ...item, custom: true, shared: Boolean(publicAt && publicAt <= now) } as Exercise)),
    ...shared.map((item) => ({ ...item, shared: true } as Exercise))];
}

export async function userExercises(userId: string): Promise<Exercise[]> {
  const seen = new Set<string>();
  return (await availableExercises(userId)).filter((exercise) => {
    const key = exerciseIdentity(exercise);
    // Keep all existing personal/built-in identities. Other people's duplicates
    // must not replace IDs already used by this user's history or routines.
    if (!exercise.custom && exercise.shared && seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function canonicalEntries(userId: string, entries: WorkoutEntry[]) {
  const exercises = new Map((await availableExercises(userId)).map((exercise) => [exercise.id, exercise]));
  if (entries.some((entry) => !exercises.has(entry.id))) return null;
  return entries.map((entry) => ({ ...entry, name: exercises.get(entry.id)!.name, equipment: exercises.get(entry.id)!.equipment }));
}

export function readEntries(value: unknown): WorkoutEntry[] {
  // All new writes pass the same schema; do not let malformed imported JSON crash a calendar.
  const parsed = workoutEntriesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
