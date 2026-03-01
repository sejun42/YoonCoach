import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runCoaching } from "@/lib/services/coaching";

function dayFromWeekdayLabel(label: string) {
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return map[label] ?? -1;
}

function localDayAndTime(now: Date, timezone: string) {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short"
    }).format(now);
    const hm = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now);
    return { day: dayFromWeekdayLabel(weekday), time: hm };
  } catch {
    const fallback = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    return { day: now.getUTCDay(), time: fallback };
  }
}

function normalizeNow(input: unknown) {
  if (typeof input !== "string") {
    return new Date();
  }
  const candidate = new Date(input);
  if (Number.isNaN(candidate.getTime())) {
    return new Date();
  }
  return candidate;
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const incoming = req.headers.get("x-cron-secret");
    if (incoming !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const now = normalizeNow(body?.now);

  const settings = await db.userSetting.findMany({
    include: {
      user: {
        include: {
          profile: true
        }
      }
    }
  });

  const results: Array<{ user_id: string; status: "applied" | "skipped"; reason?: string }> = [];
  for (const setting of settings) {
    const timezone = setting.user.profile?.timezone || "UTC";
    const local = localDayAndTime(now, timezone);
    if (local.day !== setting.coachingDayOfWeek || local.time !== setting.coachingTime) {
      continue;
    }

    const result = await runCoaching(setting.userId, "weekly_auto");
    if (result.executed) {
      results.push({ user_id: setting.userId, status: "applied" });
    } else {
      results.push({ user_id: setting.userId, status: "skipped", reason: result.reason });
    }
  }

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    users_scanned: settings.length,
    users_targeted: results.length,
    results
  });
}
