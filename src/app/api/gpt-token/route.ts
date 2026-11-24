import { randomBytes } from "node:crypto";
import { callback, client, hash, noStore, resource, scope } from "@/lib/gpt-auth";
import { db } from "@/lib/db";
export async function POST(req: Request) {
  const p = new URLSearchParams(await req.text());
  const verifier = p.get("code_verifier") ?? "";
  const invalid = () => Response.json({error:"invalid_grant"},{status:400,headers:noStore});
  if (p.get("client_id") !== client || p.get("redirect_uri") !== callback || p.get("grant_type") !== "authorization_code" ||
      (p.has("resource") && p.get("resource") !== resource) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return invalid();
  const token = randomBytes(32).toString("base64url");
  const ttl = 30*86400;
  const used = await db.user.updateMany({where:{gptCodeHash:hash(p.get("code") ?? ""),gptChallenge:hash(verifier),gptCodeExpiry:{gt:new Date()}},
    data:{gptCodeHash:null,gptChallenge:null,gptCodeExpiry:null,gptTokenHash:hash(token),gptTokenExpiry:new Date(Date.now()+ttl*1000)}});
  if (used.count !== 1) return invalid();
  return Response.json({access_token:token,token_type:"Bearer",expires_in:ttl,scope},{headers:noStore});
}
