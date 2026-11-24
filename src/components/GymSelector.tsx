"use client";

import { useState } from "react";
import useSWR from "swr";
import { gymNames } from "@/lib/exercise-catalog";
import { requestJson } from "@/lib/tracker-client";
import type { WorkoutLibrary } from "@/lib/workouts";

export default function GymSelector({ exerciseId, gyms }: { exerciseId: string; gyms: string[] }) {
  const { mutate } = useSWR<WorkoutLibrary>("/api/workouts/library");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle(gym: string, selected: boolean) {
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/workouts/gyms", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId, gym, selected })
      });
      await mutate(library => {
        if (!library) return library;
        const current = new Set(library.gyms[exerciseId]);
        if (selected) current.add(gym);
        else current.delete(gym);
        return { ...library, gyms: { ...library.gyms, [exerciseId]: gymNames.filter(name => current.has(name)) } };
      }, { revalidate: false });
    } catch { setError("저장하지 못했습니다. 다시 선택해 주세요."); }
    finally { setBusy(false); }
  }
  return <details className="gym-selector">
    <summary>헬스장{gyms.length > 0 && <strong>{gyms.join(" · ")}</strong>}</summary>
    <fieldset disabled={busy} aria-label="이 기구가 있는 헬스장">
      {gymNames.map(gym => <label key={gym}><input type="checkbox" checked={gyms.includes(gym)}
        onChange={event => void toggle(gym, event.currentTarget.checked)} />{gym}</label>)}
    </fieldset>
    {busy && <small>저장 중…</small>}
    {error && <small role="alert">{error}</small>}
  </details>;
}
