"use client";

import { useState } from "react";
import useSWR from "swr";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { exerciseMetrics, setTypes, recordedSets, type WorkoutHistory } from "@/lib/workouts";
import { shiftDate } from "@/lib/tracker-client";
import type { Exercise } from "@/lib/exercise-catalog";

export const historyKey = (id: string, today: string) => today && id ? "/api/workouts/history?exerciseId=" + encodeURIComponent(id) + "&through=" + today : null;
export function useExerciseHistory(id: string, today: string) {
  return useSWR<{ history: WorkoutHistory[] }>(historyKey(id, today));
}

type Metric = "weight" | "reps" | "volume";
const labels: Record<Metric, string> = { weight: "최고 무게", reps: "같은 무게의 횟수", volume: "총 볼륨" };
const units: Record<Metric, string> = { weight: "kg", reps: "회", volume: "kg·회" };
export default function WorkoutProgress({ exercises, selected, onSelect, today }: { exercises: Exercise[]; selected: string; onSelect: (id: string) => void; today: string }) {
  const { data, error, isLoading, mutate } = useExerciseHistory(selected, today);
  const [metric, setMetric] = useState<Metric>("weight");
  const [range, setRange] = useState(90);
  const [comparison, setComparison] = useState<{ id: string; weight: number } | null>(null);
  const allHistory = data?.history ?? [];
  const history = allHistory.filter((row) => !range || row.date >= shiftDate(today, -range));
  const weights = [...new Set(allHistory.flatMap((row) => recordedSets(row.entry).map((set) => set.weight)))].sort((a, b) => b - a);
  const latest = allHistory.at(-1);
  const compareWeight = comparison?.id === selected ? comparison.weight : latest ? exerciseMetrics(latest.entry)!.weight : weights[0] ?? 0;
  const points = history.map((row) => {
    const values = exerciseMetrics(row.entry)!;
    const matching = recordedSets(row.entry).filter((set) => set.weight === compareWeight);
    return { date: row.date, ...values, reps: matching.length ? Math.max(...matching.map((set) => set.reps)) : null };
  });
  const valid = points.filter((point) => point[metric] !== null);
  const first = valid[0]?.[metric];
  const last = valid.at(-1)?.[metric];
  const delta = first != null && last != null && valid.length > 1 ? last - first : null;
  return <section className="section-block workout-progress" id="workout-progress" aria-labelledby="progress-title">
    <div className="section-heading"><div><p className="eyebrow">PROGRESSIVE OVERLOAD</p><h2 id="progress-title"><TrendingUp size={20} />종목별 성장</h2></div><span className="muted">저장한 기록 기준</span></div>
    <label>분석할 운동<select className="field" value={selected} onChange={(event) => onSelect(event.target.value)}>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
    <div className="progress-controls"><div className="segmented">{(Object.keys(labels) as Metric[]).map((key) => <button type="button" key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>{labels[key]}</button>)}</div>
      <select className="field" aria-label="그래프 기간" value={range} onChange={(event) => setRange(Number(event.target.value))}><option value={30}>최근 30일</option><option value={90}>최근 90일</option><option value={180}>최근 180일</option><option value={0}>전체 기간</option></select></div>
    {metric === "reps" && <label className="comparison-weight">비교할 무게<select className="field" aria-label="횟수 비교 무게" value={compareWeight} onChange={(event) => setComparison({ id: selected, weight: Number(event.target.value) })} disabled={!weights.length}>
      {weights.map((weight) => <option key={weight} value={weight}>{weight} kg{weight === 0 ? " (맨몸 / 추가 중량 없음)" : ""}</option>)}{!weights.length && <option value={0}>기록 없음</option>}</select></label>}
    <div className="progress-summary"><div><span className="metric-label">최근 {labels[metric]}</span><strong>{last == null ? "—" : last.toLocaleString()}<small>{units[metric]}</small></strong></div>
      <div><span className="metric-label">기간 내 첫 기록 대비</span><strong className={delta !== null && delta > 0 ? "positive" : ""}>{delta === null ? "—" : (delta > 0 ? "+" : "") + Number(delta.toFixed(2)).toLocaleString()}<small>{delta !== null ? units[metric] : "2회부터 비교"}</small></strong></div>
      <div><span className="metric-label">비교 가능한 기록</span><strong>{valid.length}<small>회</small></strong></div></div>
    {error ? <div role="alert" className="notice error">성장 기록을 불러오지 못했습니다.<button type="button" onClick={() => void mutate()}>다시 시도</button></div> : <div className="progress-chart" role="img" aria-label={labels[metric] + " 추이 그래프. 아래 표에서 수치를 확인할 수 있습니다."}>
      {isLoading ? <p className="empty-state">성장 기록을 불러오는 중입니다.</p> : !valid.length ? <div className="progress-empty"><TrendingUp size={32} /><h3>첫 기록이 성장의 시작입니다.</h3><p>{metric === "reps" ? "이 무게로 기록한 세트가 없습니다." : "무게와 횟수를 입력하고 저장하면 여기에 표시돼요."}</p></div> :
        <ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 20, right: 18, left: 0, bottom: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#2b3a53" strokeDasharray="3 4" /><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5).replace("-", "/")} tick={{ fontSize: 11, fill: "#a1aec5" }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis width={54} tick={{ fontSize: 11, fill: "#a1aec5" }} axisLine={false} tickLine={false} domain={[0, "auto"]} allowDecimals={metric !== "reps"} />
          <Tooltip labelFormatter={(date) => String(date)} formatter={(value) => [Number(value).toLocaleString() + " " + units[metric], labels[metric]]} contentStyle={{ borderRadius: 12, border: "1px solid #e3e9e6", fontSize: 12 }} />
          <Line type="linear" dataKey={metric} stroke="#80a5ff" strokeWidth={2.5} dot={{ r: 4, fill: "white", strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
        </LineChart></ResponsiveContainer>}
    </div>}
    <p className="workout-help">{metric === "weight" ? "각 운동일의 가장 무거운 세트입니다. 횟수도 함께 보며 변화를 확인하세요." : metric === "reps" ? "선택한 무게로 수행한 세트 중 가장 많은 횟수입니다. 해당 무게의 기록이 없는 날은 비워 둡니다." : "총 볼륨 = 모든 세트의 무게 × 횟수 합계. 세트 수가 늘어도 증가하므로 무게·횟수와 함께 보세요."} 맨몸은 추가 중량을 0kg으로 기록하며, 미래 날짜와 빈 세트는 그래프에서 제외됩니다.</p>
    {history.length > 0 && <details className="progress-history"><summary>세부 기록 보기 · {history.length}회</summary><div className="table-scroll"><table><thead><tr><th>날짜</th><th>최고 무게 × 횟수</th><th>세트</th><th>총 볼륨</th></tr></thead><tbody>{[...history].reverse().map((row) => {
      const metrics = exerciseMetrics(row.entry)!;
      return <tr key={row.date}><th scope="row">{row.date}<details><summary>세트 / 설정</summary><p>{recordedSets(row.entry).map((set) => set.weight + "kg × " + set.reps + "회" + (set.type && set.type !== "normal" ? " (" + setTypes[set.type] + ")" : "")).join(" · ")}</p><p>{row.entry.settings.filter((item) => item.value).map((item) => item.label + ": " + item.value).join(" · ") || "설정 없음"}</p></details></th><td>{metrics.weight} kg × {metrics.reps}회</td><td>{metrics.sets}</td><td>{metrics.volume.toLocaleString()}</td></tr>;
    })}</tbody></table></div></details>}
  </section>;
}
