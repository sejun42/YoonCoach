"use client";

import { useState } from "react";
import { newEntry, setTypes, workoutEntriesSchema, type WorkoutEntry, type WorkoutLibrary } from "@/lib/workouts";
import { WorkoutDialog } from "./WorkoutPrimitives";

const instruction = "추천한 루틴을 YoonCoach에 넣을 수 있게 운동 데이터 CSV의 정확한 종목명 또는 종목ID를 사용해 줘. 한 줄을 종목명|중량kg|횟수|세트유형|세트수 순으로 써 줘. 숫자는 단위 없이, 유형은 일반/미니세트/드랍세트 중 하나로, 중량이나 횟수가 달라지면 줄을 나눠 줘. 설명과 표 머리글 없이 출력해 줘.";

function parsePlan(text: string, library: WorkoutLibrary) {
  const plan = new Map<string, WorkoutEntry>();
  const lines = text.trim().replace(/^\x60{3}[^\n]*\n|\n\x60{3}$/g, "")
    // Mobile copy can flatten line breaks. Only split after a type and set count.
    .replace(/(\|[^\S\r\n]*(?:일반|미니세트|드랍세트)[^\S\r\n]*\|[^\S\r\n]*\d+)[^\S\r\n]+(?=[^\s|])/gu, "$1\n")
    .split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) continue;
    const fields = line.split("|").map(field => field.trim());
    const [name, weight, reps, label, count] = fields;
    const matches = library.exercises.filter(e => e.id === name || e.name === name);
    const type = (Object.keys(setTypes) as (keyof typeof setTypes)[]).find(key => setTypes[key] === label);
    if (fields.length !== 5 || !type || !/^\d+(\.\d+)?$/.test(weight) || +weight > 2000 ||
        !/^\d+$/.test(reps) || +reps < 1 || +reps > 1000 || !/^\d+$/.test(count) || +count < 1 || +count > 50)
      throw new Error(`${i+1}번째 항목의 중량·횟수·유형·세트수를 확인하세요.`);
    if (matches.length !== 1) throw new Error(`${i+1}번째 항목 ‘${name}’: CSV의 정확한 종목명 또는 종목ID를 사용하세요.`);
    const exercise = matches[0];
    const entry = plan.get(exercise.id) ?? { ...newEntry(exercise, library.preferences[exercise.id]), sets: [] };
    if (entry.sets.length + +count > 50) throw new Error(exercise.name + "은 최대 50세트입니다.");
    for (let j = 0; j < +count; j++) entry.sets.push({ weight: +weight, reps: +reps, type, completed: false });
    plan.set(exercise.id, entry);
  }
  return [...plan.values()];
}

export default function PlanImport({library, entries, onClose, onApply}: {
  library: WorkoutLibrary; entries: WorkoutEntry[]; onClose: () => void; onApply: (next: WorkoutEntry[]) => void;
}) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState("");
  const retained = entries.map(entry => ({ ...entry, sets: entry.sets.filter(set =>
    set.completed === true || (set.completed === undefined && (set.weight !== null || set.reps !== null))
  ) })).filter(entry => entry.sets.length);
  const pending = entries.reduce((count, entry) => count + entry.sets.length, 0)
    - retained.reduce((count, entry) => count + entry.sets.length, 0);
  const reset = text.trim() === "0";
  function clearPlan() {
    if (pending && window.confirm(`이 날짜의 미수행 세트 ${pending}개를 지울까요?`)) onApply(retained);
  }
  let error = "";
  let plan: WorkoutEntry[] = [];
  let next: WorkoutEntry[] = [];
  try {
    plan = reset ? [] : parsePlan(text, library);
    const plannedIds = new Set(plan.map(entry => entry.id));
    next = retained.filter(entry => !plannedIds.has(entry.id));
    for (const exercise of plan) {
      const old = entries.find(entry => entry.id === exercise.id);
      // A performed set occupies its original slot even if the actual weight or reps changed.
      const sets = exercise.sets.slice();
      const keep = retained.find(entry => entry.id === exercise.id);
      old?.sets.forEach((set, index) => {
        if (keep?.sets.includes(set)) {
          if (index < exercise.sets.length) sets[index] = set;
          else sets.push(set);
        }
      });
      next.push({ ...(old ?? exercise), sets });
    }
    if (!workoutEntriesSchema.safeParse(next).success) error = "기존 기록을 포함해 최대 60종목, 종목당 50세트까지 추가할 수 있습니다. 기존 입력값도 확인하세요.";
  } catch (e) { error = e instanceof Error ? e.message : "루틴을 확인하세요."; next = []; }
  return <WorkoutDialog title="GPT 루틴 붙여넣기" onClose={onClose}>
    <p>운동 CSV를 올린 채팅에 아래 요청문을 보내고 답변을 붙여넣으세요.</p>
    <details><summary>GPT 요청문 보기</summary><p>{instruction}</p></details>
    <button type="button" className="btn btn-ghost" onClick={async () => {
      try { await navigator.clipboard.writeText(instruction); setCopied("복사했습니다."); }
      catch { setCopied("요청문을 열어 직접 복사하세요."); }
    }}>GPT 요청문 복사</button> <span role="status">{copied}</span>
    <label>추천 루틴<textarea className="field" rows={6} maxLength={80000} value={text} onChange={e => setText(e.target.value)} placeholder="바벨 플랫 벤치프레스|80|8|일반|3" /></label>
    {error ? <p role="alert">{error}</p> : plan.map(e => <p key={e.id}>{e.name} · {e.sets.length}세트</p>)}
    <p className="workout-help">수정할 때는 하루 전체 루틴을 붙여넣으세요. 미수행 계획을 교체하고 완료한 세트와 메모는 유지합니다.</p>
    {!reset && <button type="button" className="btn btn-primary" disabled={!!error || !plan.length} onClick={() => onApply(next)}>{entries.length ? "이 날짜의 계획 교체" : "이 날짜에 추가"}</button>}
    <button type="button" className="btn btn-ghost" disabled={!pending} onClick={clearPlan}>이 날짜의 미수행 계획 비우기</button>
  </WorkoutDialog>;
}
