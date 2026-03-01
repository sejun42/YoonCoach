"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CoachingOutput = {
  decision: "decrease" | "maintain" | "increase";
  next_calories: number;
  next_macros_g: { carbs: number; protein: number; fat: number };
  rationale_short: string;
  behavior_tip: string;
  data_quality: "good" | "medium" | "low";
  risk_flags: string[];
};

type CoachingLog = {
  id: string;
  run_at: string;
  reason: string;
  applied: boolean;
  output_json: CoachingOutput;
};

export default function CoachingPanel() {
  const [latest, setLatest] = useState<CoachingLog | null>(null);
  const [history, setHistory] = useState<CoachingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [weighInCount7d, setWeighInCount7d] = useState(0);
  const [checkinCount7d, setCheckinCount7d] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [latestRes, historyRes, dashboardRes] = await Promise.all([
        fetch("/api/coaching/latest", { cache: "no-store" }),
        fetch("/api/coaching/history", { cache: "no-store" }),
        fetch("/api/dashboard/today", { cache: "no-store" })
      ]);
      const latestJson = await latestRes.json();
      const historyJson = await historyRes.json();
      const dashboardJson = await dashboardRes.json();

      if (!latestRes.ok || !historyRes.ok || !dashboardRes.ok) {
        throw new Error("코칭 정보를 불러오지 못했어요.");
      }

      setLatest(latestJson.coaching);
      setHistory(historyJson.logs || []);
      setWeighInCount7d(dashboardJson.weighInCount7d || 0);
      setCheckinCount7d(dashboardJson.checkinCount7d || 0);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ready = useMemo(() => weighInCount7d >= 4 && checkinCount7d >= 3, [weighInCount7d, checkinCount7d]);

  async function runManualCoaching() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/coaching/run", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || json.reason || "코칭 실행 실패");
      }
      setMessage("코칭이 실행되어 목표가 업데이트됐습니다.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <div className="panel p-4">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      {!ready && (
        <section className="panel border-amber-200 bg-amber-50 p-4">
          <h2 className="font-bold text-amber-900">데이터가 아직 부족해요</h2>
          <p className="mt-1 text-sm text-amber-900">
            최근 7일 체중 {weighInCount7d}/4회, 체크인 {checkinCount7d}/3회가 필요합니다.
          </p>
        </section>
      )}

      <section className="panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">최신 코칭</h2>
          <button className="btn btn-primary" disabled={!ready || running} onClick={runManualCoaching}>
            {running ? "실행 중..." : "지금 코칭 받기"}
          </button>
        </div>

        {!latest ? (
          <p className="small mt-3">아직 코칭 결과가 없습니다.</p>
        ) : (
          <div className="mt-3 rounded-xl border p-4">
            <p className="small">
              {new Date(latest.run_at).toLocaleString()} / {latest.reason}
            </p>
            <p className="mt-2 text-lg font-bold">조정안: {latest.output_json.decision}</p>
            <p className="mt-1 text-sm">
              다음 목표: {latest.output_json.next_calories}kcal | 탄 {latest.output_json.next_macros_g.carbs}g
              {" / "}단 {latest.output_json.next_macros_g.protein}g / 지 {latest.output_json.next_macros_g.fat}g
            </p>
            <p className="mt-2 text-sm">{latest.output_json.rationale_short}</p>
            <p className="mt-1 text-sm font-semibold">팁: {latest.output_json.behavior_tip}</p>
            <p className="small mt-1">data_quality: {latest.output_json.data_quality}</p>
            {latest.output_json.risk_flags.length > 0 && (
              <p className="small mt-1">risk_flags: {latest.output_json.risk_flags.join(", ")}</p>
            )}
          </div>
        )}
      </section>

      <section className="panel p-4">
        <h3 className="font-bold">코칭 히스토리</h3>
        {history.length === 0 ? (
          <p className="small mt-2">히스토리가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((log) => (
              <li key={log.id} className="rounded-lg border p-3 text-sm">
                <p className="font-semibold">
                  {new Date(log.run_at).toLocaleString()} / {log.reason}
                </p>
                <p>
                  {log.output_json.decision} | {log.output_json.next_calories} kcal | dq:
                  {log.output_json.data_quality}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && <p className="small">{message}</p>}
    </div>
  );
}
