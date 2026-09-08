import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { dateFromYmd, toYmd } from "@/lib/date";
import { db } from "@/lib/db";
import { calendarDateSchema, workoutPartsSchema } from "@/lib/schemas";

async function lastDates(client: Prisma.TransactionClient, userId: string, today: string) {
  const groups = await client.workoutBodyPartLog.groupBy({
    by: ["bodyPart"], where: { userId, date: { lte: dateFromYmd(today) } }, _max: { date: true }
  });
  return groups.flatMap((group) => group._max.date ? [{ body_part: group.bodyPart, date: toYmd(group._max.date) }] : []);
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const month = req.nextUrl.searchParams.get("month");
  const today = req.nextUrl.searchParams.get("today") ?? toYmd(new Date());
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!calendarDateSchema.safeParse(today).success ||
    (month && !calendarDateSchema.safeParse(month + "-01").success) ||
    (from && !calendarDateSchema.safeParse(from).success) ||
    (to && !calendarDateSchema.safeParse(to).success) || (from && to && from > to)) {
    return jsonError("Invalid date range");
  }
  const where: Prisma.WorkoutBodyPartLogWhereInput = { userId: auth.userId };
  if (month) {
    const start = dateFromYmd(month + "-01");
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    where.date = { gte: start, lt: end };
  } else if (from || to) {
    where.date = { ...(from ? { gte: dateFromYmd(from) } : {}), ...(to ? { lte: dateFromYmd(to) } : {}) };
  }
  const [logs, last_dates] = await Promise.all([
    db.workoutBodyPartLog.findMany({ where, orderBy: [{ date: "asc" }, { bodyPart: "asc" }], select: { id: true, date: true, bodyPart: true } }),
    lastDates(db, auth.userId, today)
  ]);
  return NextResponse.json({
    ok: true, month, logs: logs.map((log) => ({ id: log.id, date: toYmd(log.date), body_part: log.bodyPart })), last_dates
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const parsed = workoutPartsSchema.safeParse(await parseJson<unknown>(req));
  const today = req.nextUrl.searchParams.get("today") ?? toYmd(new Date());
  if (!parsed.success || !calendarDateSchema.safeParse(today).success) return jsonError("Invalid workout parts payload");
  const date = dateFromYmd(parsed.data.date);
  const nextParts = [...new Set(parsed.data.body_parts)];

  const result = await db.$transaction(async (tx) => {
    // Serialize replacements for the same user/day, including initially empty dates.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${auth.userId}), hashtext(${parsed.data.date}))::text`;
    await tx.workoutBodyPartLog.deleteMany({
      where: { userId: auth.userId, date, bodyPart: { notIn: nextParts } }
    });
    if (nextParts.length) {
      await tx.workoutBodyPartLog.createMany({
        data: nextParts.map((bodyPart) => ({ userId: auth.userId, date, bodyPart })), skipDuplicates: true
      });
    }
    const logs = await tx.workoutBodyPartLog.findMany({ where: { userId: auth.userId, date }, orderBy: { bodyPart: "asc" } });
    return {
      logs: logs.map((log) => ({ id: log.id, date: toYmd(log.date), body_part: log.bodyPart })),
      last_dates: await lastDates(tx, auth.userId, today)
    };
  }, { timeout: 10000 });
  return NextResponse.json({ ok: true, date: parsed.data.date, body_parts: result.logs.map((log) => log.body_part), ...result });
}
