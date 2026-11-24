import { getSessionUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { noStore } from "@/lib/gpt-auth";
export async function DELETE(req:Request) {
  const userId=await getSessionUserId();
  if(!userId || req.headers.get("x-yooncoach-action") !== "disconnect") return new Response(null,{status:403});
  await db.user.update({where:{id:userId},data:{gptTokenHash:null,gptTokenExpiry:null,gptCodeHash:null,gptChallenge:null,gptCodeExpiry:null}});
  return Response.json({ok:true},{headers:noStore});
}
