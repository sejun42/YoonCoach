import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getSessionUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { callback, client, hash, issuer, resource, scope } from "@/lib/gpt-auth";

export const dynamic = "force-dynamic";
export default async function Consent({searchParams}: {searchParams: Promise<Record<string,string | undefined>>}) {
  if (!process.env.AUTH_SECRET) throw new Error("Account linking is unavailable.");
  const p = await searchParams;
  if (p.client_id !== client || p.redirect_uri !== callback || p.response_type !== "code" ||
      p.code_challenge_method !== "S256" || !/^[\w-]{43}$/.test(p.code_challenge ?? "") ||
      (p.resource && p.resource !== resource) || (p.scope && p.scope !== scope) || !p.state || p.state.length > 2048)
    return <p>ChatGPT에서 연결을 다시 시작해 주세요.</p>;
  const state = p.state, challenge = p.code_challenge!;
  const userId = await getSessionUserId();
  if (!userId) return <AuthForm returnTo={"/connect/chatgpt?" + new URLSearchParams(p as Record<string,string>)} />;
  async function approve() {
    "use server";
    if (await getSessionUserId() !== userId || !userId) throw new Error("다시 로그인해 주세요.");
    const code = randomBytes(32).toString("base64url");
    await db.user.update({where:{id:userId}, data:{gptCodeHash:hash(code),gptChallenge:challenge,gptCodeExpiry:new Date(Date.now()+300000)}});
    redirect(callback + "?" + new URLSearchParams({code,state,iss:issuer}));
  }
  return <main className="auth-wrap"><h1>ChatGPT에 YoonCoach 연결</h1><p>내 운동·체중·식단 기록을 조회하고, 채팅에서 마감한 식단을 저장할 수 있습니다. 연결은 30일간 유효합니다.</p><form action={approve}><button className="btn btn-primary">연결 허용</button></form><a href={callback + "?" + new URLSearchParams({error:"access_denied",state,iss:issuer})}>취소</a></main>;
}
