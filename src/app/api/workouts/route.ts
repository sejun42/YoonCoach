import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { dateFromYmd } from "@/lib/date";
import { db } from "@/lib/db";
import { calendarDateSchema } from "@/lib/schemas";
import { sameWorkout, workoutSaveSchema } from "@/lib/workouts";
import { canonicalEntries, readEntries } from "@/lib/services/workouts";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (req.headers.get("x-workout-owner") && req.headers.get("x-workout-owner") !== auth.userId) return jsonError("로그인 계정이 변경되었습니다. 다시 열어 주세요.", 403);
  const parsed = calendarDateSchema.safeParse(req.nextUrl.searchParams.get("date"));
  if (!parsed.success) return jsonError("올바른 날짜를 선택해 주세요.");
  const date = dateFromYmd(parsed.data);
  const [session, legacy] = await Promise.all([
    db.workoutSession.findUnique({ where: { userId_date: { userId: auth.userId, date } } }),
    db.workoutBodyPartLog.findMany({ where: { userId: auth.userId, date }, select: { bodyPart: true } })
  ]);
  return NextResponse.json({ session: { date: parsed.data, revision: session?.revision ?? 0, entries: readEntries(session?.entries), note: session?.note ?? "" },
    legacyParts: legacy.map((row) => row.bodyPart) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (req.headers.get("x-workout-owner") && req.headers.get("x-workout-owner") !== auth.userId) return jsonError("로그인 계정이 변경되었습니다. 다시 열어 주세요.", 403);
  const parsed = workoutSaveSchema.safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("태그는 최대 2개, 무게는 0–2000kg, 횟수는 1–1000 사이의 정수로 입력해 주세요.");
  const entries = await canonicalEntries(auth.userId, parsed.data.entries);
  if (!entries) return jsonError("사용할 수 없는 운동 종목입니다.");
  const { revision, note } = parsed.data;
  const date = dateFromYmd(parsed.data.date);
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${auth.userId}), hashtext(${parsed.data.date}))::text`;
    const previous = await tx.workoutSession.findUnique({ where: { userId_date: { userId: auth.userId, date } } });
    if ((previous?.revision ?? 0) !== revision) {
      // A response may be lost after the commit. Repeating the same payload is
      // successful, but never use a stale revision to overwrite different data.
      const prior = { date: parsed.data.date, entries: readEntries(previous?.entries), note: previous?.note ?? "", revision: previous?.revision ?? 0 };
      return sameWorkout(prior, { ...parsed.data, entries }) ? prior : null;
    }
    const saved = await tx.workoutSession.upsert({ where: { userId_date: { userId: auth.userId, date } },
      create: { userId: auth.userId, date, entries, note }, update: { entries, note, revision: { increment: 1 } } });
    const previousEntries = readEntries(previous?.entries);
    for (const entry of entries) {
      const old = previousEntries.find((item) => item.id === entry.id);
      if (JSON.stringify(old?.settings) !== JSON.stringify(entry.settings)) {
        await tx.exercisePreference.upsert({ where: { userId_exerciseId: { userId: auth.userId, exerciseId: entry.id } },
          create: { userId: auth.userId, exerciseId: entry.id, settings: entry.settings }, update: { settings: entry.settings } });
      }
    }
    return { date: parsed.data.date, entries, note, revision: saved.revision };
  }, { timeout: 15000 });
  if (!result) return jsonError("다른 화면에서 이 날짜를 수정했습니다. 입력 내용을 복사한 후 최신 기록을 다시 불러와 주세요.", 409);
  return NextResponse.json({ session: result });
}
