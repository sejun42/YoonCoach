"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { currentBodyParts, type BodyPartKey } from "@/lib/body-parts";
import { recordedSets, setTypes, type WorkoutEntry } from "@/lib/workouts";
import { WorkoutDialog } from "./WorkoutPrimitives";

export default function CopyWorkout({ date, entries, manualParts, note, disabled }: {
  date: string; manualParts: BodyPartKey[]; entries: WorkoutEntry[]; note: string; disabled: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");
  async function copy() {
    const lines = [date + " 운동 기록"];
    if (manualParts.length) lines.push("직접 체크한 부위: " + currentBodyParts.filter(part => manualParts.includes(part.key)).map(part => part.label).join(", "));
    for (const entry of entries) {
      const sets = recordedSets(entry);
      if (!sets.length) continue;
      lines.push("", entry.name + (entry.isMain ? " (메인)" : ""));
      for (const set of sets) {
        const details = [set.weight + "kg × " + set.reps + "회", setTypes[set.type ?? "normal"]];
        if (set.rir !== undefined) details.push("RIR " + set.rir);
        if (set.gear?.length) details.push(set.gear.join("·"));
        lines.push((entry.sets.indexOf(set) + 1) + "세트: " + details.join(" / "));
      }
      const settings = entry.settings.filter(item => item.value.trim());
      if (settings.length) lines.push("세팅: " + settings.map(item => item.label + " " + item.value).join(", "));
    }
    if (note.trim()) lines.push("", "메모: " + note.trim());
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setManual(text);
    }
  }
  return <>
    <button type="button" className="btn btn-ghost" disabled={disabled} onBlur={() => setCopied(false)} onClick={() => void copy()}>
      <Copy size={16} /><span aria-live="polite">{copied ? "복사했습니다" : "오늘 기록 복사"}</span>
    </button>
    {manual && <WorkoutDialog title="운동 기록 복사" onClose={() => setManual("")}>
      <p>아래 텍스트를 선택해 복사하세요.</p>
      <textarea className="field" aria-label="복사할 운동 기록" rows={9} readOnly value={manual} onFocus={event => event.currentTarget.select()} />
    </WorkoutDialog>}
  </>;
}
