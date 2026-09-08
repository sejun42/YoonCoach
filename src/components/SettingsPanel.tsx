"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import useSWR from "swr";
import { ArrowUpRight, Bell, Check, Download, LogOut, Target } from "lucide-react";
import { requestJson, type Plan, type PlanResponse } from "@/lib/tracker-client";

type Settings = { notify_time: string; coaching_day_of_week: number; coaching_time: string };
type SettingsResponse = { ok: true; settings: Settings | null };
const defaults: Settings = { notify_time: "08:30", coaching_day_of_week: 0, coaching_time: "09:00" };

function PlanEditor({ plan, onSave }: { plan: Plan; onSave: (plan: Plan) => Promise<void> }) {
  const [draft, setDraft] = useState(plan);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const result = await requestJson<PlanResponse>("/api/plan", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_type: draft.goalType, goal_value: draft.goalValue, end_date: draft.endDate.slice(0, 10), preferred_phase: draft.phase })
      });
      if (result.plan) { setDraft(result.plan); await onSave(result.plan); }
      setMessage("목표를 저장했습니다.");
    } catch { setFailed(true); setMessage("목표를 저장하지 못했습니다. 현재 체중과 목표 방향을 확인해 주세요."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save}>
    <fieldset disabled={busy} className="settings-fields">
      <label>목표 기준<select className="field" value={draft.goalType} onChange={(event) => setDraft({ ...draft, goalType: event.target.value as Plan["goalType"] })}>
        <option value="target_weight">목표 체중</option><option value="weekly_rate">주간 변화율</option>
      </select></label>
      <label>{draft.goalType === "target_weight" ? "목표 체중 (kg)" : "주간 변화율 (%)"}<input className="field" type="number" inputMode="decimal" step={draft.goalType === "target_weight" ? "0.01" : "0.1"} min="0.1" value={draft.goalValue || ""} required onChange={(event) => setDraft({ ...draft, goalValue: Number(event.target.value) })} /></label>
      <label>목표일<input className="field" type="date" required value={draft.endDate.slice(0, 10)} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label>
      <label>목표 방향<select className="field" value={draft.phase} onChange={(event) => setDraft({ ...draft, phase: event.target.value as Plan["phase"] })}>
        <option value="calibration">유지 · 조정</option><option value="cut">감량</option><option value="bulk">증량</option>
      </select></label>
    </fieldset>
    <div className="settings-save"><button type="submit" className="btn btn-primary" disabled={busy}><Check size={17} />{busy ? "저장 중" : "목표 저장"}</button></div>
    {message && <p className={failed ? "form-message error-text" : "form-message"} role={failed ? "alert" : "status"}>{message}</p>}
  </form>;
}

