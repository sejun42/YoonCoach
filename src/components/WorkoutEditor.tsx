"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, BookOpen, Check, Dumbbell, Plus, Save, Trash2, Share2 } from "lucide-react";
import { requestJson, useToday } from "@/lib/tracker-client";
import type { BodyPartKey } from "@/lib/body-parts";
import { exerciseCatalog, type Exercise } from "@/lib/exercise-catalog";
import { exerciseMetrics, newEntry, recordedSets, representativeParts, routineEntries, starterRoutines, type Routine, type WorkoutEntry, type WorkoutLibrary, type WorkoutSession } from "@/lib/workouts";
import ExercisePicker from "./ExercisePicker";
import MachineSettings from "./MachineSettings";
import { PartTags, WorkoutDialog } from "./WorkoutPrimitives";
import WorkoutExerciseCard from "./WorkoutExerciseCard";
import WorkoutProgress from "./WorkoutProgress";
import { useWorkoutDraft } from "./WorkoutDrafts";
import RoutineShareDialog from "./RoutineShareDialog";

type SessionResponse = { session: WorkoutSession; legacyParts: BodyPartKey[] };
export default function WorkoutEditor({ date }: { date: string }) {
  const today = useToday();
  const { data, error, mutate } = useSWR<SessionResponse>("/api/workouts?date=" + date, { revalidateOnFocus: false });
  const { data: library, error: libraryError, mutate: reloadLibrary } = useSWR<WorkoutLibrary>("/api/workouts/library");
  const { draft, setDraft, save: saveDraft, state: saveState, ready, storageError } = useWorkoutDraft(date);
  const saving = saveState?.kind === "saving";
  const [picker, setPicker] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [insertingAfterId, setInsertingAfterId] = useState<string | null>(null);
  const [shared, setShared] = useState<{ id: string; name: string; path: string } | null>(null);
  const [moveMessage, setMoveMessage] = useState("");
  const [routineDialog, setRoutineDialog] = useState<"load" | "save" | null>(null);
  const [routineName, setRoutineName] = useState("");
  const [routineBusy, setRoutineBusy] = useState(false);
  const [routineError, setRoutineError] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [graphId, setGraphId] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const session = draft ?? data?.session;
  const entries = session?.entries ?? [];
  const dirty = !!draft;
  const saveFailed = !!saveState && ["error", "conflict", "invalid"].includes(saveState.kind);
  const visibleMessage = saveState?.message || message;
  const parts = representativeParts(entries);
  const totalSets = entries.reduce((sum, entry) => sum + recordedSets(entry).length, 0);
  const volume = entries.reduce((sum, entry) => sum + (exerciseMetrics(entry)?.volume ?? 0), 0);
  const settingsEntry = entries.find((entry) => entry.id === settingsId);
  const exercises = library?.exercises ?? exerciseCatalog;
  const selectedGraph = graphId || entries[0]?.id || exercises[0]?.id || "";

  function edit(nextEntries: WorkoutEntry[], note = session?.note ?? "") {
    if (!session) return;
    const next = { ...session, entries: nextEntries, note };
    setDraft(next); setMessage(""); setFailed(false);
  }
  function updateEntry(entry: WorkoutEntry) { edit(entries.map((item) => item.id === entry.id ? entry : item)); }
  function addExercise(exercise: Exercise) {
    if (replacingId) {
      if (entries.some((entry) => entry.id === exercise.id)) return;
      const old = entries.find((entry) => entry.id === replacingId);
      if (!old) return;
      if (old.sets.some((set) => set.weight !== null || set.reps !== null) && !window.confirm(old.name + "에 입력한 무게·횟수를 지우고 " + exercise.name + "로 교체할까요?")) return;
      const replacement = { ...newEntry(exercise, library?.preferences[exercise.id]), isMain: old.isMain, sets: routineEntries([old])[0].sets };
      edit(entries.map((entry) => entry.id === replacingId ? replacement : entry));
      if (graphId === replacingId) setGraphId(exercise.id);
      setReplacingId(null); setPicker(false); return;
    }
    if (entries.some((entry) => entry.id === exercise.id) || entries.length >= 60) return;
    const afterIndex = insertingAfterId ? entries.findIndex((entry) => entry.id === insertingAfterId) : -1;
    const insertionIndex = afterIndex >= 0 ? afterIndex + 1 : entries.length;
    edit([...entries.slice(0, insertionIndex), newEntry(exercise, library?.preferences[exercise.id]), ...entries.slice(insertionIndex)]);
    // Keep multiple selections in selection order at the chosen position.
    if (insertingAfterId) setInsertingAfterId(exercise.id);
  }
  async function save() {
    setMessage(""); setFailed(false); await saveDraft();
  }
  function applyRoutine(routine: Routine) {
    if (entries.length && !window.confirm("현재 종목과 세트를 선택한 루틴으로 바꿀까요? 변경 후 5초 뒤 자동 저장됩니다.")) return;
    const next = routineEntries(routine.entries).map((entry) => ({ ...entry, settings: newEntry(entry, library?.preferences[entry.id]).settings }));
    edit(next); setRoutineDialog(null);
  }
  async function saveRoutine() {
    if (!entries.length || !routineName.trim()) return;
    if (library?.routines.some((routine) => routine.name === routineName.trim()) && !window.confirm("같은 이름의 루틴을 현재 구성으로 수정할까요?")) return;
    setRoutineBusy(true); setRoutineError("");
    try {
      await requestJson("/api/workouts/routines", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: routineName, entries: routineEntries(entries) }) });
      await reloadLibrary(); setRoutineDialog(null); setFailed(false); setMessage("루틴을 저장했습니다. 운동 기록은 자동 저장됩니다.");
    } catch (error) { setRoutineError(error instanceof Error ? error.message : "루틴을 저장하지 못했습니다."); }
    finally { setRoutineBusy(false); }
  }
  async function removeRoutine(routine: Routine) {
    if (!window.confirm(routine.name + " 루틴을 삭제할까요? 운동 기록은 유지됩니다.")) return;
    setRoutineBusy(true); setRoutineError("");
    try { await requestJson("/api/workouts/routines?id=" + encodeURIComponent(routine.id), { method: "DELETE" }); await reloadLibrary(); }
    catch (error) { setRoutineError(error instanceof Error ? error.message : "루틴을 삭제하지 못했습니다."); }
    finally { setRoutineBusy(false); }
  }
  async function shareRoutine(routine: Routine) {
    setRoutineBusy(true); setRoutineError("");
    try {
      const result = await requestJson<{ path: string }>("/api/workouts/routines/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: routine.id }) });
      setRoutineDialog(null); setShared({ id: routine.id, name: routine.name, path: result.path });
    } catch (error) { setRoutineError(error instanceof Error ? error.message : "공유 링크를 만들지 못했습니다."); }
    finally { setRoutineBusy(false); }
  }

  if (!ready || (!data && !draft)) return <div className="screen-content"><Link className="back-link" href="/body-parts"><ArrowLeft size={16} />운동 캘린더</Link>{error ? <div role="alert" className="notice error">운동 기록을 불러오지 못했습니다. <button onClick={() => void mutate()}>다시 시도</button></div> : <div className="loading-state">운동 기록과 임시 입력을 불러오는 중입니다.</div>}</div>;

  return <div className="screen-content workout-screen">
    <Link className="back-link" href="/body-parts"><ArrowLeft size={16} />운동 캘린더</Link>
    <div className="page-heading"><div><p className="eyebrow">DAILY TRAINING</p><h1>{Number(date.slice(5, 7))}월 {Number(date.slice(8))}일 운동</h1><p className="workout-date">{date} · {new Date(date + "T12:00:00Z").toLocaleDateString("ko-KR", { weekday: "long", timeZone: "UTC" })}</p></div><span className={dirty ? "save-state pending" : "save-state"}>{saving ? "저장 중" : saveFailed ? "저장 확인 필요" : dirty ? "자동 저장 대기" : session?.revision ? "저장됨" : "새 기록"}</span></div>
    <p className="workout-help">입력을 멈추면 5초 후 자동 저장됩니다. 무게나 횟수만 입력한 세트도 보관됩니다.</p>
    {storageError && <p className="notice error" role="alert">이 브라우저에 임시 입력을 보관하지 못했습니다. 화면을 닫기 전에 서버에 ‘저장됨’으로 표시되는지 확인해 주세요.</p>}
    {date > today && today && <p className="notice workout-future">미래 날짜의 기록입니다. 오늘까지의 기록만 성장 그래프에 반영됩니다.</p>}
    <div className="session-summary"><div><span className="metric-label">운동 종목</span><strong>{entries.length}<small>개</small></strong></div><div><span className="metric-label">기록한 세트</span><strong>{totalSets}<small>세트</small></strong></div><div><span className="metric-label">총 볼륨</span><strong>{Number(volume.toFixed(2)).toLocaleString()}<small>kg·회</small></strong></div></div>
    <div className="representative-parts"><span className="metric-label">오늘의 대표 부위</span>{parts.length ? <PartTags tags={parts} /> : <span className="muted">세트를 기록하면 자동으로 정해집니다.</span>}</div>
    <p className="workout-help">메인 종목의 부위 우선 · 입력한 세트 수 기준 · 최대 2개. 무게와 횟수를 모두 입력한 세트만 집계합니다.</p>
    {!!data?.legacyParts.length && <details className="legacy-workout"><summary>이 날짜의 기존 부위 기록</summary><PartTags tags={data.legacyParts} /><p className="workout-help">기존 기록은 보관됩니다. 세트를 기록하면 캘린더에는 새 대표 부위가 표시됩니다.</p></details>}
    {libraryError && <div role="alert" className="notice error">내 종목과 루틴을 불러오지 못했습니다. <button onClick={() => void reloadLibrary()}>다시 시도</button></div>}
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset>
        <div className="workout-toolbar"><h2>오늘의 운동</h2><div><button className="btn btn-ghost" type="button" disabled={!library} onClick={() => { setRoutineDialog("load"); setRoutineError(""); }}><BookOpen size={16} />루틴 불러오기</button>
          <button className="text-button" type="button" disabled={!entries.length || !library} onClick={() => { setRoutineDialog("save"); setRoutineError(""); }}>루틴으로 저장</button></div></div>
        {!entries.length && <div className="workout-empty"><span><Dumbbell size={28} /></span><h2>오늘의 첫 세트를 시작하세요.</h2><p>종목을 추가하거나 나만의 루틴을 불러오세요.<br />각 운동은 1세트부터 시작합니다.</p></div>}
        {!!entries.length && <p className="workout-help">세트를 왼쪽으로 밀면 삭제 버튼이 나타납니다.<span id="set-swipe-help" className="sr-only">키보드에서는 세트 행을 선택하고 왼쪽 화살표를 누른 뒤 Tab으로 삭제 버튼에 이동하세요. 오른쪽 화살표나 Escape로 닫습니다.</span></p>}
        <div className="workout-cards">{entries.map((entry, index) => <WorkoutExerciseCard key={entry.id} entry={entry} index={index} count={entries.length} date={date} today={today} onChange={updateEntry}
          onReplace={() => { setInsertingAfterId(null); setReplacingId(entry.id); setPicker(true); }}
          canAdd={!!library && entries.length < 60} onAddAfter={() => { setReplacingId(null); setInsertingAfterId(entry.id); setPicker(true); }}
          onSettings={() => setSettingsId(entry.id)} onProgress={() => { setGraphId(entry.id); document.getElementById("workout-progress")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
          onRemove={() => { if (recordedSets(entry).length && !window.confirm(entry.name + "의 세트 기록을 삭제할까요?")) return; edit(entries.filter((item) => item.id !== entry.id)); }}
          onMove={(direction) => { const next = [...entries]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; edit(next); setMoveMessage(entry.name + " · " + (index + direction + 1) + "번째로 이동했습니다."); }} />)}</div>
        <p className="sr-only" aria-live="polite">{moveMessage}</p>
        <button type="button" className="add-exercise" disabled={!library || entries.length >= 60} onClick={() => { setReplacingId(null); setInsertingAfterId(null); setPicker(true); }}><Plus size={20} />운동 추가<span>부위별 종목 찾기</span></button>
        <label className="workout-note">오늘의 메모<textarea className="field" rows={2} maxLength={2000} placeholder="컨디션, 자세, 다음 운동에서 기억할 것" value={session?.note ?? ""} onChange={(event) => edit(entries, event.target.value)} /></label>
        <div className="workout-savebar"><div><span className="save-state">{saving ? "서버에 저장 중 · 계속 입력해도 됩니다" : saveState?.kind === "error" ? "임시 입력 유지 · 15초 후 재시도" : dirty ? "입력을 멈추면 5초 후 자동 저장" : "변경 사항은 자동으로 저장됩니다"}</span>{dirty && <button className="text-button" type="button" disabled={saving} onClick={() => { if (window.confirm("저장 전 변경을 버리고 저장된 기록으로 돌아갈까요?")) { setDraft(null); setMessage(""); } }}>변경 취소</button>}</div>
          <button className="btn btn-primary" type="submit" disabled={!dirty || saving}><Check size={17} />{saving ? "저장 중" : "운동 기록 저장"}</button></div>
      </fieldset>
      {visibleMessage && <p className={failed || saveFailed ? "notice error" : "form-message"} role={failed || saveFailed ? "alert" : "status"}>{visibleMessage}{saveState?.kind === "conflict" && <>
        <button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "운동-임시입력-" + date + ".json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>임시 입력 다운로드</button>
        <button type="button" onClick={() => { if (window.confirm("현재 임시 입력을 버리고 최신 기록을 불러올까요? 필요하면 먼저 임시 입력을 다운로드하세요.")) { setDraft(null); setMessage(""); void mutate(); } }}>최신 기록 불러오기</button>
      </>}</p>}
    </form>
    <WorkoutProgress exercises={exercises} selected={selectedGraph} onSelect={setGraphId} today={today} />
    {picker && library && <ExercisePicker exercises={library.exercises} selected={entries.map((entry) => entry.id)} replacing={replacingId ?? undefined} onAdd={addExercise} onCreated={reloadLibrary} onClose={() => { setPicker(false); setReplacingId(null); setInsertingAfterId(null); }} />}
    {shared && <RoutineShareDialog {...shared} onClose={() => setShared(null)} />}
    {settingsEntry && <MachineSettings name={settingsEntry.name} settings={settingsEntry.settings} onApply={(settings) => updateEntry({ ...settingsEntry, settings })} onClose={() => setSettingsId(null)} />}
    {routineDialog && <WorkoutDialog title={routineDialog === "load" ? "루틴 불러오기" : "나의 루틴으로 저장"} onClose={() => { if (!routineBusy) setRoutineDialog(null); }}>
      <p className="workout-help">종목 순서, 부위 태그, 메인 지정과 세트 수를 기억합니다. 무게와 횟수는 새로 기록합니다.</p>
      <fieldset disabled={routineBusy}>{routineDialog === "save" ? <div className="routine-save"><label>루틴 이름<input className="field" autoFocus maxLength={60} placeholder="예: 가슴 + 어깨 A" value={routineName} onChange={(event) => setRoutineName(event.target.value)} /></label><p className="muted">{entries.length}개 종목 · {entries.reduce((sum, entry) => sum + entry.sets.length, 0)}세트 구성</p><button type="button" className="btn btn-primary" disabled={!routineName.trim()} onClick={() => void saveRoutine()}><Save size={16} />{routineBusy ? "저장 중" : "루틴 저장"}</button></div> : <>
        <h3 className="routine-group-title">내 루틴</h3>{!library?.routines.length && <p className="workout-help">운동을 구성한 뒤 ‘루틴으로 저장’을 눌러보세요.</p>}
        {library?.routines.map((routine) => <div className="routine-item" key={routine.id}><button type="button" onClick={() => applyRoutine(routine)}><strong>{routine.name}</strong><span>{routine.entries.length}개 종목 · {routine.entries.reduce((sum, entry) => sum + entry.sets.length, 0)}세트</span></button><button type="button" className="icon-button" title="QR / URL 공유" aria-label={routine.name + " 루틴 공유"} onClick={() => void shareRoutine(routine)}><Share2 size={17} /></button><button type="button" className="icon-button" aria-label={routine.name + " 루틴 삭제"} onClick={() => void removeRoutine(routine)}><Trash2 size={16} /></button></div>)}
        <h3 className="routine-group-title">시작용 루틴</h3><p className="workout-help">가슴 · 등 · 어깨 · 팔 · 전면하체 · 후면하체. 내 방식대로 바꾸고 저장할 수 있어요.</p>
        {starterRoutines.map((routine) => <div className="routine-item" key={routine.id}><button type="button" onClick={() => applyRoutine(routine)}><strong>{routine.name}</strong><span>{routine.entries.map((entry) => entry.name).join(" · ")}</span></button><Plus size={17} /></div>)}
      </>}</fieldset>{routineError && <p className="notice error" role="alert">{routineError}</p>}
    </WorkoutDialog>}
  </div>;
}
