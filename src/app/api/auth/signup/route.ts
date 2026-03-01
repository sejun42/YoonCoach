import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { parseJson, jsonError } from "@/lib/api";
import { signUpSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const body = await parseJson<unknown>(req);
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid signup payload");
  }

  const { email, password } = parsed.data;
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return jsonError("Email already exists", 409);
  }

  const user = await db.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      settings: {
        create: {}
      }
    }
  });

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email }
  });
  setSessionCookie(response, user.id);
  return response;
}
