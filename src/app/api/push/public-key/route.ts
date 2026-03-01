import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    publicKey: process.env.WEB_PUSH_PUBLIC_KEY || null
  });
}
