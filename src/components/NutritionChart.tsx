"use client";

import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNutrition, nutritionMetrics, nutritionSeries, type NutritionMetric, type NutritionRecord } from "@/lib/nutrition";

export default function NutritionChart({ records, today }: { records: NutritionRecord[]; today: string }) {
  const [range, setRange] = useState(30);
  const [metric, setMetric] = useState<NutritionMetric>("calories");
  const selected = nutritionMetrics.find((item) => item.key === metric)!;
  const rows = useMemo(() => nutritionSeries(records, today, range, metric), [records, today, range, metric]);
  const hasRecords = rows.some((row) => row.intake !== null || row.target !== null);
  return <section className="section-block" aria-labelledby="nutrition-chart-title">
    <div className="section-heading chart-heading"><h2 id="nutrition-chart-title">섭취 추이</h2>
      <div className="segmented" role="group" aria-label="섭취 그래프 기간">{[7, 30, 90].map((days) =>
        <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(days)}>{days}일</button>)}</div>
    </div>
    <div className="segmented nutrition-metrics" role="group" aria-label="영양소 선택">{nutritionMetrics.map((item) =>
      <button key={item.key} type="button" aria-pressed={metric === item.key} onClick={() => setMetric(item.key)}>{item.label}</button>)}</div>
    <div className="nutrition-legend"><span><i className="swatch" style={{ background: selected.color }} />섭취 ({selected.unit})</span><span><i className="swatch" style={{ background: "#83918e" }} />목표</span><span><i className="swatch" style={{ background: "#126c60" }} />7일 평균</span></div>
    <div className="weight-chart nutrition-chart" role="img" aria-label={selected.label + " 섭취 추이"}>
      {hasRecords ? <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 6, left: -12 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#e6ebeb" strokeDasharray="3 5" />
          <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5).replace("-", ".")} minTickGap={28} tick={{ fontSize: 11, fill: "#728080" }} axisLine={false} tickLine={false} dy={8} />
          <YAxis domain={[0, "auto"]} width={68} tickFormatter={(value: number) => formatNutrition(value)} tick={{ fontSize: 11, fill: "#728080" }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(value) => String(value)} formatter={(value, name) => [formatNutrition(Number(value)) + " " + selected.unit, name]}
            contentStyle={{ border: "1px solid #dbe3e2", borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="intake" name="섭취" fill={selected.color} maxBarSize={24} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line dataKey="target" name="목표" type="stepAfter" stroke="#83918e" strokeDasharray="4 4" dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="average" name="7일 평균" type="monotone" stroke="#126c60" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer> : <div className="empty-state">이 기간에 기록된 {selected.label} 수치가 없습니다.</div>}
    </div>
  </section>;
}
