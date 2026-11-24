import { z } from "zod";
import { db } from "@/lib/db";
import { hash, issuer, noStore, scope } from "@/lib/gpt-auth";
import { calendarDateSchema } from "@/lib/schemas";
import { dateFromYmd } from "@/lib/date";
import { parseNutritionLine } from "@/lib/nutrition";
import { hasNutrition, saveNutrition, serialize } from "@/lib/services/nutrition";
import { readWorkoutDay } from "@/lib/services/workout-day";

const challenge = 'Bearer resource_metadata="' + issuer + '/.well-known/oauth-protected-resource/api/mcp"';
const auth = [{type:"oauth2",scopes:[scope]}];
function tool(name:string, description:string, properties:Record<string,unknown>, required:string[], readOnly:boolean) {
  return { name, description, inputSchema:{type:"object",properties,required,additionalProperties:false},securitySchemes:auth,
    annotations:{readOnlyHint:readOnly,destructiveHint:false,openWorldHint:false,idempotentHint:true} };
}
const day = {type:"string",description:"YYYY-MM-DD"};
const tools = [
  tool("get_workout_day","날짜별 모든 운동, 중량, 세트, 횟수 및 메모 조회",{date:day},["date"],true),
  tool("list_records","기간별 운동 종목명, 체중과 식단 마감 기록 조회. 최대 31일.",{from:day,to:day},["from","to"],true),
  tool("close_nutrition","사용자가 마감을 요청하면 대화에서 추적한 하루 총량을 저장한다. line 형식: 식단마감|날짜=YYYY-MM-DD|칼로리=숫자|탄수=숫자|단백질=숫자|지방=숫자|목표칼로리=숫자|목표탄수=숫자|목표단백질=숫자|목표지방=숫자. 미상 허용. 기존 값과 다르면 사용자에게 확인한 후 expectedUpdatedAt을 전달한다.",{line:{type:"string"},expectedUpdatedAt:{type:"string"}},["line"],false)
];
async function run(userId:string,name:string,args:unknown) {
  if (name === "get_workout_day") {
    const {date} = z.object({date:calendarDateSchema}).strict().parse(args);
    return readWorkoutDay(userId,date);
  }
  if (name === "list_records") {
    const {from,to} = z.object({from:calendarDateSchema,to:calendarDateSchema}).strict().parse(args);
    const date = {gte:dateFromYmd(from),lte:dateFromYmd(to)};
    if (to < from || +date.lte - +date.gte > 30*86400000) throw new Error("1~31일 범위를 선택하세요.");
    const where = {userId,date}, orderBy = {date:"asc" as const};
    const [sessions, weight, food, legacy] = await Promise.all([
      db.workoutSession.findMany({where,orderBy,select:{date:true,entries:true}}),
      db.weighIn.findMany({where,orderBy,select:{date:true,weightKg:true}}),
      db.dailyCheckin.findMany({where,orderBy}),
      db.workoutBodyPartLog.findMany({where,orderBy,select:{date:true,bodyPart:true}})
    ]);
    return {workouts:sessions.map(s=>({date:s.date, exercises:Array.isArray(s.entries)?s.entries.map(e=>e && typeof e==="object" && "name" in e ? e.name : null):[]})),weight,legacy,nutrition:food.filter(hasNutrition).map(serialize)};
  }
  const {line,expectedUpdatedAt} = z.object({line:z.string().max(2000),expectedUpdatedAt:z.string().datetime().optional()}).strict().parse(args);
  const record = parseNutritionLine(line);
  const result = await saveNutrition(userId,{record,sourceText:line,expectedUpdatedAt:expectedUpdatedAt ?? null});
  if ("saved" in result && result.saved) return {saved:true,record:serialize(result.saved)};
  const current = result.conflict && serialize(result.conflict);
  if (current && Object.entries(record).every(([key,value])=>current[key as keyof typeof current]===value)) return {saved:true,record:current};
  return {saved:false,reason:"기존 기록이 변경되었습니다. 수정 여부를 사용자에게 확인하세요.",current};
}
export async function POST(req:Request) {
  const origin=req.headers.get("origin");
  if(origin && origin!==issuer && origin!=="https://chatgpt.com") return new Response(null,{status:403});
  const msg = await req.json().catch(()=>null);
  const id = msg?.id ?? null;
  const reply = (body:object) => Response.json({jsonrpc:"2.0",id,...body},{headers:noStore});
  if(msg?.jsonrpc!=="2.0" || typeof msg.method!=="string") return reply({error:{code:-32600,message:"Invalid request"}});
  if(msg.id===undefined) return new Response(null,{status:202});
  if(msg.method==="initialize") {
    const version=msg.params?.protocolVersion;
    return reply({result:{protocolVersion:["2025-03-26","2025-06-18","2025-11-25"].includes(version)?version:"2025-11-25",capabilities:{tools:{}},serverInfo:{name:"YoonCoach",version:"1.0.0"}}});
  }
  if(msg.method==="ping") return reply({result:{}});
  if(msg.method==="tools/list") return reply({result:{tools}});
  if(msg.method!=="tools/call") return reply({error:{code:-32601,message:"Method not found"}});
  const token=req.headers.get("authorization")?.match(/^Bearer ([\w-]{43})$/i)?.[1];
  const account=token && await db.user.findFirst({where:{gptTokenHash:hash(token),gptTokenExpiry:{gt:new Date()}},select:{id:true}});
  if(!account) return Response.json({jsonrpc:"2.0",id,error:{code:-32001,message:"Account linking required"}},{status:401,headers:{...noStore,"WWW-Authenticate":challenge}});
  const name=msg.params?.name;
  if(!tools.some(t=>t.name===name)) return reply({error:{code:-32602,message:"Unknown tool"}});
  try {
    const result=await run(account.id,name,msg.params?.arguments);
    return reply({result:{content:[{type:"text",text:JSON.stringify(result)}]}});
  } catch(error) {
    const message=error instanceof z.ZodError?"날짜와 입력 형식을 확인해 주세요.":error instanceof Error && !error.name.includes("Prisma")?error.message:"기록을 처리하지 못했습니다.";
    return reply({result:{isError:true,content:[{type:"text",text:message}]}});
  }
}
