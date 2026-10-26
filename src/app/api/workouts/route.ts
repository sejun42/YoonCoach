import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { dateFromYmd } from "@/lib/date";
import { db } from "@/lib/db";
import { calendarDateSchema } from "@/lib/schemas";
import { workoutSaveSchema } from "@/lib/workouts";
import { canonicalEntries, readEntries } from "@/lib/services/workouts";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
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
  const parsed = workoutSaveSchema.safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("태그는 최대 2개, 세트의 무게와 횟수는 함께 입력해 주세요. (무게 0–2000kg, 횟수 1–1000)");
  const entries = await canonicalEntries(auth.userId, parsed.data.entries);
  if (!entries) return jsonError("사용할 수 없는 운동 종목입니다.");
  const { revision, note } = parsed.data;
  const date = dateFromYmd(parsed.data.date);
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${auth.userId}), hashtext(${parsed.data.date}))::text`;
    const previous = await tx.workoutSession.findUnique({ where: { userId_date: { userId: auth.userId, date } } });
    if ((previous?.revision ?? 0) !== revision) return null;
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
