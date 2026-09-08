"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shiftDate, type WeighIn } from "@/lib/tracker-client";

export default function GraphView({ rows, today }: { rows: WeighIn[]; today: string }) {
  const [range, setRange] = useState(90);
  const [mode, setMode] = useState<"day" | "week">("day");
  const chartRows = useMemo(() => {
    const filtered = rows.filter((row) => (!range || row.date >= shiftDate(today, -range + 1)) && row.date <= today);
    if (mode === "day") return filtered.map((row) => ({ date: row.date, value: row.weight_kg }));
    const weeks = new Map<string, number[]>();
    for (const row of filtered) {
      const day = new Date(row.date + "T12:00:00Z").getUTCDay();
      const key = shiftDate(row.date, -((day + 6) % 7));
      weeks.set(key, [...(weeks.get(key) ?? []), row.weight_kg]);
    }
    return Array.from(weeks, ([date, values]) => ({ date, value: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)) }));
  }, [rows, range, mode, today]);

  return (
    <section className="section-block" aria-labelledby="weight-chart-title">
      <div className="section-heading chart-heading">
        <h2 id="weight-chart-title">체중 추이</h2>
        <div className="segmented" role="group" aria-label="그래프 기간">
          {[{ label: "1개월", value: 30 }, { label: "3개월", value: 90 }, { label: "전체", value: 0 }].map((item) =>
            <button key={item.value} type="button" aria-pressed={range === item.value} onClick={() => setRange(item.value)}>{item.label}</button>)}
        </div>
      </div>
      <div className="chart-meta">
        <span><i className="swatch" style={{ background: "#168c89" }} />{mode === "day" ? "일별 체중" : "주간 평균"} <span className="muted">· kg</span></span>
        <div className="segmented compact" role="group" aria-label="그래프 집계">
          <button type="button" aria-pressed={mode === "day"} onClick={() => setMode("day")}>일별</button>
          <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")}>주별</button>
        </div>
      </div>
      <div className="weight-chart" role="img" aria-label={chartRows.length ? "체중 추이, " + chartRows.length + "개 기록" : "체중 기록 없음"}>
        {chartRows.length ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartRows} margin={{ top: 18, right: 18, bottom: 4, left: -18 }} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="#e6ebeb" strokeDasharray="3 5" />
              <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5).replace("-", ".")} minTickGap={34}
                tick={{ fontSize: 11, fill: "#728080" }} axisLine={false} tickLine={false} dy={10} />
              <YAxis domain={["dataMin - 0.8", "dataMax + 0.8"]} tickFormatter={(value: number) => value.toFixed(1)}
                width={65} tick={{ fontSize: 11, fill: "#728080" }} axisLine={false} tickLine={false} tickCount={5} />
              <Tooltip labelFormatter={(value) => String(value)} formatter={(value) => [Number(value).toFixed(1) + " kg", mode === "day" ? "체중" : "주간 평균"]}
                contentStyle={{ border: "1px solid #dbe3e2", borderRadius: 8, fontSize: 13 }} />
              <Line type="monotone" dataKey="value" stroke="#168c89" strokeWidth={2.5}
                dot={chartRows.length < 40 ? { r: 3, strokeWidth: 2, fill: "#fff" } : false} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="empty-state">이 기간에 기록된 체중이 없습니다.</div>}
      </div>
    </section>
  );
}
