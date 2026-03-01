import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const plan = await db.plan.findFirst({
    where: { userId: auth.userId, isActive: true },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({ ok: true, plan });
}
