import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { toYmd } from "@/lib/date";

function csvEscape(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
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

  const [weighIns, checkins, coaching] = await Promise.all([
    db.weighIn.findMany({ where: { userId: auth.userId }, orderBy: { date: "asc" } }),
    db.dailyCheckin.findMany({ where: { userId: auth.userId }, orderBy: { date: "asc" } }),
    db.coachingLog.findMany({ where: { userId: auth.userId }, orderBy: { runAt: "asc" } })
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
      "intake_fat_g"
    ],
    checkins.map((c) => ({
      date: toYmd(c.date),
      adherence_status: c.adherenceStatus,
      intake_known: c.intakeKnown,
      intake_calories: c.intakeCalories,
      intake_carbs_g: c.intakeCarbsG,
      intake_protein_g: c.intakeProteinG,
      intake_fat_g: c.intakeFatG
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
    coachingCsv
  ].join("\n");

  return new NextResponse(merged, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yooncoach-export-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
