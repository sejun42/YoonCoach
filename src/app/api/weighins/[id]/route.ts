import { NextRequest, NextResponse } from "next/server";
import { requireAuth, parseJson, jsonError } from "@/lib/api";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await parseJson<{ weight_kg?: number }>(req);
  const weight = body?.weight_kg;
  if (!weight || Number.isNaN(weight) || weight < 30 || weight > 300) {
    return jsonError("Invalid weight_kg");
  }

  const { id } = await params;
  const updated = await db.weighIn.updateMany({
    where: { id, userId: auth.userId },
    data: { weightKg: weight }
  });

  if (updated.count === 0) {
    return jsonError("Weigh-in not found", 404);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const deleted = await db.weighIn.deleteMany({
    where: { id, userId: auth.userId }
  });

  if (deleted.count === 0) {
    return jsonError("Weigh-in not found", 404);
  }
  return NextResponse.json({ ok: true });
}
