import { NextRequest, NextResponse } from "next/server";
import { sendDailyDigestForNow } from "@/lib/services/push";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const incoming = req.headers.get("x-cron-secret");
    if (incoming !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const now = typeof body?.now === "string" ? new Date(body.now) : new Date();
  if (Number.isNaN(now.getTime())) {
    return NextResponse.json({ error: "invalid now timestamp" }, { status: 400 });
  }

  const result = await sendDailyDigestForNow(now);
  return NextResponse.json({ ok: true, now: now.toISOString(), ...result });
}
