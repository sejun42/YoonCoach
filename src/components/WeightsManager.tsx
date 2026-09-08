"use client";

import { useMemo, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { Check, ChevronDown, Pencil, Plus, RotateCw, Trash2, X } from "lucide-react";
import { requestJson, shiftDate, useToday, type WeighIn, type WeightResponse, type PlanResponse } from "@/lib/tracker-client";

const GraphView = dynamic(() => import("./GraphView"), { ssr: false, loading: () => <div className="weight-chart loading-state">그래프 준비 중</div> });

export default function WeightsManager() {
  const today = useToday();
  const { data, error, isLoading, isValidating, mutate } = useSWR<WeightResponse>("/api/weighins");
  const { data: planData } = useSWR<PlanResponse>("/api/plan/current");
  const [date, setDate] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [edit, setEdit] = useState<{ id: string; value: string } | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(15);
  const rows = useMemo(() => [...(data?.weighIns ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [data]);
  const pastRows = rows.filter((row) => row.date <= today);
  const latest = pastRows.at(-1);
  const previous = pastRows.at(-2);
  const change = latest && previous ? latest.weight_kg - previous.weight_kg : null;
  const recent = pastRows.filter((row) => row.date >= shiftDate(today || "2000-01-01", -6));
  const average = recent.length ? recent.reduce((sum, row) => sum + row.weight_kg, 0) / recent.length : null;
  const visibleRows = rows.filter((row) => (!from || row.date >= from) && (!to || row.date <= to)).reverse();
  const selectedDate = date ?? today;
  const existing = rows.some((row) => row.date === selectedDate);
  const plan = planData?.plan;

  function validWeight(value: string) {
    const number = Number(value);
    if (!value || !Number.isFinite(number) || number < 30 || number > 300) throw new Error("체중은 30~300kg 사이로 입력해 주세요.");
    return number;
  }
  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setMessage(""); setFailed(false);
    try { await action(); setMessage(success); }
    catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const result = await requestJson<{ weighIn: WeighIn }>("/api/weighins", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, weight_kg: validWeight(weight) })
      });
      await mutate((current) => ({ ok: true, weighIns: [...(current?.weighIns ?? []).filter((row) => row.date !== result.weighIn.date), result.weighIn] }), { revalidate: false });
      setWeight("");
    }, existing ? "체중 기록을 수정했습니다." : "체중 기록을 저장했습니다.");
  }
  async function saveEdit(row: WeighIn) {
    if (!edit) return;
    const input = edit.value;
    await run(async () => {
      const value = validWeight(input);
      await requestJson("/api/weighins/" + row.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weight_kg: value }) });
      await mutate((current) => ({ ok: true, weighIns: (current?.weighIns ?? []).map((item) => item.id === row.id ? { ...item, weight_kg: value } : item) }), { revalidate: false });
      setEdit(null);
    }, "체중 기록을 수정했습니다.");
  }
  async function remove(row: WeighIn) {
    if (!window.confirm(row.date + " 체중 기록을 삭제할까요?")) return;
    await run(async () => {
      await requestJson("/api/weighins/" + row.id, { method: "DELETE" });
      await mutate((current) => ({ ok: true, weighIns: (current?.weighIns ?? []).filter((item) => item.id !== row.id) }), { revalidate: false });
    }, "체중 기록을 삭제했습니다.");
  }

  return (
    <div className="screen-content">
      <div className="page-heading">
        <div><p className="eyebrow">WEIGHT</p><h1>체중 기록</h1></div>
        <button className="icon-button" type="button" aria-label="체중 새로고침" title="체중 새로고침" disabled={isValidating || busy} onClick={() => void mutate()}><RotateCw size={18} className={isValidating ? "spin" : ""} /></button>
      </div>
      {error && <div className="notice error" role="alert">체중 기록을 불러오지 못했습니다. <button onClick={() => void mutate()}>다시 시도</button></div>}
      <div className="metric-row" aria-busy={isLoading}>
        <div><span className="metric-label">최근 체중</span><strong className="metric-value">{latest?.weight_kg.toFixed(2) ?? "-"}<small>kg</small></strong><span className="metric-detail">{latest?.date ?? "기록 없음"}</span></div>
        <div><span className="metric-label">최근 기록 대비</span><strong className="metric-value secondary">{change === null ? "-" : (change > 0 ? "+" : "") + change.toFixed(2)}<small>kg</small></strong><span className="metric-detail">{previous?.date ?? "이전 기록 없음"}</span></div>
        <div><span className="metric-label">7일 평균</span><strong className="metric-value secondary">{average?.toFixed(2) ?? "-"}<small>kg</small></strong><span className="metric-detail">{recent.length}일 기록</span></div>
      </div>
      {plan?.goalType === "target_weight" && <div className="goal-line"><span>목표 체중 <b>{plan.goalValue.toFixed(2)} kg</b></span><span>{plan.endDate.slice(0, 10)}까지</span></div>}
      <form className="record-form" onSubmit={save}>
        <div className="form-title"><Plus size={18} /><h2>공복 체중</h2></div>
        <div className="record-fields">
          <label>날짜<input className="field" type="date" value={selectedDate} required disabled={busy || !today} onChange={(event) => setDate(event.target.value)} /></label>
          <label>체중 (kg)<input className="field" type="number" inputMode="decimal" min="30" max="300" step="0.01" placeholder="0.00" required value={weight} disabled={busy || isLoading || !data} onChange={(event) => setWeight(event.target.value)} /></label>
          <button className="btn btn-primary" type="submit" disabled={busy || isLoading || !data || !selectedDate}><Check size={17} />{busy ? "저장 중" : existing ? "수정 저장" : "기록 저장"}</button>
        </div>
        {message && <p className={failed ? "form-message error-text" : "form-message"} role={failed ? "alert" : "status"}>{message}</p>}
      </form>
      {today && <GraphView rows={rows} today={today} />}
      <section className="section-block" aria-labelledby="weight-history-title">
        <div className="section-heading"><h2 id="weight-history-title">기록 내역 <span className="count">{visibleRows.length}</span></h2></div>
        <div className="date-filter">
          <label><span>시작일</span><input className="field" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setLimit(15); }} /></label>
          <label><span>종료일</span><input className="field" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setLimit(15); }} /></label>
          {(from || to) && <button className="icon-button" type="button" aria-label="기간 초기화" title="기간 초기화" onClick={() => { setFrom(""); setTo(""); }}><X size={17} /></button>}
        </div>
        {isLoading ? <div className="loading-state" role="status">체중 기록을 불러오는 중입니다.</div> : !visibleRows.length ? <div className="empty-state">아직 기록이 없습니다.</div> :
          <ul className="record-list">{visibleRows.slice(0, limit).map((row) => (
            <li key={row.id}>
              <time dateTime={row.date}>{row.date.replaceAll("-", ".")}</time>
              {edit?.id === row.id ?
                <form className="row-edit" onSubmit={(event) => { event.preventDefault(); void saveEdit(row); }}>
                  <input className="field" aria-label={row.date + " 수정 체중"} type="number" inputMode="decimal" min="30" max="300" step="0.01" value={edit.value} disabled={busy} autoFocus onChange={(event) => setEdit({ id: row.id, value: event.target.value })} />
                  <button className="icon-button" type="submit" title="수정 저장" aria-label="수정 저장" disabled={busy}><Check size={17} /></button>
                  <button className="icon-button" type="button" title="수정 취소" aria-label="수정 취소" disabled={busy} onClick={() => setEdit(null)}><X size={17} /></button>
                </form> :
                <><strong>{row.weight_kg.toFixed(2)} <span className="muted">kg</span></strong><div className="row-actions">
                  <button className="icon-button" type="button" title="기록 수정" aria-label={row.date + " 체중 수정"} disabled={busy} onClick={() => setEdit({ id: row.id, value: String(row.weight_kg) })}><Pencil size={16} /></button>
                  <button className="icon-button" type="button" title="기록 삭제" aria-label={row.date + " 체중 삭제"} disabled={busy} onClick={() => void remove(row)}><Trash2 size={16} /></button>
                </div></>}
            </li>
          ))}</ul>}
        {visibleRows.length > limit && <button className="btn btn-ghost more-button" type="button" onClick={() => setLimit((value) => value + 30)}>더 보기<ChevronDown size={16} /></button>}
      </section>
    </div>
  );
}
