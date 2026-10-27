"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Link2 } from "lucide-react";
import { requestJson } from "@/lib/tracker-client";
import { WorkoutDialog } from "./WorkoutPrimitives";

export default function RoutineShareDialog({ id, name, path, onClose }: { id: string; name: string; path: string; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [url] = useState(() => window.location.origin + path);
  useEffect(() => { void QRCode.toCanvas(canvas.current, url, { width: 240, margin: 4, errorCorrectionLevel: "M", color: { dark: "#091225", light: "#ffffff" } }).catch(() => setMessage("QR 생성에 실패했습니다. 아래 링크를 이용해 주세요.")); }, [url]);
  return <WorkoutDialog title="친구에게 루틴 공유" onClose={() => { if (!busy) onClose(); }}>
    <div className="routine-share"><h3>{name}</h3><canvas ref={canvas} role="img" aria-label="루틴 공유 QR 코드" />
      <p className="workout-help">친구가 QR을 스캔하거나 링크를 열면 자기 루틴에 저장할 수 있어요. 링크를 가진 사람에게 종목·순서·세트 유형과 수가 공개됩니다. 무게·횟수·개인 세팅은 포함하지 않습니다.</p>
      <label>공유 URL<input className="field" readOnly value={url} onFocus={(event) => event.target.select()} /></label>
      <button type="button" className="btn btn-primary" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage("링크를 복사했습니다."); } catch { setMessage("위 URL을 길게 눌러 복사해 주세요."); } }}><Copy size={16} />URL 복사</button>
      <a className="text-button" href={path} target="_blank" rel="noopener noreferrer"><Link2 size={15} />공유 화면 보기</a>
      <button type="button" className="text-button" disabled={busy} onClick={async () => {
        if (!confirm("이 링크의 공유를 종료할까요? 친구가 이미 저장한 루틴은 유지됩니다.")) return;
        setBusy(true);
        try { await requestJson("/api/workouts/routines/share?id=" + encodeURIComponent(id), { method: "DELETE" }); onClose(); }
        catch { setMessage("공유를 종료하지 못했습니다. 다시 시도해 주세요."); } finally { setBusy(false); }
      }}>링크 공유 종료</button>
      {message && <p role="status" className="workout-help">{message}</p>}
    </div>
  </WorkoutDialog>;
}
