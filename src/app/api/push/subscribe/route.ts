import { NextRequest, NextResponse } from "next/server";
import { parseJson, requireAuth, jsonError } from "@/lib/api";
import { pushSubscribeSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJson<unknown>(req);
  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid push subscription payload");
  }

  const existing = await db.pushSubscription.findFirst({
    where: {
      userId: auth.userId,
      endpoint: parsed.data.endpoint
    }
  });

  if (existing) {
    await db.pushSubscription.update({
      where: { id: existing.id },
      data: {
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        deviceMeta: parsed.data.device_meta ?? Prisma.JsonNull,
        revokedAt: null
      }
    });
  } else {
    await db.pushSubscription.create({
      data: {
        userId: auth.userId,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        deviceMeta: parsed.data.device_meta ?? Prisma.JsonNull
      }
    });
  }

  return NextResponse.json({ ok: true });
}
