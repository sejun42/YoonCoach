import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { readEntries, userExercises } from "@/lib/services/workouts";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const [exercises, preferences, routines] = await Promise.all([
    userExercises(auth.userId), db.exercisePreference.findMany({ where: { userId: auth.userId } }),
    db.workoutRoutine.findMany({ where: { userId: auth.userId }, orderBy: { updatedAt: "desc" } })
  ]);
  return NextResponse.json({ exercises, preferences: Object.fromEntries(preferences.map((row) => [row.exerciseId, row.settings])),
    routines: routines.map((row) => ({ id: row.id, name: row.name, entries: readEntries(row.entries) })) }, { headers: { "Cache-Control": "private, no-store" } });
}
