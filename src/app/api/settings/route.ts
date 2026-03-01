import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { settingsSchema } from "@/lib/schemas";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const settings = await db.userSetting.findUnique({
    where: { userId: auth.userId }
  });

  return NextResponse.json({
    ok: true,
    settings: settings
      ? {
          notify_time: settings.notifyTime,
          coaching_day_of_week: settings.coachingDayOfWeek,
          coaching_time: settings.coachingTime
        }
      : null
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJson<unknown>(req);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid settings payload");
  }

  const data = parsed.data;
  const updated = await db.userSetting.upsert({
    where: { userId: auth.userId },
    create: {
      userId: auth.userId,
      notifyTime: data.notify_time ?? "08:30",
      coachingDayOfWeek: data.coaching_day_of_week ?? 0,
      coachingTime: data.coaching_time ?? "09:00"
    },
    update: {
      notifyTime: data.notify_time,
      coachingDayOfWeek: data.coaching_day_of_week,
      coachingTime: data.coaching_time
    }
  });

  return NextResponse.json({
    ok: true,
    settings: {
      notify_time: updated.notifyTime,
      coaching_day_of_week: updated.coachingDayOfWeek,
      coaching_time: updated.coachingTime
    }
  });
}
