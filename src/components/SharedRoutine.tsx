"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, Download, Dumbbell } from "lucide-react";
import { requestJson } from "@/lib/tracker-client";
import { setTypes, type Routine } from "@/lib/workouts";
import { PartTags } from "./WorkoutPrimitives";

export default function SharedRoutine({ token, signedIn }: { token: string; signedIn: boolean }) {
  const endpoint = "/api/workouts/routines/shared/" + token;
  const { data, error, mutate } = useSWR<{ routine: Routine }>(endpoint, requestJson);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  return <main className="shared-routine-page"><Link className="back-link" href="/body-parts"><ArrowLeft size={16} />YoonCoach</Link><p className="eyebrow">TRAIN TOGETHER</p>
    {error ? <div className="notice error" role="alert">{error.message}<button type="button" onClick={() => void mutate()}>다시 시도</button></div> : !data ? <p className="loading-state">공유 루틴을 불러오는 중입니다.</p> : <>
      <h1>{data.routine.name}</h1><p className="workout-help">친구가 공유한 {data.routine.entries.length}개 종목. 내 루틴에 저장한 후 자유롭게 바꿔보세요.</p>
      <ol className="shared-routine-list">{data.routine.entries.map((entry) => <li key={entry.id}><Dumbbell size={20} /><div><h2>{entry.name}</h2><PartTags tags={entry.tags} /><p>{entry.isMain ? "메인 · " : ""}{entry.sets.length}세트 · {entry.sets.map((set, i) => `${i + 1} ${setTypes[set.type ?? "normal"]}`).join(" / ")}</p></div></li>)}</ol>
      {saved ? <div role="status"><p>내 루틴에 저장했습니다. ‘루틴 불러오기’에서 선택하세요.</p><Link className="btn btn-primary" href="/body-parts">운동 캘린더 열기</Link></div> : signedIn ? <button className="btn btn-primary" disabled={busy} onClick={async () => {
        setBusy(true); setMessage("");
        try {
          const response = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(15000) });
          if (response.status === 401) { window.location.assign("/auth?next=" + encodeURIComponent("/routines/shared/" + token)); return; }
          if (!response.ok) throw new Error((await response.json()).error || "저장하지 못했습니다.");
          setSaved(true);
        } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); } finally { setBusy(false); }
      }}><Download size={17} />{busy ? "저장 중" : "내 루틴으로 저장"}</button> : <Link className="btn btn-primary" href={"/auth?next=" + encodeURIComponent("/routines/shared/" + token)}>로그인하고 루틴 받기</Link>}
      <p className="workout-help">이미 있는 종목은 연결하고 없는 머신은 내 종목에 추가합니다. 기존 루틴과 운동 기록은 유지됩니다.</p>{message && <p role="alert" className="notice error">{message}</p>}
    </>}
  </main>;
}
