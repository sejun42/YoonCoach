import { db } from "@/lib/db";
import { exerciseCatalog, type Exercise } from "@/lib/exercise-catalog";
import { type WorkoutEntry, workoutEntriesSchema } from "@/lib/workouts";

export async function userExercises(userId: string): Promise<Exercise[]> {
  const custom = await db.customExercise.findMany({ where: { userId }, orderBy: { name: "asc" } });
  return [...exerciseCatalog, ...custom.map((item) => ({ id: item.id, name: item.name, tags: item.tags, equipment: item.equipment, custom: true } as Exercise))];
}

export async function canonicalEntries(userId: string, entries: WorkoutEntry[]) {
  const exercises = new Map((await userExercises(userId)).map((exercise) => [exercise.id, exercise]));
  if (entries.some((entry) => !exercises.has(entry.id))) return null;
  return entries.map((entry) => ({ ...entry, name: exercises.get(entry.id)!.name, equipment: exercises.get(entry.id)!.equipment }));
}

export function readEntries(value: unknown): WorkoutEntry[] {
  // All new writes pass the same schema; do not let malformed imported JSON crash a calendar.
  const parsed = workoutEntriesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
