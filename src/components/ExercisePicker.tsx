"use client";

import { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { equipmentKeys, equipmentLabels, exerciseGroups, searchExercise, type Equipment, type Exercise, type ExerciseTag } from "@/lib/exercise-catalog";
import { requestJson } from "@/lib/tracker-client";
import { PartTags, TagPicker, WorkoutDialog } from "./WorkoutPrimitives";

export default function ExercisePicker({ exercises, selected, onAdd, onCreated, onClose }: {
  exercises: Exercise[]; selected: string[]; onAdd: (exercise: Exercise) => void; onCreated: () => Promise<unknown>; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState<ExerciseTag[]>([]);
  const [equipment, setEquipment] = useState<Equipment>("machine");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const groupTags = exerciseGroups.find((item) => item.key === group)!.tags;
  const visible = exercises.filter((exercise) => searchExercise(exercise, query) && (group === "all" || exercise.tags.some((tag) => groupTags.includes(tag)) || (group === "other" && exercise.name === "페이스풀")));
  async function create() {
    setBusy(true); setError("");
    try {
      const result = await requestJson<{ exercise: Exercise }>("/api/workouts/exercises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, tags, equipment }) });
      await onCreated(); onAdd(result.exercise); setCustom(false); setName(""); setTags([]);
    } catch (error) { setError(error instanceof Error ? error.message : "종목을 추가하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <WorkoutDialog title="운동 추가" onClose={() => { if (!busy) onClose(); }}>
    <div className="exercise-search"><Search size={18} /><input aria-label="운동 검색" placeholder="종목이나 머신 이름 검색" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus /></div>
    <div className="exercise-filters">{exerciseGroups.map((item) => <button type="button" key={item.key} aria-pressed={group === item.key} onClick={() => setGroup(item.key)}>{item.label}</button>)}</div>
    <div className="picker-meta"><span>{visible.length}개 종목</span><button type="button" className="text-button" onClick={() => setCustom(!custom)}><Plus size={14} />직접 종목 만들기</button></div>
    {custom && <fieldset className="custom-exercise" disabled={busy}><label>종목 이름<input className="field" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="예: 우리 헬스장 시티드 로우" /></label>
      <label>기구<select className="field" value={equipment} onChange={(event) => setEquipment(event.target.value as Equipment)}>{equipmentKeys.map((key) => <option key={key} value={key}>{equipmentLabels[key]}</option>)}</select></label>
      <span className="muted">부위 태그 · 1–2개 선택</span><TagPicker tags={tags} onChange={setTags} />
      <button type="button" className="btn btn-primary" disabled={!name.trim() || !tags.length} onClick={() => void create()}>{busy ? "추가 중" : "내 종목으로 저장하고 추가"}</button>
      {error && <p className="form-message error-text" role="alert">{error}</p>}</fieldset>}
    <div className="exercise-results">{visible.map((exercise) => {
      const added = selected.includes(exercise.id);
      return <button className="exercise-result" type="button" key={exercise.id} disabled={busy || added || selected.length >= 60} onClick={() => onAdd(exercise)} aria-label={exercise.name + (added ? " 추가됨" : " 추가")}>
        <span><strong>{exercise.name}</strong><span className="exercise-result-meta"><PartTags tags={exercise.tags} /><small>{equipmentLabels[exercise.equipment]}{exercise.custom ? " · 내 종목" : ""}</small></span></span>{added ? <Check size={18} /> : <Plus size={18} />}
      </button>;
    })}{!visible.length && <p className="empty-state">일치하는 종목이 없습니다. 직접 추가할 수 있어요.</p>}</div>
    <div className="dialog-footer"><span className="muted">{selected.length}개 선택됨</span><button className="btn btn-primary" type="button" disabled={busy} onClick={onClose}>선택 완료</button></div>
  </WorkoutDialog>;
}
