"use client";

import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Check, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { allBodyParts, currentBodyParts, legacyBodyParts, recommendPart, type BodyPartKey, type WorkoutLog, type PartLastDate } from "@/lib/body-parts";
import { elapsedDays, requestJson, useToday } from "@/lib/tracker-client";

type WorkoutResponse = { ok: true; month: string | null; logs: WorkoutLog[]; last_dates: PartLastDate[] };
type SaveResponse = Omit<WorkoutResponse, "month"> & { date: string; body_parts: BodyPartKey[] };
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const partStyle = (color: string) => ({ "--part-color": color }) as CSSProperties;

export default function BodyPartCalendar() {
  const today = useToday();
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  const selectedDate = selected ?? today;
  const month = viewMonth ?? today.slice(0, 7);
  const key = today ? "/api/workout-parts?month=" + month + "&today=" + today : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<WorkoutResponse>(key);
  const { mutate: mutateCache } = useSWRConfig();
  const [draft, setDraft] = useState<{ date: string; parts: BodyPartKey[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const editorRef = useRef<HTMLFormElement>(null);
  const editorInput = useRef<HTMLInputElement>(null);
  const logsByDate = useMemo(() => {
    const result = new Map<string, BodyPartKey[]>();
    for (const log of data?.logs ?? []) result.set(log.date, [...(result.get(log.date) ?? []), log.body_part]);
    return result;
  }, [data]);
  const storedParts = logsByDate.get(selectedDate) ?? [];
  const selectedParts = draft?.date === selectedDate ? draft.parts : storedParts;
  const dirty = [...selectedParts].sort().join(",") !== [...storedParts].sort().join(",");
  const recommended = data ? recommendPart(data.last_dates) : null;
  const lastDate = recommended ? data?.last_dates.find((part) => part.body_part === recommended.key)?.date : null;
  const counts = new Map<BodyPartKey, number>();
  for (const log of data?.logs ?? []) counts.set(log.body_part, (counts.get(log.body_part) ?? 0) + 1);
  const legacy = legacyBodyParts.filter((part) => counts.has(part.key));
  const maxCount = Math.max(1, ...counts.values());
  const monthDate = new Date((month || "2000-01") + "-01T12:00:00Z");
  const year = monthDate.getUTCFullYear();
  const monthIndex = monthDate.getUTCMonth();
  const startDay = monthDate.getUTCDay();
  const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells = Math.ceil((startDay + totalDays) / 7) * 7;
  const blocked = saving || isLoading || !data || !!error;

  function allowDateChange() {
    return !dirty || window.confirm("저장하지 않은 부위 선택을 취소하고 날짜를 바꿀까요?");
  }
  function chooseDate(date: string, focusEditor = false) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || saving) return;
    if (date !== selectedDate && !allowDateChange()) return;
    if (date !== selectedDate) setDraft(null);
    setSelected(date); setViewMonth(date.slice(0, 7)); setMessage("");
    if (focusEditor) requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      editorInput.current?.focus({ preventScroll: true });
    });
  }
  function changeMonth(direction: number) {
    if (!allowDateChange()) return;
    const next = new Date(monthDate);
    next.setUTCMonth(next.getUTCMonth() + direction);
    const date = next.toISOString().slice(0, 10);
    setDraft(null); setSelected(date); setViewMonth(date.slice(0, 7)); setMessage("");
  }
  function togglePart(part: BodyPartKey) {
    const parts = selectedParts.includes(part) ? selectedParts.filter((item) => item !== part) : [...selectedParts, part];
    setDraft({ date: selectedDate, parts });
    setMessage("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (blocked || !dirty) return;
    const date = selectedDate;
    const parts = [...selectedParts];
    setSaving(true); setMessage(""); setFailed(false);
    try {
      const result = await requestJson<SaveResponse>("/api/workout-parts?today=" + today, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, body_parts: parts })
      });
      // Update all cached months' recommendation without discarding their calendar data.
      await mutateCache((cacheKey) => typeof cacheKey === "string" && cacheKey.startsWith("/api/workout-parts?"),
        (current: WorkoutResponse | undefined) => current ? ({
          ...current, last_dates: result.last_dates,
          logs: current.month === date.slice(0, 7) ? [...current.logs.filter((log) => log.date !== date), ...result.logs] : current.logs
        }) : current, { revalidate: false });
      setDraft(null);
      setMessage(parts.length ? date + " 기록을 저장했습니다." : date + " 기록을 지웠습니다.");
    } catch (e) {
      setFailed(true); setMessage(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally { setSaving(false); }
  }

  return (
    <div className="screen-content">
      <div className="page-heading"><div><p className="eyebrow">TRAINING</p><h1>운동 부위</h1></div>
        <button className="icon-button" title="부위 기록 새로고침" aria-label="부위 기록 새로고침" disabled={isValidating || saving || dirty} onClick={() => void mutate()}><RotateCw size={18} className={isValidating ? "spin" : ""} /></button>
      </div>
      <div className="recommendation" style={partStyle(recommended?.color ?? "#8b9696")}>
        <div><span className="metric-label">오늘 추천</span><strong>{recommended?.label ?? (error ? "확인 불가" : "불러오는 중")}</strong></div>
        <p>{recommended ? lastDate ? "마지막 운동 " + elapsedDays(lastDate, today) + "일 전 · " + lastDate : "아직 기록이 없는 부위" : "운동 기록 확인 중"}</p>
      </div>
      {error && <div className="notice error" role="alert">기록을 불러오지 못했습니다. <button onClick={() => void mutate()}>다시 시도</button></div>}
      <div className="calendar-layout">
        <section className="calendar-section" aria-labelledby="calendar-title">
          <div className="section-heading">
            <h2 id="calendar-title">{today ? year + "년 " + (monthIndex + 1) + "월" : "캘린더"}</h2>
            <div className="calendar-actions">
              <button className="icon-button" aria-label="이전 달" title="이전 달" disabled={saving || !today} onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
              <button className="today-button" disabled={saving || !today} onClick={() => chooseDate(today)}>오늘</button>
              <button className="icon-button" aria-label="다음 달" title="다음 달" disabled={saving || !today} onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="calendar-grid" aria-busy={isLoading}>
            {weekdays.map((day) => <div className="weekday" key={day}>{day}</div>)}
            {Array.from({ length: cells }, (_, index) => {
              const day = index - startDay + 1;
              if (day < 1 || day > totalDays) return <div key={index} className="calendar-blank" />;
              const date = month + "-" + String(day).padStart(2, "0");
              const parts = logsByDate.get(date) ?? [];
              const labels = allBodyParts.filter((part) => parts.includes(part.key)).map((part) => part.label);
              return <button key={date} className="calendar-day" aria-label={date + (labels.length ? " " + labels.join(", ") : " 기록 없음")}
                aria-pressed={date === selectedDate} aria-current={date === today ? "date" : undefined}
                disabled={blocked} onClick={() => chooseDate(date, true)}>
                <span className="day-number">{day}</span>
                <span className="day-parts" aria-hidden="true">{allBodyParts.filter((part) => parts.includes(part.key)).map((part) =>
                  <i key={part.key} className="day-part" style={{ background: part.color }} title={part.label} />)}</span>
              </button>;
            })}
          </div>
          <p className="calendar-caption" role="status">{isLoading ? "기록을 불러오는 중입니다." : logsByDate.size + "일 운동 · " + (data?.logs.length ?? 0) + "개 부위 기록"}</p>
        </section>
        <form className="body-editor" ref={editorRef} onSubmit={save}>
          <div className="section-heading"><h2>부위 기록</h2>{dirty && <span className="unsaved">저장 전</span>}</div>
          <label className="editor-date">날짜<input className="field" type="date" value={selectedDate} disabled={saving || !today} onChange={(event) => chooseDate(event.target.value)} /></label>
          <fieldset disabled={blocked} className="part-options">
            <legend className="sr-only">운동한 부위 선택</legend>
            {currentBodyParts.map((part, index) => <label className="part-option" style={partStyle(part.color)} key={part.key}>
              <input ref={index === 0 ? editorInput : undefined} type="checkbox" checked={selectedParts.includes(part.key)} onChange={() => togglePart(part.key)} />
              <i className="swatch" style={{ background: part.color }} /><span>{part.label}</span>
            </label>)}
            {legacyBodyParts.filter((part) => storedParts.includes(part.key) || selectedParts.includes(part.key)).map((part) =>
              <label className="part-option legacy-option" key={part.key} style={partStyle(part.color)}>
                <input type="checkbox" checked={selectedParts.includes(part.key)} onChange={() => togglePart(part.key)} />
                <i className="swatch" style={{ background: part.color }} /><span>{part.label}</span>
              </label>)}
          </fieldset>
          <div className="editor-footer">
            <button className="text-button" type="button" disabled={blocked || !selectedParts.length} onClick={() => setDraft({ date: selectedDate, parts: [] })}>모두 해제</button>
            <button className="btn btn-primary" type="submit" disabled={blocked || !dirty}><Check size={17} />{saving ? "저장 중" : storedParts.length ? "수정 저장" : "저장"}</button>
          </div>
          {message && <p className={failed ? "form-message error-text" : "form-message"} role={failed ? "alert" : "status"}>{message}</p>}
        </form>
      </div>
      <section className="section-block" aria-labelledby="part-frequency-title">
        <div className="section-heading"><h2 id="part-frequency-title">이달의 부위별 빈도</h2><span className="muted">{today ? monthIndex + 1 + "월" : ""}</span></div>
        <div className="frequency-list">{[...currentBodyParts, ...legacy].map((part) =>
          <div className="frequency-row" key={part.key}><span><i className="swatch" style={{ background: part.color }} />{part.label}</span>
            <div className="frequency-track"><div style={{ background: part.color, width: ((counts.get(part.key) ?? 0) / maxCount * 100) + "%" }} /></div>
            <strong>{counts.get(part.key) ?? 0}<small>회</small></strong>
          </div>)}</div>
      </section>
    </div>
  );
}
