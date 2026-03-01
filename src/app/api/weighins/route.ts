import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { weighInCreateSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { dateFromYmd, toYmd } from "@/lib/date";

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

  const weighIns = await db.weighIn.findMany({
    where,
    orderBy: { date: "asc" }
  });

  return NextResponse.json({
    ok: true,
    weighIns: weighIns.map((w) => ({
      id: w.id,
      date: toYmd(w.date),
      weight_kg: w.weightKg,
      created_at: w.createdAt.toISOString()
    }))
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJson<unknown>(req);
  const parsed = weighInCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid weigh-in payload");
  }

  const row = await db.weighIn.upsert({
    where: {
      userId_date: {
        userId: auth.userId,
        date: dateFromYmd(parsed.data.date)
      }
    },
    create: {
      userId: auth.userId,
      date: dateFromYmd(parsed.data.date),
      weightKg: parsed.data.weight_kg
    },
    update: {
      weightKg: parsed.data.weight_kg
    }
  });

  return NextResponse.json({
    ok: true,
    weighIn: {
      id: row.id,
      date: toYmd(row.date),
      weight_kg: row.weightKg
    }
  });
}
