import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { readEntries, userExercises } from "@/lib/services/workouts";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const [exercises, preferences, routines, locations] = await Promise.all([
    userExercises(auth.userId), db.exercisePreference.findMany({ where: { userId: auth.userId } }),
    db.workoutRoutine.findMany({ where: { userId: auth.userId }, orderBy: { updatedAt: "desc" } }),
    db.exerciseGym.findMany({ where: { userId: auth.userId }, select: { exerciseId: true, gym: true }, orderBy: { gym: "asc" } })
  ]);
  const gyms: Record<string, string[]> = {};
  for (const { exerciseId, gym } of locations) (gyms[exerciseId] ??= []).push(gym);
  return NextResponse.json({ exercises, gyms, preferences: Object.fromEntries(preferences.map((row) => [row.exerciseId, row.settings])),
    routines: routines.map((row) => ({ id: row.id, name: row.name, entries: readEntries(row.entries) })) }, { headers: { "Cache-Control": "private, no-store" } });
}
