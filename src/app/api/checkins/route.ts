import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { checkinSchema } from "@/lib/schemas";
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

  const checkins = await db.dailyCheckin.findMany({
    where,
    orderBy: { date: "asc" }
  });

  return NextResponse.json({
    ok: true,
    checkins: checkins.map((c) => ({
      id: c.id,
      date: toYmd(c.date),
      adherence_status: c.adherenceStatus,
      intake_known: c.intakeKnown,
      intake_calories: c.intakeCalories,
      intake_carbs_g: c.intakeCarbsG,
      intake_protein_g: c.intakeProteinG,
      intake_fat_g: c.intakeFatG
    }))
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJson<unknown>(req);
  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid check-in payload");
  }

  const row = await db.dailyCheckin.upsert({
    where: {
      userId_date: {
        userId: auth.userId,
        date: dateFromYmd(parsed.data.date)
      }
    },
    create: {
      userId: auth.userId,
      date: dateFromYmd(parsed.data.date),
      adherenceStatus: parsed.data.adherence_status,
      intakeKnown: parsed.data.intake_known,
      intakeCalories: parsed.data.intake_calories ?? null,
      intakeCarbsG: parsed.data.intake_carbs_g ?? null,
      intakeProteinG: parsed.data.intake_protein_g ?? null,
      intakeFatG: parsed.data.intake_fat_g ?? null
    },
    update: {
      adherenceStatus: parsed.data.adherence_status,
      intakeKnown: parsed.data.intake_known,
      intakeCalories: parsed.data.intake_calories ?? null,
      intakeCarbsG: parsed.data.intake_carbs_g ?? null,
      intakeProteinG: parsed.data.intake_protein_g ?? null,
      intakeFatG: parsed.data.intake_fat_g ?? null
    }
  });

  return NextResponse.json({
    ok: true,
    checkin: {
      id: row.id,
      date: toYmd(row.date),
      adherence_status: row.adherenceStatus,
      intake_known: row.intakeKnown
    }
  });
}
