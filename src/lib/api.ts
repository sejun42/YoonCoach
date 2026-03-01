import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuth() {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false as const, response: jsonError("Unauthorized", 401) };
  }
  return { ok: true as const, userId };
}

export async function parseJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
