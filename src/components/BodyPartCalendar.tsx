"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { allBodyParts, currentBodyParts, legacyBodyParts, recommendPart, type BodyPartKey, type WorkoutLog, type PartLastDate } from "@/lib/body-parts";
import { elapsedDays, useToday } from "@/lib/tracker-client";

type WorkoutResponse = { logs: WorkoutLog[]; last_dates: PartLastDate[] };
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const partStyle = (color: string) => ({ "--part-color": color }) as CSSProperties;

export default function BodyPartCalendar() {
  const today = useToday();
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  const month = viewMonth ?? today.slice(0, 7);
  const { data, error, isLoading, isValidating, mutate } = useSWR<WorkoutResponse>(today ? "/api/workout-parts?month=" + month + "&today=" + today : null);
  const logsByDate = useMemo(() => {
    const result = new Map<string, BodyPartKey[]>();
    for (const log of data?.logs ?? []) result.set(log.date, [...(result.get(log.date) ?? []), log.body_part]);
    return result;
  }, [data]);
  const recommended = data ? recommendPart(data.last_dates) : null;
  const lastDate = recommended ? data?.last_dates.find((part) => part.body_part === recommended.key)?.date : null;
  const counts = new Map<BodyPartKey, number>();
  for (const log of data?.logs ?? []) counts.set(log.body_part, (counts.get(log.body_part) ?? 0) + 1);
  const maxCount = Math.max(1, ...counts.values());
  const monthDate = new Date((month || "2000-01") + "-01T12:00:00Z");
  const year = monthDate.getUTCFullYear();
  const monthIndex = monthDate.getUTCMonth();
  const startDay = monthDate.getUTCDay();
  const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  function changeMonth(direction: number) {
    const next = new Date(monthDate);
    next.setUTCMonth(next.getUTCMonth() + direction);
    setViewMonth(next.toISOString().slice(0, 7));
  }

  return <div className="screen-content">
    <div className="page-heading"><div><p className="eyebrow">TRAINING JOURNAL</p><h1>운동 기록</h1></div>
      <button className="icon-button" aria-label="운동 기록 새로고침" disabled={isValidating} onClick={() => void mutate()}><RotateCw size={18} className={isValidating ? "spin" : ""} /></button>
    </div>
    {error && <div className="notice error" role="alert">기록을 불러오지 못했습니다. <button onClick={() => void mutate()}>다시 시도</button></div>}
    <div className="calendar-layout">
      <section className="calendar-section" aria-labelledby="calendar-title">
        <div className="section-heading"><h2 id="calendar-title">{today ? year + "년 " + (monthIndex + 1) + "월" : "캘린더"}</h2>
          <div className="calendar-actions"><button className="icon-button" aria-label="이전 달" disabled={!today} onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
            <button className="today-button" onClick={() => setViewMonth(today.slice(0, 7))}>오늘</button>
            <button className="icon-button" aria-label="다음 달" disabled={!today} onClick={() => changeMonth(1)}><ChevronRight size={20} /></button></div>
        </div>
        <div className="calendar-grid" aria-busy={isLoading}>
          {weekdays.map((day) => <div className="weekday" key={day}>{day}</div>)}
          {today && Array.from({ length: Math.ceil((startDay + totalDays) / 7) * 7 }, (_, index) => {
            const day = index - startDay + 1;
            if (day < 1 || day > totalDays) return <div key={index} className="calendar-blank" />;
            const date = month + "-" + String(day).padStart(2, "0");
            const parts = (logsByDate.get(date) ?? []).map((key) => allBodyParts.find((part) => part.key === key)!).filter(Boolean);
            return <Link prefetch={false} href={"/workouts/" + date} key={date} className="calendar-day" aria-label={date + (parts.length ? " " + parts.map((part) => part.label).join(", ") : " 기록 없음")} aria-current={date === today ? "date" : undefined}>
              <span className="day-number">{day}</span><span className="day-parts" aria-hidden="true">{parts.slice(0, 2).map((part) => <span key={part.key} className="day-part" style={partStyle(part.color)}>{"calendarLabel" in part ? part.calendarLabel : part.label}</span>)}</span>
            </Link>;
          })}
        </div>
        <p className="calendar-caption" role="status">{isLoading ? "기록을 불러오는 중입니다." : logsByDate.size + "일 운동 · 날짜를 눌러 운동을 기록하세요."}</p>
      </section>
      <aside className="training-aside">
        <div className="recommendation" style={partStyle(recommended?.color ?? "#8b9696")}><div><span className="metric-label">오늘 추천</span><strong>{recommended?.label ?? "기록 확인 중"}</strong></div>
          <p>{recommended ? lastDate ? "마지막 운동 " + elapsedDays(lastDate, today) + "일 전" : "아직 기록이 없는 부위" : ""}</p></div>
      </aside>
    </div>
    <section className="section-block" aria-labelledby="part-frequency-title"><div className="section-heading"><h2 id="part-frequency-title">이달의 부위별 빈도</h2><span className="muted">대표 부위 기준</span></div>
      <div className="frequency-list">{[...currentBodyParts, ...legacyBodyParts.filter((part) => counts.has(part.key))].map((part) => <div className="frequency-row" key={part.key}>
        <span><i className="swatch" style={{ background: part.color }} />{part.label}</span><div className="frequency-track"><div style={{ background: part.color, width: ((counts.get(part.key) ?? 0) / maxCount * 100) + "%" }} /></div><strong>{counts.get(part.key) ?? 0}<small>회</small></strong>
      </div>)}</div>
    </section>
  </div>;
}
