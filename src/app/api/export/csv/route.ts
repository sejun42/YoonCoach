import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { toYmd } from "@/lib/date";
import { readEntries } from "@/lib/services/workouts";

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const raw = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];
  return lines.join("\n");
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const [weighIns, checkins, coaching, workouts, sessions, routines, exercises, preferences] = await Promise.all([
    db.weighIn.findMany({ where: { userId: auth.userId }, orderBy: { date: "asc" } }),
    db.dailyCheckin.findMany({ where: { userId: auth.userId }, orderBy: { date: "asc" } }),
    db.coachingLog.findMany({ where: { userId: auth.userId }, orderBy: { runAt: "asc" } }),
    db.workoutBodyPartLog.findMany({ where: { userId: auth.userId }, orderBy: { date: "asc" } }),
    db.workoutSession.findMany({ where: { userId: auth.userId }, orderBy: { date: "asc" } }),
    db.workoutRoutine.findMany({ where: { userId: auth.userId }, orderBy: { name: "asc" } }),
    db.customExercise.findMany({ where: { userId: auth.userId }, orderBy: { name: "asc" } }),
    db.exercisePreference.findMany({ where: { userId: auth.userId } })
  ]);

  const weighInCsv = rowsToCsv(
    ["date", "weight_kg"],
    weighIns.map((w) => ({
      date: toYmd(w.date),
      weight_kg: w.weightKg
    }))
  );
  const checkinCsv = rowsToCsv(
    [
      "date",
      "adherence_status",
      "intake_known",
      "intake_calories",
      "intake_carbs_g",
      "intake_protein_g",
      "intake_fat_g",
      "target_calories", "target_carbs_g", "target_protein_g", "target_fat_g", "nutrition_source"
    ],
    checkins.map((c) => ({
      date: toYmd(c.date),
      adherence_status: c.adherenceStatus,
      intake_known: c.intakeKnown,
      intake_calories: c.intakeCalories,
      intake_carbs_g: c.intakeCarbsG,
      intake_protein_g: c.intakeProteinG,
      intake_fat_g: c.intakeFatG,
      target_calories: c.nutritionTargetCalories,
      target_carbs_g: c.nutritionTargetCarbsG,
      target_protein_g: c.nutritionTargetProteinG,
      target_fat_g: c.nutritionTargetFatG,
      nutrition_source: c.nutritionSource
    }))
  );
  const coachingCsv = rowsToCsv(
    ["run_at", "reason", "applied", "output_json"],
    coaching.map((c) => ({
      run_at: c.runAt.toISOString(),
      reason: c.reason,
      applied: c.applied,
      output_json: JSON.stringify(c.outputJson)
    }))
  );

  const merged = [
    "# weigh_ins",
    weighInCsv,
    "",
    "# daily_checkins",
    checkinCsv,
    "",
    "# coaching_logs",
    coachingCsv,
    "",
    "# workout_body_parts",
    rowsToCsv(["date", "body_part"], workouts.map((row) => ({ date: toYmd(row.date), body_part: row.bodyPart }))),
    "", "# workout_sets",
    rowsToCsv(["date", "exercise_id", "exercise", "tags", "main", "set", "weight_kg", "reps", "set_type", "settings"], sessions.flatMap((session) =>
      readEntries(session.entries).flatMap((entry) => entry.sets.map((set, index) => ({ date: toYmd(session.date), exercise_id: entry.id, exercise: entry.name,
        tags: entry.tags.join("|"), main: entry.isMain, set: index + 1, weight_kg: set.weight, reps: set.reps, set_type: set.type ?? "normal", settings: JSON.stringify(entry.settings) }))))),
    "", "# workout_sessions",
    rowsToCsv(["date", "note", "entries_json"], sessions.map((session) => ({ date: toYmd(session.date), note: session.note, entries_json: JSON.stringify(session.entries) }))),
    "", "# workout_routines",
    rowsToCsv(["name", "entries_json"], routines.map((routine) => ({ name: routine.name, entries_json: JSON.stringify(routine.entries) }))),
    "", "# custom_exercises",
    rowsToCsv(["id", "name", "tags", "equipment"], exercises.map((exercise) => ({ ...exercise, tags: exercise.tags.join("|") }))),
    "", "# exercise_settings",
    rowsToCsv(["exercise_id", "settings_json"], preferences.map((preference) => ({ exercise_id: preference.exerciseId, settings_json: JSON.stringify(preference.settings) })))
  ].join("\n");

  return new NextResponse(merged, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yooncoach-export-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
