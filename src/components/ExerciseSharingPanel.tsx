"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Share2 } from "lucide-react";
import { requestJson } from "@/lib/tracker-client";
import type { ExerciseSharingStatus } from "@/lib/exercise-sharing";

export default function ExerciseSharingPanel() {
  const { data, error, mutate } = useSWR<ExerciseSharingStatus>("/api/workouts/sharing");
  const { mutate: mutateCache } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function update(publishNow: boolean) {
    if (!data || busy) return;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const result = await requestJson<ExerciseSharingStatus & { publishedNow?: number }>("/api/workouts/sharing", {
        method: publishNow ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publishNow ? {} : { enabled: !data.enabled })
      });
      await mutate(result, { revalidate: false });
      await mutateCache("/api/workouts/library");
      setMessage(publishNow ? `${result.publishedNow}개 종목을 공용 목록에 반영했습니다.` :
        result.enabled ? "매주 월요일 오전 9시에 내 종목을 공유합니다." : "앞으로의 공유 예약을 해제했습니다.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "공유 설정을 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <section className="section-block exercise-sharing-section">
    <div className="section-heading"><h2><Share2 size={18} />운동 종목 공유</h2></div>
    <p className="muted">직접 만든 종목의 이름·기구 종류·부위 태그를 공용 목록에 올려 다른 사람도 선택할 수 있게 합니다. 무게·횟수·메모·개인 머신 세팅은 공유하지 않습니다.</p>
    {error ? <div className="notice error" role="alert">공유 설정을 불러오지 못했습니다. <button onClick={() => void mutate()}>다시 시도</button></div> :
      !data ? <div className="loading-state">공유 설정을 불러오는 중입니다.</div> : <>
        <div className="setting-row"><div><strong>내 종목 매주 공유</strong><p className="muted">매주 월요일 오전 9시 · 한국 시간<br />켜면 아직 공유하지 않은 종목과 앞으로 추가할 종목을 함께 공유합니다.</p></div>
          <button className="switch" type="button" role="switch" aria-label="내 종목 매주 공유" aria-checked={data.enabled} disabled={busy} onClick={() => void update(false)}><span /></button>
        </div>
        <p className="muted">공유 완료 {data.publishedCount}개 · 다음 공유 대기 {data.scheduledCount}개 · 비공개 {data.privateCount}개</p>
        {data.enabled && <p className="muted">다음 반영: {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "numeric", minute: "2-digit" }).format(new Date(data.nextPublicationAt))}</p>}
        <div className="settings-save"><button type="button" className="btn btn-primary" disabled={busy || data.privateCount + data.scheduledCount === 0} onClick={() => void update(true)}><Share2 size={17} />{busy ? "반영 중" : "내 종목 지금 공유"}</button></div>
        <p className="muted">주간 공유를 꺼도 이미 공유한 종목은 공용 목록에 남습니다.</p>
      </>}
    {message && <p className={failed ? "form-message error-text" : "form-message"} role={failed ? "alert" : "status"}>{message}</p>}
  </section>;
}
