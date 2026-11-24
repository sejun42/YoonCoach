import { requireAuth } from "@/lib/api";
import { allBodyParts } from "@/lib/body-parts";
import { toYmd } from "@/lib/date";
import { db } from "@/lib/db";
import { equipmentLabels, type Exercise } from "@/lib/exercise-catalog";
import { rowsToCsv } from "@/lib/export-csv";
import { readEntries, userExercises } from "@/lib/services/workouts";
import { setTypes } from "@/lib/workouts";

const headers = ["구분", "날짜", "종목ID", "종목명", "출처", "기구", "부위", "운동순서", "메인", "세트", "세트유형", "운동중량(kg)", "횟수", "세팅", "메모", "체중(kg)", "RIR", "착용 장비"];
const partLabel = (key: string) => allBodyParts.find(part => part.key === key)?.label ?? key;
function exerciseFields(exercise: Exercise) {
  return { 종목ID: exercise.id, 종목명: exercise.name, 기구: equipmentLabels[exercise.equipment], 부위: exercise.tags.map(partLabel).join(" / ") };
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const where = { userId: auth.userId };
  const orderBy = { date: "asc" as const };
  const [catalog, sessions, parts, weights] = await Promise.all([
    userExercises(auth.userId),
    db.workoutSession.findMany({ where, orderBy, select: { date: true, entries: true, note: true } }),
    db.workoutBodyPartLog.findMany({ where, orderBy, select: { date: true, bodyPart: true } }),
    db.weighIn.findMany({ where, orderBy, select: { date: true, weightKg: true } })
  ]);
  const rows: Record<string, unknown>[] = catalog.map(exercise => ({
    구분: "종목 목록", ...exerciseFields(exercise), 출처: exercise.custom ? "내 종목" : exercise.shared ? "공유" : "기본"
  }));
  for (const session of sessions) {
    const 날짜 = toYmd(session.date);
    if (session.note) rows.push({ 구분: "운동 메모", 날짜, 메모: session.note });
    for (const [index, entry] of readEntries(session.entries).entries()) {
      const fields = { ...exerciseFields(entry), 운동순서: index + 1, 메인: entry.isMain ? "예" : "아니오",
        세팅: entry.settings.filter(s => s.value).map(s => s.label + "=" + s.value).join(" / ") };
      for (const [i, set] of entry.sets.entries()) {
        rows.push({ 구분: set.completed === false ? "미수행 계획" : "세트 기록", 날짜, ...fields, 세트: i + 1, RIR: set.rir, "착용 장비": set.gear?.join(" / "), 세트유형: setTypes[set.type ?? "normal"],
          "운동중량(kg)": set.weight, 횟수: set.reps });
      }
    }
  }
  for (const part of parts) rows.push({ 구분: "기존 부위 기록", 날짜: toYmd(part.date), 부위: partLabel(part.bodyPart) });
  for (const weight of weights) rows.push({ 구분: "체중", 날짜: toYmd(weight.date), "체중(kg)": weight.weightKg });
  return new Response("\uFEFF" + rowsToCsv(headers, rows), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="yooncoach-training-${toYmd(new Date())}.csv"`,
    "Cache-Control": "private, no-store"
  } });
}
