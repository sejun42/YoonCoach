"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function plusDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [planPreview, setPlanPreview] = useState<{
    targetCalories: number;
    targetCarbsG: number;
    targetProteinG: number;
    targetFatG: number;
    phase: "calibration" | "cut" | "bulk";
  } | null>(null);

  // Step 1
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("30");
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("70");

  // Step 2
  const [activity, setActivity] = useState<"very_low" | "low" | "moderate" | "high" | "very_high">(
    "moderate"
  );

  // Step 3
  const [goalType, setGoalType] = useState<"target_weight" | "weekly_rate">("target_weight");
  const [targetWeight, setTargetWeight] = useState("65");
  const [endDate, setEndDate] = useState(ymd(plusDays(new Date(), 90)));
  const [weeklyRate, setWeeklyRate] = useState("0.5");
  const [durationWeeks, setDurationWeeks] = useState("12");

  // Step 4
  const [preferredPhase, setPreferredPhase] = useState<"calibration" | "cut" | "bulk">("calibration");

  async function completeOnboarding() {
    setSaving(true);
    setMessage(null);
    try {
      const profilePayload = {
        sex,
        age: Number(age),
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        activity,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul"
      };
      const profileRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload)
      });
      const profileJson = await profileRes.json();
      if (!profileRes.ok) {
        throw new Error(profileJson.error || "프로필 저장 실패");
      }

      const startDate = ymd(new Date());
      const computedEndDate =
        goalType === "target_weight"
          ? endDate
          : ymd(plusDays(new Date(), Number(durationWeeks) * 7));
      const planPayload = {
        goal_type: goalType,
        goal_value: goalType === "target_weight" ? Number(targetWeight) : Number(weeklyRate),
        start_date: startDate,
        end_date: computedEndDate,
        preferred_phase: preferredPhase
      };
      const planRes = await fetch("/api/plan/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planPayload)
      });
      const planJson = await planRes.json();
      if (!planRes.ok) {
        throw new Error(planJson.error || "초기 플랜 생성 실패");
      }

      setPlanPreview(planJson.plan);
      setStep(5);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl panel p-5">
      <p className="small">온보딩 {step}/5</p>
      {step === 1 && (
        <div>
          <h2 className="text-xl font-black">기본 정보</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">성별</label>
              <select className="field" value={sex} onChange={(e) => setSex(e.target.value as "male" | "female")}>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>
            <div>
              <label className="label">나이</label>
              <input className="field" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <label className="label">키(cm)</label>
              <input className="field" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div>
              <label className="label">현재 체중(kg)</label>
              <input className="field" type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary mt-4" onClick={() => setStep(2)}>
            다음
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-xl font-black">활동량 선택</h2>
          <div className="mt-8 mb-6 px-2">
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={["very_low", "low", "moderate", "high", "very_high"].indexOf(activity)}
              onChange={(e) => {
                const vals = ["very_low", "low", "moderate", "high", "very_high"] as const;
                setActivity(vals[Number(e.target.value)]);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="mt-6 text-center text-lg font-bold text-blue-800 bg-blue-50 py-3 rounded-xl border border-blue-100">
              {
                {
                  very_low: "매우 낮음 (거의 앉아있음)",
                  low: "낮음 (가벼운 활동)",
                  moderate: "보통 (주 3-5회 운동)",
                  high: "높음 (거의 매일 운동)",
                  very_high: "매우 높음 (고강도/육체노동)"
                }[activity]
              }
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500 font-medium px-1">
              <span>매우 낮음</span>
              <span>매우 높음</span>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              이전
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              다음
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="text-xl font-black">목표 설정</h2>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={`btn ${goalType === "target_weight" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setGoalType("target_weight")}
            >
              목표체중 + 종료일
            </button>
            <button
              type="button"
              className={`btn ${goalType === "weekly_rate" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setGoalType("weekly_rate")}
            >
              주당 변화율 + 기간
            </button>
          </div>

          {goalType === "target_weight" ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">목표 체중 (kg)</label>
                <input className="field" type="number" step="0.1" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
              </div>
              <div>
                <label className="label">종료일</label>
                <input className="field" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">주당 변화율 (%/주)</label>
                <input className="field" type="number" step="0.1" value={weeklyRate} onChange={(e) => setWeeklyRate(e.target.value)} />
              </div>
              <div>
                <label className="label">기간 (주)</label>
                <input className="field" type="number" value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} />
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>
              이전
            </button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>
              다음
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2 className="text-xl font-black">권장 모드 선택</h2>
          <p className="small mt-1">권장: 2주 캘리브레이션으로 유지칼로리 추정 후 감량/벌크를 시작</p>
          <div className="mt-4 grid gap-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={preferredPhase === "calibration"}
                onChange={() => setPreferredPhase("calibration")}
              />
              2주 캘리브레이션(권장)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={preferredPhase === "cut"}
                onChange={() => setPreferredPhase("cut")}
              />
              즉시 감량 시작
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={preferredPhase === "bulk"}
                onChange={() => setPreferredPhase("bulk")}
              />
              즉시 벌크 시작
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(3)} disabled={saving}>
              이전
            </button>
            <button className="btn btn-primary" onClick={completeOnboarding} disabled={saving}>
              {saving ? "생성 중..." : "초기 목표 생성"}
            </button>
          </div>
        </div>
      )}

      {step === 5 && planPreview && (
        <div>
          <h2 className="text-xl font-black">초기 목표가 생성됐어요</h2>
          <p className="small mt-1">이 수치는 시작점이에요. 체중 추세로 자동 조정해요.</p>
          <div className="panel mt-4 bg-blue-50 p-4">
            <p className="kpi">{planPreview.targetCalories} kcal</p>
            <p className="mt-1 text-sm">
              탄 {planPreview.targetCarbsG}g | 단 {planPreview.targetProteinG}g | 지 {planPreview.targetFatG}g
            </p>
            <p className="small mt-1">단계: {planPreview.phase}</p>
          </div>
          <button className="btn btn-primary mt-4" onClick={() => router.replace("/")}>
            홈으로 이동
          </button>
        </div>
      )}

      {message && <p className="small mt-3 text-red-600">{message}</p>}
    </section>
  );
}
