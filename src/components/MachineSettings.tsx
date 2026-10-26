"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { defaultMachineSettings, machineSettingsSchema, type MachineSetting } from "@/lib/workouts";
import { WorkoutDialog } from "./WorkoutPrimitives";

export default function MachineSettings({ name, settings, onApply, onClose }: { name: string; settings: MachineSetting[]; onApply: (settings: MachineSetting[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => [...defaultMachineSettings().filter((item) => !settings.some((row) => row.label === item.label)), ...structuredClone(settings)]);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  function add() {
    const value = label.trim();
    if (!value || draft.some((row) => row.label === value)) { setError("새로운 설정 이름을 입력해 주세요."); return; }
    setDraft([...draft, { label: value, value: "" }]); setLabel(""); setError("");
  }
  return <WorkoutDialog title="머신 세부 설정" onClose={onClose}><p className="settings-exercise-name">{name}</p>
    <p className="workout-help">운동 기록을 저장하면 다음 운동에도 이 설정을 불러옵니다. 과거 기록의 설정은 유지됩니다.</p>
    <div className="machine-settings">{draft.map((row, index) => <div key={row.label}><label>{row.label}<input className="field" value={row.value} maxLength={160} placeholder="예: 4칸 / 2번" onChange={(event) => setDraft(draft.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} /></label>
      {!["안장 높이", "가슴 패드"].includes(row.label) && <button type="button" className="icon-button" aria-label={row.label + " 항목 삭제"} onClick={() => setDraft(draft.filter((_, i) => i !== index))}><Trash2 size={16} /></button>}</div>)}</div>
    <div className="setting-add"><input className="field" aria-label="새 설정 항목" placeholder="예: 등받이 각도, 손잡이 위치" maxLength={40} value={label} onChange={(event) => setLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
      <button type="button" className="btn btn-ghost" disabled={draft.length >= 12} onClick={add}><Plus size={16} />항목 추가</button></div>
    {error && <p role="alert" className="error-text form-message">{error}</p>}
    <div className="dialog-footer"><span className="muted">최대 12개 항목</span><button type="button" className="btn btn-primary" onClick={() => { const parsed = machineSettingsSchema.safeParse(draft); if (parsed.success) { onApply(parsed.data); onClose(); } else setError("설정 이름과 값을 확인해 주세요."); }}>설정 적용</button></div>
  </WorkoutDialog>;
}