function NotificationEditor({ initial, onSave }: { initial: Settings; onSave: (value: Settings) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  return <form onSubmit={async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const result = await requestJson<SettingsResponse>("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      if (result.settings) await onSave(result.settings);
      setMessage("알림 시간을 저장했습니다.");
    } catch { setFailed(true); setMessage("알림 시간을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }}>
    <fieldset disabled={busy} className="settings-fields notification-fields">
      <label>기록 알림<input className="field" type="time" required value={draft.notify_time} onChange={(event) => setDraft({ ...draft, notify_time: event.target.value })} /></label>
      <label>주간 코칭<select className="field" value={draft.coaching_day_of_week} onChange={(event) => setDraft({ ...draft, coaching_day_of_week: Number(event.target.value) })}>
        {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => <option key={day} value={index}>{day}요일</option>)}
      </select></label>
      <label>코칭 시간<input className="field" type="time" required value={draft.coaching_time} onChange={(event) => setDraft({ ...draft, coaching_time: event.target.value })} /></label>
    </fieldset>
    <div className="settings-save"><button className="btn btn-primary" type="submit" disabled={busy}><Check size={17} />{busy ? "저장 중" : "알림 저장"}</button></div>
    {message && <p className={failed ? "form-message error-text" : "form-message"} role={failed ? "alert" : "status"}>{message}</p>}
  </form>;
}

export default function SettingsPanel() {
  const { data: settingsData, error: settingsError, mutate: mutateSettings } = useSWR<SettingsResponse>("/api/settings");
  const { data: planData, error: planError, mutate: mutatePlan } = useSWR<PlanResponse>("/api/plan/current");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(supported);
    if (supported) void navigator.serviceWorker.getRegistration().then(async (registration) => {
      const subscription = await registration?.pushManager?.getSubscription();
      setPushEnabled(Boolean(subscription));
    }).catch(() => setMessage("알림 상태를 확인하지 못했습니다."));
  }, []);

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true); setMessage("");
    try {
      if (!pushSupported) throw new Error("이 기기에서는 알림을 지원하지 않습니다.");
      if (pushEnabled) {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await requestJson("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
          await subscription.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        if (await Notification.requestPermission() !== "granted") throw new Error("브라우저의 알림 권한을 확인해 주세요.");
        const { publicKey } = await requestJson<{ publicKey: string }>("/api/push/public-key");
        if (!publicKey) throw new Error("알림 설정을 불러오지 못했습니다.");
        const padding = "=".repeat((4 - publicKey.length % 4) % 4);
        const bytes = Uint8Array.from(atob((publicKey + padding).replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
        await navigator.serviceWorker.register("/sw.js");
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
        try {
          await requestJson("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
        } catch (error) { if (!existing) await subscription.unsubscribe(); throw error; }
        setPushEnabled(true);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "알림을 변경하지 못했습니다."); }
    finally { setPushBusy(false); }
  }
  return <div className="screen-content settings-screen">
    <div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>설정</h1></div></div>
    <section className="section-block">
      <div className="section-heading"><h2><Target size={18} />체중 목표</h2></div>
      {planError ? <div className="notice error" role="alert">목표를 불러오지 못했습니다. <button onClick={() => void mutatePlan()}>다시 시도</button></div> :
        !planData ? <div className="loading-state">목표를 불러오는 중입니다.</div> :
        planData.plan ? <PlanEditor plan={planData.plan} onSave={async (plan) => { await mutatePlan({ ok: true, plan }, { revalidate: false }); }} /> :
        <Link className="settings-link" href="/onboarding">목표 설정<ArrowUpRight size={18} /></Link>}
    </section>
    <section className="section-block">
      <div className="section-heading"><h2><Bell size={18} />알림</h2></div>
      <div className="setting-row"><div><strong>기기 알림</strong><p className="muted">{pushSupported ? pushEnabled ? "알림 켜짐" : "알림 꺼짐" : "이 브라우저에서 지원하지 않음"}</p></div>
        <button className="switch" role="switch" aria-label="기기 알림" aria-checked={pushEnabled} disabled={pushBusy || !pushSupported} onClick={() => void togglePush()}><span /></button>
      </div>
      {settingsError ? <div className="notice error" role="alert">설정을 불러오지 못했습니다. <button onClick={() => void mutateSettings()}>다시 시도</button></div> :
        !settingsData ? <div className="loading-state">알림 시간을 불러오는 중입니다.</div> :
        <NotificationEditor initial={settingsData.settings ?? defaults} onSave={async (settings) => { await mutateSettings({ ok: true, settings }, { revalidate: false }); }} />}
    </section>
    <section className="section-block">
      <div className="section-heading"><h2>기록 관리</h2></div>
      <a className="settings-link" href="/api/export/csv" download><span><Download size={18} />전체 기록 다운로드<small>체중 · 운동 부위 · 식단 · 코칭</small></span><ArrowUpRight size={18} /></a>
      <Link className="settings-link" href="/checkins" prefetch={false}><span>이전 식단 · 체크인 기록</span><ArrowUpRight size={18} /></Link>
      <Link className="settings-link" href="/coaching" prefetch={false}><span>이전 코칭 기록</span><ArrowUpRight size={18} /></Link>
    </section>
    <section className="section-block">
      <button className="logout-button" disabled={loggingOut} onClick={async () => {
        setLoggingOut(true);
        try { await requestJson("/api/auth/logout", { method: "POST" }); window.location.replace("/auth"); }
        catch { setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요."); setLoggingOut(false); }
      }}><LogOut size={18} />{loggingOut ? "로그아웃 중" : "로그아웃"}</button>
      {message && <p className="form-message error-text" role="alert">{message}</p>}
    </section>
    <p className="app-version">YoonCoach · 2026.09</p>
  </div>;
}
