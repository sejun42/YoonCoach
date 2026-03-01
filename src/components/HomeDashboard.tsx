"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardResponse = {
  ok: boolean;
  plan: {
    targetCalories: number;
    targetCarbsG: number;
    targetProteinG: number;
    targetFatG: number;
    phase: "calibration" | "cut" | "bulk";
  } | null;
  weeklySummary: string;
  weighInCount7d: number;
  checkinCount7d: number;
  delta7dAvgKg: number | null;
  weeklyRatePercent: number | null;
  adherence: { good: number; ok: number; bad: number; unknown: number };
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function HomeDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);

  const [date, setDate] = useState(todayYmd());
  const [weight, setWeight] = useState("");
  const [adherence, setAdherence] = useState<"good" | "ok" | "bad">("good");
  const [intakeKnown, setIntakeKnown] = useState(true);
  const [showIntakeInput, setShowIntakeInput] = useState(false);
  const [intakeCalories, setIntakeCalories] = useState("");
  const [intakeCarbs, setIntakeCarbs] = useState("");
  const [intakeProtein, setIntakeProtein] = useState("");
  const [intakeFat, setIntakeFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/today?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("대시보드를 불러오지 못했어요.");
      }
      const json = (await res.json()) as DashboardResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const coachingReady = useMemo(() => {
    if (!data) {
      return false;
    }
    return data.weighInCount7d >= 4 && data.checkinCount7d >= 3;
  }, [data]);

  async function submitRoutine() {
    if (!weight) {
      setMessage("공복 체중을 먼저 입력해 주세요.");
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      const weightNum = Number(weight);
      if (Number.isNaN(weightNum)) {
        throw new Error("체중 값을 확인해 주세요.");
      }

      const weighRes = await fetch("/api/weighins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, weight_kg: weightNum })
      });
      if (!weighRes.ok) {
        throw new Error("체중 저장에 실패했어요.");
      }

      const payload = {
        date,
        adherence_status: adherence,
        intake_known: intakeKnown,
        intake_calories: intakeKnown && intakeCalories ? Number(intakeCalories) : null,
        intake_carbs_g: intakeKnown && intakeCarbs ? Number(intakeCarbs) : null,
        intake_protein_g: intakeKnown && intakeProtein ? Number(intakeProtein) : null,
        intake_fat_g: intakeKnown && intakeFat ? Number(intakeFat) : null
      };
      const checkinRes = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!checkinRes.ok) {
        throw new Error("체크인 저장에 실패했어요.");
      }

      setMessage("오늘 기록이 저장됐어요.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장 중 오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="panel p-4">불러오는 중...</div>;
  }
  if (error) {
    return <div className="panel p-4 text-red-600">{error}</div>;
  }
  if (!data || !data.plan) {
    return <div className="panel p-4">활성 플랜이 없습니다. 온보딩을 다시 진행해 주세요.</div>;
  }

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <p className="small mb-2">오늘 목표</p>
        <div className="kpi">{data.plan.targetCalories} kcal</div>
        <p className="mt-1 text-sm text-gray-700">
          탄 {data.plan.targetCarbsG}g | 단 {data.plan.targetProteinG}g | 지 {data.plan.targetFatG}g
        </p>
        <p className="small mt-1">플랜 단계: {data.plan.phase}</p>
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-lg font-bold">오늘 체크인 (10초)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">날짜</label>
            <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">공복 체중 (kg)</label>
            <input
              className="field"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="예: 68.4"
            />
          </div>
        </div>

        <div className="mt-3">
          <p className="label">식단 준수 상태</p>
          <div className="flex gap-2">
            {[
              { key: "good", label: "잘 지킴" },
              { key: "ok", label: "애매함" },
              { key: "bad", label: "못 지킴" }
            ].map((item) => (
              <button
                key={item.key}
                className={`btn flex-1 px-1 py-2 text-[14px] tracking-tight ${adherence === item.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setAdherence(item.key as "good" | "ok" | "bad")}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!intakeKnown}
            onChange={(e) => setIntakeKnown(!e.target.checked)}
          />
          오늘은 식단 기록을 못했어요(모름)
        </label>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            className={`inline-flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition ${showIntakeInput
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            onClick={() => setShowIntakeInput((prev) => !prev)}
          >
            <span>섭취 매크로 수기 입력(선택)</span>
            <span className="text-xs">{showIntakeInput ? "닫기" : "열기"}</span>
          </button>
          <p className="mt-2 text-xs text-slate-500">원할 때만 kcal/탄단지를 추가로 기록할 수 있어요.</p>

          {showIntakeInput && (
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <div>
                <label className="label">kcal</label>
                <input
                  className="field"
                  type="number"
                  disabled={!intakeKnown}
                  value={intakeCalories}
                  onChange={(e) => setIntakeCalories(e.target.value)}
                />
              </div>
              <div>
                <label className="label">탄수 g</label>
                <input
                  className="field"
                  type="number"
                  disabled={!intakeKnown}
                  value={intakeCarbs}
                  onChange={(e) => setIntakeCarbs(e.target.value)}
                />
              </div>
              <div>
                <label className="label">단백질 g</label>
                <input
                  className="field"
                  type="number"
                  disabled={!intakeKnown}
                  value={intakeProtein}
                  onChange={(e) => setIntakeProtein(e.target.value)}
                />
              </div>
              <div>
                <label className="label">지방 g</label>
                <input
                  className="field"
                  type="number"
                  disabled={!intakeKnown}
                  value={intakeFat}
                  onChange={(e) => setIntakeFat(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <button className="btn btn-primary mt-5 w-full md:w-auto" onClick={submitRoutine} disabled={saving}>
          {saving ? "저장 중..." : "오늘 기록 저장"}
        </button>
        {message && <p className="small mt-2">{message}</p>}
      </section>

      <section className="panel p-4">
        <h3 className="font-bold">이번 주 상태</h3>
        <p className="mt-1 text-gray-700">{data.weeklySummary}</p>
        <p className="small mt-2">
          7일 평균 변화: {data.delta7dAvgKg ?? "-"} kg | 주간 변화율: {data.weeklyRatePercent ?? "-"}%
        </p>
      </section>

      {!coachingReady && (
        <section className="panel border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold text-amber-900">코칭 실행 전 데이터가 더 필요해요</h3>
          <p className="mt-1 text-sm text-amber-900">
            최근 7일 기준 체중 {data.weighInCount7d}/4회, 체크인 {data.checkinCount7d}/3회입니다.
          </p>
        </section>
      )}
    </div>
  );
}
