"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useTransientToast } from "@/lib/useTransientToast";

type Settings = {
  notify_time: string;
  coaching_day_of_week: number;
  coaching_time: string;
};

type Plan = {
  goalType: "target_weight" | "weekly_rate";
  goalValue: number;
  endDate: string;
  phase: "calibration" | "cut" | "bulk";
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

export default function SettingsPanel() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    notify_time: "08:30",
    coaching_day_of_week: 0,
    coaching_time: "09:00"
  });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [goalType, setGoalType] = useState<"target_weight" | "weekly_rate">("target_weight");
  const [goalValue, setGoalValue] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preferredPhase, setPreferredPhase] = useState<"calibration" | "cut" | "bulk">("cut");
  const [message, setMessage] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [savingPush, setSavingPush] = useState(false);
  const { toastMessage, toastActive, showToast } = useTransientToast();

  useEffect(() => {
    (async () => {
      try {
        const ts = Date.now();
        const [settingsRes, planRes] = await Promise.all([
          fetch(`/api/settings?ts=${ts}`, { cache: "no-store" }),
          fetch(`/api/plan/current?ts=${ts}`, { cache: "no-store" })
        ]);
        const settingsJson = await settingsRes.json();
        const planJson = await planRes.json();

        if (settingsRes.ok && settingsJson.settings) {
          setSettings(settingsJson.settings);
        }
        if (planRes.ok && planJson.plan) {
          const p = planJson.plan as Plan;
          setPlan(p);
          setGoalType(p.goalType);
          setGoalValue(String(p.goalValue));
          setEndDate((p.endDate || "").slice(0, 10));
          setPreferredPhase(p.phase);
        }

        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            const sub = await registration.pushManager.getSubscription();
            setPushEnabled(Boolean(sub));
          }
        }
      } catch {
        setMessage("설정 정보를 불러오지 못했습니다.");
      }
    })();
  }, []);

  useEffect(() => {
    if (message) {
      showToast(message);
    }
  }, [message, showToast]);

  const handleButtonTapFeedback = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const button = target.closest("button");
      if (!button || (button as HTMLButtonElement).disabled) {
        return;
      }

      const manualFeedback = button.getAttribute("data-feedback");
      if (manualFeedback) {
        showToast(manualFeedback);
        return;
      }

      const label = button.textContent?.trim() || "버튼";
      showToast(`${label} 버튼을 눌렀어요.`);
    },
    [showToast]
  );

  async function saveSettings() {
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "설정 저장에 실패했습니다.");
        return;
      }
      setMessage("설정을 저장했습니다.");
    } catch {
      setMessage("설정 저장 중 오류가 발생했습니다.");
    }
  }

  async function savePlan() {
    setMessage(null);

    const goalNum = Number(goalValue);
    if (!goalValue || Number.isNaN(goalNum) || goalNum <= 0) {
      setMessage("목표 값을 올바르게 입력해 주세요.");
      return;
    }
    if (!endDate) {
      setMessage("종료일을 선택해 주세요.");
      return;
    }

    const payload = {
      goal_type: goalType,
      goal_value: goalNum,
      end_date: endDate,
      preferred_phase: preferredPhase
    };

    try {
      const res = await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "목표 재계산에 실패했습니다.");
        return;
      }

      if (json.plan) {
        const p = json.plan as Plan;
        setPlan(p);
        setGoalType(p.goalType);
        setGoalValue(String(p.goalValue));
        setEndDate((p.endDate || "").slice(0, 10));
        setPreferredPhase(p.phase);
      }

      router.refresh();
      showToast("목표 재계산이 반영되었어요.");
    } catch {
      setMessage("목표 재계산 중 오류가 발생했습니다.");
    }
  }

  async function togglePush() {
    setSavingPush(true);
    setMessage(null);
    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("이 기기에서는 푸시 알림을 지원하지 않습니다.");
      }

      if (!pushEnabled) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("푸시 알림 권한이 허용되지 않았습니다.");
        }

        const keyRes = await fetch("/api/push/public-key");
        const keyJson = await keyRes.json();
        if (!keyJson.publicKey) {
          throw new Error("푸시 공개키를 불러오지 못했습니다.");
        }

        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey)
        });

        const subRes = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription)
        });
        if (!subRes.ok) {
          throw new Error("푸시 구독 저장에 실패했습니다.");
        }

        setPushEnabled(true);
        setMessage("푸시 알림을 활성화했습니다.");
      } else {
        const registration = await navigator.serviceWorker.getRegistration();
        const sub = await registration?.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint })
          });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
        setMessage("푸시 알림을 비활성화했습니다.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "푸시 설정 중 오류가 발생했습니다.");
    } finally {
      setSavingPush(false);
    }
  }

  return (
    <div className="space-y-4" onClickCapture={handleButtonTapFeedback}>
      <section className="panel p-4">
        <h2 className="text-lg font-bold">알림/자동 코칭 시간</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">아침 알림 시간</label>
            <input
              className="field"
              type="time"
              value={settings.notify_time}
              onChange={(e) => setSettings((prev) => ({ ...prev, notify_time: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">자동 코칭 요일</label>
            <select
              className="field"
              value={settings.coaching_day_of_week}
              onChange={(e) => setSettings((prev) => ({ ...prev, coaching_day_of_week: Number(e.target.value) }))}
            >
              {dayNames.map((name, idx) => (
                <option value={idx} key={name}>
                  {name}요일
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">자동 코칭 시간</label>
            <input
              className="field"
              type="time"
              value={settings.coaching_time}
              onChange={(e) => setSettings((prev) => ({ ...prev, coaching_time: e.target.value }))}
            />
          </div>
        </div>
        <button className="btn btn-primary mt-4" onClick={saveSettings} data-feedback="설정을 저장하는 중입니다.">
          저장
        </button>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-bold">목표 수정(플랜 재계산)</h2>
        {!plan ? (
          <p className="small mt-2">현재 플랜 정보가 없습니다.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">목표 타입</label>
              <select
                className="field"
                value={goalType}
                onChange={(e) => setGoalType(e.target.value as "target_weight" | "weekly_rate")}
              >
                <option value="target_weight">목표 체중</option>
                <option value="weekly_rate">주간 변화율</option>
              </select>
            </div>
            <div>
              <label className="label">{goalType === "target_weight" ? "목표 체중(kg)" : "주간 변화율(%)"}</label>
              <input
                className="field"
                type="number"
                step="0.1"
                value={goalValue}
                onChange={(e) => setGoalValue(e.target.value)}
              />
            </div>
            <div>
              <label className="label">종료일</label>
              <input className="field" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="label">선호 페이즈</label>
              <select
                className="field"
                value={preferredPhase}
                onChange={(e) => setPreferredPhase(e.target.value as "calibration" | "cut" | "bulk")}
              >
                <option value="calibration">calibration</option>
                <option value="cut">cut</option>
                <option value="bulk">bulk</option>
              </select>
            </div>
          </div>
        )}
        <button className="btn btn-primary mt-4" onClick={savePlan} data-feedback="목표를 재계산하는 중입니다.">
          목표 재계산
        </button>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-bold">PWA 설치 / 푸시 알림</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
          <li>Android Chrome: 메뉴에서 홈 화면에 추가</li>
          <li>iOS Safari: 공유 메뉴에서 홈 화면에 추가</li>
          <li>설치 후 알림을 켜면 체크인/코칭 리마인더를 받을 수 있습니다.</li>
        </ul>
        <button
          className="btn btn-primary mt-4"
          onClick={togglePush}
          disabled={savingPush}
          data-feedback={pushEnabled ? "푸시 알림을 끄는 중입니다." : "푸시 알림을 켜는 중입니다."}
        >
          {savingPush ? "설정 중..." : pushEnabled ? "푸시 알림 끄기" : "푸시 알림 켜기"}
        </button>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-bold">데이터 내보내기</h2>
        <p className="small mt-1">체중/체크인/코칭 로그를 CSV로 다운로드합니다.</p>
        <button
          className="btn btn-ghost mt-3"
          data-feedback="CSV 다운로드를 시작합니다."
          onClick={() => (window.location.href = "/api/export/csv")}
        >
          CSV 다운로드
        </button>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-bold">로그아웃</h2>
        <button
          className="btn btn-ghost mt-2"
          data-feedback="로그아웃 중입니다."
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/auth");
          }}
        >
          로그아웃
        </button>
      </section>

      {message && <p className="small">{message}</p>}
      {toastMessage && (
        <div
          className={`pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-all duration-500 ${
            toastActive ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
