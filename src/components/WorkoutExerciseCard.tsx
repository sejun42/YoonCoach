"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Info, Plus, Star, Trash2, TrendingUp } from "lucide-react";
import { equipmentLabels } from "@/lib/exercise-catalog";
import { blankSet, recordedSets, type WorkoutEntry } from "@/lib/workouts";
import { PartTags, TagPicker } from "./WorkoutPrimitives";
import { useExerciseHistory } from "./WorkoutProgress";

export default function WorkoutExerciseCard({ entry, index, count, date, today, onChange, onRemove, onMove, onSettings, onProgress }: {
  entry: WorkoutEntry; index: number; count: number; date: string; today: string; onChange: (entry: WorkoutEntry) => void; onRemove: () => void; onMove: (direction: number) => void; onSettings: () => void; onProgress: () => void;
}) {
  const [editingTags, setEditingTags] = useState(false);
  const { data, error } = useExerciseHistory(entry.id, today);
  const previous = data?.history.filter((row) => row.date < date).at(-1);
  const previousSets = previous ? recordedSets(previous.entry) : [];
  return <article className="workout-card" aria-label={entry.name}>
    <div className="workout-card-heading"><span className="exercise-number">{String(index + 1).padStart(2, "0")}</span><div><span className="eyebrow">{equipmentLabels[entry.equipment]}</span><h3>{entry.name}</h3></div>
      <button type="button" className="icon-button" aria-label={entry.name + " 세부 설정"} onClick={onSettings}><Info size={19} /></button></div>
    <div className="workout-card-meta"><button type="button" className="tags-edit" aria-label={entry.name + " 부위 태그 편집"} onClick={() => setEditingTags(!editingTags)}><PartTags tags={entry.tags} /><small>편집</small></button>
      <button type="button" className="main-toggle" aria-pressed={entry.isMain} onClick={() => onChange({ ...entry, isMain: !entry.isMain })}><Star size={14} fill={entry.isMain ? "currentColor" : "none"} />메인</button></div>
    {editingTags && <div className="card-tag-editor"><p className="workout-help">대표 부위 1–2개를 선택하세요. 두 태그는 세트 점수를 절반씩 나눕니다.</p><TagPicker tags={entry.tags} onChange={(tags) => { if (tags.length) onChange({ ...entry, tags }); }} /></div>}
    <div className="previous-workout"><span>지난 기록</span><p>{previous ? previous.date.slice(5).replace("-", "/") + " · " + previousSets.map((set) => set.weight + "kg × " + set.reps).join(" / ") : error ? "불러오지 못했습니다" : data ? "첫 기록을 시작해 보세요" : "불러오는 중"}</p></div>
    <div className="set-grid"><span>세트</span><span>무게 (kg)</span><span>횟수</span><span><span className="sr-only">세트 삭제</span></span>
      {entry.sets.map((set, setIndex) => <div className="set-row" key={setIndex}><span className={set.weight !== null && set.reps !== null ? "set-number recorded" : "set-number"}>{setIndex + 1}</span>
        <input className="field" type="number" inputMode="decimal" min={0} max={2000} step="any" aria-label={(setIndex + 1) + "세트 무게"} value={set.weight ?? ""} placeholder={String(previousSets[setIndex]?.weight ?? "0")}
          onChange={(event) => onChange({ ...entry, sets: entry.sets.map((item, i) => i === setIndex ? { ...item, weight: event.target.value === "" ? null : Number(event.target.value) } : item) })} />
        <input className="field" type="number" inputMode="numeric" min={1} max={1000} step={1} aria-label={(setIndex + 1) + "세트 횟수"} value={set.reps ?? ""} placeholder={String(previousSets[setIndex]?.reps ?? "10")}
          onChange={(event) => onChange({ ...entry, sets: entry.sets.map((item, i) => i === setIndex ? { ...item, reps: event.target.value === "" ? null : Number(event.target.value) } : item) })} />
        <button type="button" className="icon-button" aria-label={(setIndex + 1) + "세트 삭제"} disabled={entry.sets.length === 1} onClick={() => onChange({ ...entry, sets: entry.sets.filter((_, i) => i !== setIndex) })}><Trash2 size={15} /></button>
      </div>)}
    </div>
    <button type="button" className="add-set" disabled={entry.sets.length >= 50} onClick={() => onChange({ ...entry, sets: [...entry.sets, blankSet()] })}><Plus size={16} />세트 추가</button>
    {!!entry.settings.filter((item) => item.value).length && <button className="settings-summary" type="button" onClick={onSettings}><Info size={13} />{entry.settings.filter((item) => item.value).map((item) => item.label + " " + item.value).join(" · ")}</button>}
    <div className="workout-card-footer"><button type="button" className="text-button" onClick={onProgress}><TrendingUp size={15} />성장 보기</button><div>
      <button type="button" className="icon-button" aria-label={entry.name + " 위로 이동"} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
      <button type="button" className="icon-button" aria-label={entry.name + " 아래로 이동"} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={15} /></button>
      <button type="button" className="icon-button" aria-label={entry.name + " 운동 삭제"} onClick={onRemove}><Trash2 size={15} /></button></div></div>
  </article>;
}
