"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { Check, ChevronDown, FileInput, Pencil, RotateCw, Trash2, X } from "lucide-react";
import { useToday } from "@/lib/tracker-client";
import { formatNutrition, nutritionMetrics, nutritionSchema, nutritionSeries, parseNutritionLine, type NutritionRecord, type NutritionResponse, type NutritionValues } from "@/lib/nutrition";

const NutritionChart = dynamic(() => import("./NutritionChart"), { ssr: false, loading: () => <div className="weight-chart loading-state">그래프 준비 중</div> });
type Draft = { record: NutritionValues; sourceText: string | null; expectedUpdatedAt: string | null; editing: boolean };

export default function NutritionManager() {
  const today = useToday();
  const { data, error, isLoading, isValidating, mutate } = useSWR<NutritionResponse>("/api/nutrition");
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [limit, setLimit] = useState(15);
  const editor = useRef<HTMLFormElement>(null);
  const records = useMemo(() => [...(data?.records ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [data]);
  const latest = records.filter((record) => record.date <= today).at(-1);
  const summary = today ? nutritionSeries(records, today, 1, "calories")[0] : null;
  const existing = draft ? records.find((record) => record.date === draft.record.date) : undefined;

  function prepare(event: FormEvent) {
    event.preventDefault(); setMessage(""); setFailed(false);
    try {
      const record = parseNutritionLine(text);
      setDraft({ record, sourceText: text.trim(), expectedUpdatedAt: records.find((row) => row.date === record.date)?.updatedAt ?? null, editing: false });
    } catch (error) { setDraft(null); setFailed(true); setMessage(error instanceof Error ? error.message : "형식을 확인해 주세요."); }
  }
  async function cacheRecord(record: NutritionRecord) {
    await mutate((current) => ({ ok: true, records: [...(current?.records ?? []).filter((row) => row.date !== record.date), record] }), { revalidate: false });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    const parsed = nutritionSchema.safeParse(draft.record);
    if (!parsed.success) { setFailed(true); setMessage("날짜와 수치를 확인해 주세요."); return; }
    if (existing && !window.confirm(draft.record.date + " 기록을 수정할까요?\n기존 섭취: " + formatNutrition(existing.calories) + " kcal\n변경 섭취: " + formatNutrition(draft.record.calories) + " kcal")) return;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/nutrition", { method: "PUT", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ record: parsed.data, sourceText: draft.sourceText, expectedUpdatedAt: draft.expectedUpdatedAt }) });
      if (response.status === 401) { window.location.replace("/auth"); throw new Error("다시 로그인해 주세요."); }
      const result = await response.json();
      if (response.status === 409) {
        await mutate();
        if (result.current) await cacheRecord(result.current);
        setDraft({ ...draft, expectedUpdatedAt: result.current?.updatedAt ?? null });
        throw new Error("다른 곳에서 기록이 변경됐습니다. 기록 내역의 최신 값을 확인한 뒤 다시 저장해 주세요.");
      }
      if (!response.ok) throw new Error("저장하지 못했습니다. 입력값과 연결 상태를 확인해 주세요.");
      await cacheRecord(result.record);
      setDraft(null); setText(""); setMessage(parsed.data.date + " 마감 기록을 저장했습니다.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function remove(record: NutritionRecord) {
    if (busy || !window.confirm(record.date + " 칼로리·탄단지 기록을 삭제할까요?")) return;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/nutrition", { method: "DELETE", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ date: record.date, expectedUpdatedAt: record.updatedAt }) });
      if (response.status === 401) { window.location.replace("/auth"); throw new Error("다시 로그인해 주세요."); }
      if (!response.ok) { if (response.status === 409) await mutate(); throw new Error("삭제하지 못했습니다. 최신 기록과 연결 상태를 확인해 주세요."); }
      await mutate((current) => ({ ok: true, records: (current?.records ?? []).filter((row) => row.id !== record.id) }), { revalidate: false });
      if (draft?.record.date === record.date) setDraft(null);
      setMessage(record.date + " 섭취 기록을 삭제했습니다.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <div className="screen-content nutrition-screen">
    <div className="page-heading"><div><p className="eyebrow">NUTRITION</p><h1>칼로리 기록</h1></div>
      <button className="icon-button" aria-label="칼로리 새로고침" title="칼로리 새로고침" disabled={busy || isValidating} onClick={() => void mutate()}><RotateCw size={18} className={isValidating ? "spin" : ""} /></button>
    </div>
    {error && <div className="notice error" role="alert">기록을 불러오지 못했습니다. <button onClick={() => void mutate()}>다시 시도</button></div>}
    <div className="nutrition-summary" aria-busy={isLoading}>
      <div><span className="metric-label">최근 섭취</span><strong>{formatNutrition(latest?.calories ?? null)}<small>kcal</small></strong><span className="metric-detail">{latest?.date ?? "기록 없음"}</span></div>
      <div><span className="metric-label">7일 평균</span><strong>{formatNutrition(summary?.average ?? null)}<small>kcal</small></strong><span className="metric-detail">{summary?.recordedDays ?? 0}일 기록</span></div>
    </div>
    <form className="nutrition-import" onSubmit={prepare}>
      <label htmlFor="nutrition-line">마감 기록</label>
      <textarea id="nutrition-line" className="field nutrition-text" value={text} maxLength={2000} spellCheck={false} disabled={busy} placeholder="식단마감|날짜=YYYY-MM-DD|칼로리=..." onChange={(event) => { setText(event.target.value); setDraft(null); setMessage(""); }} />
      <button className="btn btn-primary" type="submit" disabled={busy || !text.trim() || !data}><FileInput size={17} />기록 확인</button>
    </form>
    {draft && <form ref={editor} className="nutrition-editor section-block" onSubmit={save}>
      <div className="section-heading"><h2>{existing ? "마감 기록 수정" : "마감 기록 확인"}</h2><button className="icon-button" aria-label="마감 수정 취소" title="마감 수정 취소" type="button" disabled={busy} onClick={() => setDraft(null)}><X size={17} /></button></div>
      <label>기록 날짜<input className="field" type="date" required disabled={busy || draft.editing} value={draft.record.date} onChange={(event) => setDraft({ ...draft, record: { ...draft.record, date: event.target.value }, expectedUpdatedAt: records.find((row) => row.date === event.target.value)?.updatedAt ?? null })} /></label>
      <div className="nutrition-inputs">
        <span /><span>섭취</span><span>그날 목표</span>
        {nutritionMetrics.map((metric) => <div className="nutrition-input-row" key={metric.key}>
          <span>{metric.label}<small>{metric.unit}</small></span>
          {[metric.key, metric.target].map((key) => <input key={key} className="field" aria-label={metric.label + (key === metric.key ? " 섭취" : " 목표")} type="number" inputMode="decimal" step="any" min="0" max="100000" disabled={busy} placeholder="미상" value={draft.record[key] ?? ""} onChange={(event) => setDraft({ ...draft, record: { ...draft.record, [key]: event.target.value === "" ? null : Number(event.target.value) } })} />)}
        </div>)}
      </div>
      {existing && <p className="form-message">기존 기록: {existing.date} · {formatNutrition(existing.calories)} kcal</p>}
      <button className="btn btn-primary" disabled={busy || !data} type="submit"><Check size={17} />{busy ? "저장 중" : existing ? "마감 수정 저장" : "마감 저장"}</button>
    </form>}
    {message && <p className={failed ? "form-message error-text" : "form-message"} role={failed ? "alert" : "status"}>{message}</p>}
    {today && <NutritionChart records={records} today={today} />}
    <section className="section-block" aria-labelledby="nutrition-history-title">
      <div className="section-heading"><h2 id="nutrition-history-title">마감 내역 <span className="count">{records.length}</span></h2></div>
      {isLoading ? <div className="loading-state">기록을 불러오는 중입니다.</div> : !records.length ? <div className="empty-state">아직 마감 기록이 없습니다.</div> :
        <ul className="nutrition-history">{[...records].reverse().slice(0, limit).map((record) => <li key={record.id}>
          <div className="nutrition-history-heading"><div><time dateTime={record.date}>{record.date.replaceAll("-", ".")}</time><strong>{formatNutrition(record.calories)} <small>kcal</small></strong></div>
            <div className="row-actions"><button className="icon-button" aria-label={record.date + " 마감 수정"} title="마감 수정" disabled={busy} onClick={() => {
              setDraft({ record: nutritionSchema.strip().parse(record), sourceText: record.sourceText, expectedUpdatedAt: record.updatedAt, editing: true });
              setMessage(""); requestAnimationFrame(() => editor.current?.scrollIntoView({ block: "start", behavior: "instant" }));
            }}><Pencil size={16} /></button>
              <button className="icon-button" aria-label={record.date + " 마감 삭제"} title="마감 삭제" disabled={busy} onClick={() => void remove(record)}><Trash2 size={16} /></button></div>
          </div>
          <details><summary>섭취 · 목표</summary><table className="nutrition-table"><thead><tr><th>항목</th><th>섭취</th><th>목표</th><th>차이</th></tr></thead><tbody>{nutritionMetrics.map((metric) => {
            const value = record[metric.key], target = record[metric.target];
            const difference = value !== null && target !== null ? value - target : null;
            return <tr key={metric.key}><th>{metric.label}<small>{metric.unit}</small></th><td>{formatNutrition(value)}</td><td>{formatNutrition(target)}</td><td>{difference !== null && difference > 0 ? "+" : ""}{formatNutrition(difference)}</td></tr>;
          })}</tbody></table>
            {record.sourceText && <details className="nutrition-source"><summary>가져온 원문</summary><p>{record.sourceText}</p></details>}
          </details>
        </li>)}</ul>}
      {records.length > limit && <button className="btn btn-ghost more-button" onClick={() => setLimit((current) => current + 30)}>더 보기<ChevronDown size={16} /></button>}
    </section>
  </div>;
}
