import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJson<{ endpoint?: string }>(req);
  if (body?.endpoint) {
    await db.pushSubscription.updateMany({
      where: { userId: auth.userId, endpoint: body.endpoint },
      data: { revokedAt: new Date() }
    });
  } else {
    await db.pushSubscription.updateMany({
      where: { userId: auth.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  return NextResponse.json({ ok: true });
}
