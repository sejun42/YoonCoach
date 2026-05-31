import { BodyPart } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { dateFromYmd, toYmd } from "@/lib/date";
import { db } from "@/lib/db";
import { workoutPartsSchema } from "@/lib/schemas";

const bodyPartValues = new Set<string>(Object.values(BodyPart));

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const where: { userId: string; date?: { gte?: Date; lte?: Date } } = {
    userId: auth.userId
  };
  if (from || to) {
    where.date = {};
    if (from) {
      where.date.gte = dateFromYmd(from);
    }
    if (to) {
      where.date.lte = dateFromYmd(to);
    }
  }

  const logs = await db.workoutBodyPartLog.findMany({
    where,
    orderBy: [{ date: "asc" }, { bodyPart: "asc" }]
  });

  return NextResponse.json({
    ok: true,
    logs: logs.map((log) => ({
      id: log.id,
      date: toYmd(log.date),
      body_part: log.bodyPart
    }))
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJson<unknown>(req);
  const parsed = workoutPartsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid workout parts payload");
  }

  const invalidPart = parsed.data.body_parts.find((part) => !bodyPartValues.has(part));
  if (invalidPart) {
    return jsonError("Invalid workout body part");
  }

  const date = dateFromYmd(parsed.data.date);
  const uniqueBodyParts = Array.from(new Set(parsed.data.body_parts)) as BodyPart[];

  const logs = await db.$transaction(async (tx) => {
    await tx.workoutBodyPartLog.deleteMany({
      where: {
        userId: auth.userId,
        date
      }
    });

    if (uniqueBodyParts.length > 0) {
      await tx.workoutBodyPartLog.createMany({
        data: uniqueBodyParts.map((bodyPart) => ({
          userId: auth.userId,
          date,
          bodyPart
        }))
      });
    }

    return tx.workoutBodyPartLog.findMany({
      where: {
        userId: auth.userId,
        date
      },
      orderBy: { bodyPart: "asc" }
    });
  });

  return NextResponse.json({
    ok: true,
    date: parsed.data.date,
    body_parts: logs.map((log) => log.bodyPart)
  });
}
