"use client";

import { useEffect, useState } from "react";
import { Timer, X } from "lucide-react";

export default function RestTimer({ start, onClose }: { start: number; onClose: () => void }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor((Date.now() - start) / 1000)));
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    const interval = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [start]);
  return <aside className="rest-timer" aria-label="세트 간 휴식">
    <Timer size={15} aria-hidden="true" /> 휴식
    <strong role="timer">{Math.floor(seconds / 60)}분 {String(seconds % 60).padStart(2, "0")}초</strong>
    <button type="button" className="icon-button" aria-label="휴식 타이머 닫기" onClick={onClose}><X size={15} /></button>
  </aside>;
}
