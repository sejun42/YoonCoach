import { NextRequest, NextResponse } from "next/server";
import { requireAuth, jsonError } from "@/lib/api";
import { db } from "@/lib/db";
import { dateFromYmd, toYmd } from "@/lib/date";
import { calendarDateSchema } from "@/lib/schemas";
import { readEntries } from "@/lib/services/workouts";
import { recordedSets } from "@/lib/workouts";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const id = req.nextUrl.searchParams.get("exerciseId");
  const through = req.nextUrl.searchParams.get("through");
  if (!id || id.length > 180 || !calendarDateSchema.safeParse(through).success) return jsonError("올바른 종목과 날짜를 선택해 주세요.");
  const sessions = await db.workoutSession.findMany({
    where: { userId: auth.userId, date: { lte: dateFromYmd(through!) }, entries: { array_contains: [{ id }] } }, orderBy: { date: "asc" }, select: { date: true, entries: true }
  });
  const history = sessions.flatMap((session) => readEntries(session.entries).filter((entry) => entry.id === id && recordedSets(entry).length)
    .map((entry) => ({ date: toYmd(session.date), entry })));
  return NextResponse.json({ history }, { headers: { "Cache-Control": "private, no-store" } });
}
