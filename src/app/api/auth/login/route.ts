import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJson, jsonError } from "@/lib/api";
import { loginSchema } from "@/lib/schemas";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await parseJson<unknown>(req);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid login payload");
  }

  const { email, password } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return jsonError("Invalid credentials", 401);
  }

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email }
  });
  setSessionCookie(response, user.id);
  return response;
}
