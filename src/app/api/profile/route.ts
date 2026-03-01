import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { profileSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { dateFromYmd, toYmd } from "@/lib/date";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJson<unknown>(req);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid profile payload");
  }

  const userId = auth.userId;
  const today = toYmd(new Date());

  const profile = await db.profile.upsert({
    where: { userId },
    create: {
      userId,
      sex: parsed.data.sex,
      age: parsed.data.age,
      heightCm: parsed.data.height_cm,
      activity: parsed.data.activity,
      timezone: parsed.data.timezone
    },
    update: {
      sex: parsed.data.sex,
      age: parsed.data.age,
      heightCm: parsed.data.height_cm,
      activity: parsed.data.activity,
      timezone: parsed.data.timezone
    }
  });

  await db.weighIn.upsert({
    where: {
      userId_date: {
        userId,
        date: dateFromYmd(today)
      }
    },
    create: {
      userId,
      date: dateFromYmd(today),
      weightKg: parsed.data.weight_kg
    },
    update: {
      weightKg: parsed.data.weight_kg
    }
  });

  return NextResponse.json({
    ok: true,
    profile
  });
}
