import { z } from "zod";
import { calendarDateSchema } from "./schemas";

const amount = z.number().finite().min(0).max(100000).nullable();
export const nutritionSchema = z.object({
  date: calendarDateSchema,
  calories: amount, carbs: amount, protein: amount, fat: amount,
  targetCalories: amount, targetCarbs: amount, targetProtein: amount, targetFat: amount
}).strict();
export type NutritionValues = z.infer<typeof nutritionSchema>;
export type NutritionRecord = NutritionValues & { id: string; updatedAt: string; sourceText: string | null };
export type NutritionResponse = { ok: true; records: NutritionRecord[] };
export const nutritionMetrics = [
  { key: "calories", target: "targetCalories", label: "칼로리", unit: "kcal", color: "#c1782c" },
  { key: "carbs", target: "targetCarbs", label: "탄수", unit: "g", color: "#377da5" },
  { key: "protein", target: "targetProtein", label: "단백질", unit: "g", color: "#168c89" },
  { key: "fat", target: "targetFat", label: "지방", unit: "g", color: "#a56886" }
] as const;
export type NutritionMetric = typeof nutritionMetrics[number]["key"];
const fields = { 날짜: "date", 칼로리: "calories", 탄수: "carbs", 단백질: "protein", 지방: "fat",
  목표칼로리: "targetCalories", 목표탄수: "targetCarbs", 목표단백질: "targetProtein", 목표지방: "targetFat" } as const;

export function parseNutritionLine(input: string): NutritionValues {
  const line = input.trim();
  if (line.length > 2000 || /[\r\n]/.test(line)) throw new Error("마감 기록 한 줄만 입력해 주세요.");
  const [header, ...parts] = line.split("|");
  if (header.trim() !== "식단마감") throw new Error("'식단마감|'으로 시작하는 기록을 입력해 주세요.");
  const values: Record<string, unknown> = {};
  for (const part of parts) {
    const pair = part.split("=");
    if (pair.length !== 2) throw new Error("항목은 '이름=값' 형식이어야 합니다.");
    const label = pair[0].trim();
    if (!Object.hasOwn(fields, label)) throw new Error("알 수 없는 항목: " + label);
    const key = fields[label as keyof typeof fields];
    if (Object.hasOwn(values, key)) throw new Error("중복된 항목: " + label);
    const value = pair[1].trim();
    if (key === "date") values[key] = value;
    else if (value === "미상") values[key] = null;
    else {
      if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(label + ": 단위나 쉼표 없는 숫자 또는 '미상'을 입력해 주세요.");
      values[key] = Number(value);
    }
  }
  for (const [label, key] of Object.entries(fields)) {
    if (!Object.hasOwn(values, key)) throw new Error("빠진 항목: " + label);
  }
  const parsed = nutritionSchema.safeParse(values);
  if (!parsed.success) throw new Error("날짜와 수치를 확인해 주세요. 수치는 0~100,000 범위여야 합니다.");
  return parsed.data;
}

export const nutritionWriteSchema = z.object({
  record: nutritionSchema,
  sourceText: z.string().trim().max(2000).refine((value) => {
    if (value === "") return true;
    try { parseNutritionLine(value); return true; } catch { return false; }
  }, "Invalid closing-line source").nullable(),
  expectedUpdatedAt: z.string().datetime().nullable()
}).strict();

export function formatNutrition(value: number | null) {
  return value === null ? "미상" : value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export function nutritionSeries(records: NutritionValues[], today: string, days: number, metric: NutritionMetric) {
  const target = nutritionMetrics.find((item) => item.key === metric)!.target;
  const end = Date.parse(today + "T00:00:00Z");
  const byDate = new Map(records.map((record) => [record.date, record]));
  return Array.from({ length: days }, (_, index) => {
    const time = end - (days - index - 1) * 86400000;
    const date = new Date(time).toISOString().slice(0, 10);
    const recent = Array.from({ length: 7 }, (_, offset) => byDate.get(new Date(time - offset * 86400000).toISOString().slice(0, 10))?.[metric])
      .filter((value): value is number => value !== null && value !== undefined);
    return { date, intake: byDate.get(date)?.[metric] ?? null, target: byDate.get(date)?.[target] ?? null,
      average: recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : null, recordedDays: recent.length };
  });
}
