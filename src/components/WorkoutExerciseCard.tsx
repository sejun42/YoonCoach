"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Info, Plus, Star, Trash2, TrendingUp, ArrowLeftRight } from "lucide-react";
import { equipmentLabels } from "@/lib/exercise-catalog";
import { blankSet, recordedSets, setTypes, type WorkoutEntry } from "@/lib/workouts";
import { PartTags, TagPicker, WorkoutDialog } from "./WorkoutPrimitives";
import { useExerciseHistory } from "./WorkoutProgress";
import SwipeSetRow from "./SwipeSetRow";

export default function WorkoutExerciseCard({ entry, index, count, date, today, onChange, onRemove, onMove, onSettings, onProgress, onReplace }: {
  entry: WorkoutEntry; index: number; count: number; date: string; today: string; onChange: (entry: WorkoutEntry) => void; onRemove: () => void; onMove: (direction: number) => void; onSettings: () => void; onProgress: () => void; onReplace: () => void;
}) {
  const [editingTags, setEditingTags] = useState(false);
  const [setIndexToEdit, setSetIndexToEdit] = useState<number | null>(null);
  const [openSet, setOpenSet] = useState<number | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const position = useRef<{ x: number; y: number; index: number } | null>(null);
  useLayoutEffect(() => {
    const card = cardRef.current!;
    // Offset coordinates ignore scrolling and any animation already in flight.
    const next = { x: card.offsetLeft, y: card.offsetTop, index };
    const old = position.current;
    if (old && old.index !== index && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      card.getAnimations().forEach((animation) => animation.cancel());
      card.animate([{ transform: `translate(${old.x - next.x}px, ${old.y - next.y}px)`, boxShadow: "0 0 0 2px #588aff" },
        { transform: "translate(0, 0)", boxShadow: "0 0 0 0 transparent" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    position.current = next;
  });
  const { data, error } = useExerciseHistory(entry.id, today);
  const previous = data?.history.filter((row) => row.date < date).at(-1);
  const previousSets = previous ? recordedSets(previous.entry) : [];
  return <article ref={cardRef} className="workout-card" aria-label={entry.name}>
    <div className="workout-card-heading"><span className="exercise-number">{String(index + 1).padStart(2, "0")}</span><div><span className="eyebrow">{equipmentLabels[entry.equipment]}</span><h3>{entry.name}</h3></div>
      <button type="button" className="icon-button" aria-label={entry.name + " 세부 설정"} onClick={onSettings}><Info size={19} /></button></div>
    <div className="workout-card-meta"><button type="button" className="tags-edit" aria-label={entry.name + " 부위 태그 편집"} onClick={() => setEditingTags(!editingTags)}><PartTags tags={entry.tags} /><small>편집</small></button>
      <button type="button" className="main-toggle" aria-pressed={entry.isMain} onClick={() => onChange({ ...entry, isMain: !entry.isMain })}><Star size={14} fill={entry.isMain ? "currentColor" : "none"} />메인</button></div>
    {editingTags && <div className="card-tag-editor"><p className="workout-help">대표 부위 1–2개를 선택하세요. 두 태그는 세트 점수를 절반씩 나눕니다.</p><TagPicker tags={entry.tags} onChange={(tags) => { if (tags.length) onChange({ ...entry, tags }); }} /></div>}
    <div className="previous-workout"><span>지난 기록</span><p>{previous ? previous.date.slice(5).replace("-", "/") + " · " + previousSets.map((set) => set.weight + "kg × " + set.reps).join(" / ") : error ? "불러오지 못했습니다" : data ? "첫 기록을 시작해 보세요" : "불러오는 중"}</p></div>
    <div className="set-grid"><span>세트</span><span>무게 (kg)</span><span>횟수</span><span><span className="sr-only">세트 복사 및 삭제</span></span>
      {entry.sets.map((set, setIndex) => <SwipeSetRow key={setIndex} number={setIndex + 1} open={openSet === setIndex} disabled={entry.sets.length === 1}
        onOpen={(open) => setOpenSet((current) => open ? setIndex : current === setIndex ? null : current)}
        onDelete={() => onChange({ ...entry, sets: entry.sets.filter((_, i) => i !== setIndex) })}>
        <button type="button" className={"set-number" + (set.weight !== null && set.reps !== null ? " recorded" : "")} aria-label={`${setIndex + 1}세트 유형: ${setTypes[set.type ?? "normal"]}`} onClick={() => setSetIndexToEdit(setIndex)}>{setIndex + 1}{set.type && set.type !== "normal" && <small>{set.type === "mini" ? "미니" : "드랍"}</small>}</button>
        <input className="field" type="number" inputMode="decimal" min={0} max={2000} step="any" aria-label={(setIndex + 1) + "세트 무게"} value={set.weight ?? ""} placeholder={String(previousSets[setIndex]?.weight ?? "0")}
          onChange={(event) => onChange({ ...entry, sets: entry.sets.map((item, i) => i === setIndex ? { ...item, weight: event.target.value === "" ? null : Number(event.target.value) } : item) })} />
        <input className="field" type="number" inputMode="numeric" min={1} max={1000} step={1} aria-label={(setIndex + 1) + "세트 횟수"} value={set.reps ?? ""} placeholder={String(previousSets[setIndex]?.reps ?? "10")}
          onChange={(event) => onChange({ ...entry, sets: entry.sets.map((item, i) => i === setIndex ? { ...item, reps: event.target.value === "" ? null : Number(event.target.value) } : item) })} />
        <span className="set-actions">{setIndex > 0 && <button type="button" className="icon-button" title="바로 위 세트의 무게·횟수 복사" aria-label={(setIndex + 1) + "세트에 바로 위 세트 복사"}
          disabled={entry.sets[setIndex - 1].weight === null && entry.sets[setIndex - 1].reps === null}
          onClick={() => onChange({ ...entry, sets: entry.sets.map((item, i) => i === setIndex ? { ...item, weight: entry.sets[setIndex - 1].weight, reps: entry.sets[setIndex - 1].reps } : item) })}><Copy size={15} /></button>}
        </span>
      </SwipeSetRow>)}
    </div>
    <button type="button" className="add-set" disabled={entry.sets.length >= 50} onClick={() => onChange({ ...entry, sets: [...entry.sets, blankSet()] })}><Plus size={16} />세트 추가</button>
    {!!entry.settings.filter((item) => item.value).length && <button className="settings-summary" type="button" onClick={onSettings}><Info size={13} />{entry.settings.filter((item) => item.value).map((item) => item.label + " " + item.value).join(" · ")}</button>}
    <div className="workout-card-footer"><div><button type="button" className="text-button" onClick={onProgress}><TrendingUp size={15} />성장 보기</button><button type="button" className="text-button replace-exercise" aria-label={entry.name + " 운동 교체"} onClick={onReplace}><ArrowLeftRight size={15} />교체</button></div><div>
      <button type="button" className="icon-button" aria-label={entry.name + " 위로 이동"} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
      <button type="button" className="icon-button" aria-label={entry.name + " 아래로 이동"} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={15} /></button>
      <button type="button" className="icon-button" aria-label={entry.name + " 운동 삭제"} onClick={onRemove}><Trash2 size={15} /></button></div></div>
    {setIndexToEdit !== null && <WorkoutDialog title={`${setIndexToEdit + 1}세트 유형`} variant="set-type" onClose={() => setSetIndexToEdit(null)}>
      <div className="set-type-options">{(Object.keys(setTypes) as (keyof typeof setTypes)[]).map((type) => <button type="button" key={type} aria-pressed={(entry.sets[setIndexToEdit]?.type ?? "normal") === type} onClick={() => {
        onChange({ ...entry, sets: entry.sets.map((set, i) => i === setIndexToEdit ? { ...set, type } : set) }); setSetIndexToEdit(null);
      }}><strong>{setTypes[type]}</strong><span>{type === "normal" ? "충분히 쉬고 다음 세트" : type === "mini" ? "짧게 쉬고 이어서 수행" : "무게를 낮춰 이어서 수행"}</span></button>)}</div>
      <p className="workout-help">짧게 이어 하는 각 구간을 한 줄씩 기록하세요. 무게와 횟수는 유지됩니다.</p>
    </WorkoutDialog>}
  </article>;
}
