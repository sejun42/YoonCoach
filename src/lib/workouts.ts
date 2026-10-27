import { z } from "zod";
import { calendarDateSchema } from "./schemas";
import { exerciseCatalog, exerciseTagKeys, equipmentKeys, type Exercise, type ExerciseTag } from "./exercise-catalog";

export const tagsSchema = z.array(z.enum(exerciseTagKeys)).min(1).max(2).refine((tags) => new Set(tags).size === tags.length);
export const machineSettingsSchema = z.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().max(160) })).max(12)
  .refine((settings) => new Set(settings.map((item) => item.label)).size === settings.length, "설정 이름은 중복할 수 없습니다.");
export const exerciseSchema = z.object({ id: z.string().min(1).max(180), name: z.string().trim().min(1).max(100), tags: tagsSchema, equipment: z.enum(equipmentKeys) });
// Autosave must preserve a half-entered set too. Only complete sets enter metrics.
export const setTypes = { normal: "일반", mini: "미니세트", drop: "드랍세트" } as const;
export const setTypeSchema = z.enum(["normal", "mini", "drop"]).optional();
export const workoutSetSchema = z.object({ weight: z.number().finite().min(0).max(2000).nullable(), reps: z.number().int().min(1).max(1000).nullable(), type: setTypeSchema });
export const workoutEntrySchema = exerciseSchema.extend({ isMain: z.boolean(), sets: z.array(workoutSetSchema).min(1).max(50), settings: machineSettingsSchema });
export const workoutEntriesSchema = z.array(workoutEntrySchema).max(60).refine((entries) => new Set(entries.map((entry) => entry.id)).size === entries.length);
export const workoutSaveSchema = z.object({ date: calendarDateSchema, revision: z.number().int().nonnegative(), entries: workoutEntriesSchema, note: z.string().trim().max(2000) });
export const routineSchema = z.object({ name: z.string().trim().min(1).max(60), entries: workoutEntriesSchema.refine((entries) => entries.length > 0) });
export const customExerciseSchema = exerciseSchema.omit({ id: true });
export type WorkoutSet = z.infer<typeof workoutSetSchema>;
export type MachineSetting = z.infer<typeof machineSettingsSchema>[number];
export type WorkoutEntry = z.infer<typeof workoutEntrySchema>;
export type WorkoutSession = { date: string; revision: number; entries: WorkoutEntry[]; note: string };
export function sameWorkout(a: WorkoutSession, b: WorkoutSession) {
  return a.date === b.date && a.note.trim() === b.note.trim() && JSON.stringify(a.entries) === JSON.stringify(b.entries);
}
export type Routine = { id: string; name: string; entries: WorkoutEntry[]; preset?: boolean };
export type WorkoutHistory = { date: string; entry: WorkoutEntry };
export type WorkoutLibrary = { exercises: Exercise[]; preferences: Record<string, MachineSetting[]>; routines: Routine[] };
export const defaultMachineSettings = (): MachineSetting[] => [{ label: "안장 높이", value: "" }, { label: "가슴 패드", value: "" }];
export const blankSet = (): WorkoutSet => ({ weight: null, reps: null });
export function newEntry(exercise: Exercise, settings?: MachineSetting[]): WorkoutEntry {
  return { id: exercise.id, name: exercise.name, tags: [...exercise.tags], equipment: exercise.equipment, isMain: false, sets: [blankSet()],
    settings: settings ? structuredClone(settings) : exercise.equipment === "machine" ? defaultMachineSettings() : [] };
}
export const recordedSets = (entry: WorkoutEntry) => entry.sets.filter((set): set is WorkoutSet & { weight: number; reps: number } => set.weight !== null && set.reps !== null && set.reps > 0);

export function representativeParts(entries: WorkoutEntry[]): ExerciseTag[] {
  const scores = new Map<ExerciseTag, { main: number; total: number }>();
  for (const entry of entries) {
    const count = recordedSets(entry).length / entry.tags.length;
    if (!count) continue;
    for (const tag of entry.tags) {
      const score = scores.get(tag) ?? { main: 0, total: 0 };
      scores.set(tag, { main: score.main + (entry.isMain ? count : 0), total: score.total + count });
    }
  }
  return [...scores].sort(([a, x], [b, y]) => y.main - x.main || y.total - x.total || exerciseTagKeys.indexOf(a) - exerciseTagKeys.indexOf(b))
    .slice(0, 2).map(([tag]) => tag);
}

export function exerciseMetrics(entry: WorkoutEntry) {
  const sets = recordedSets(entry);
  if (!sets.length) return null;
  const weight = Math.max(...sets.map((set) => set.weight));
  return { weight, reps: Math.max(...sets.filter((set) => set.weight === weight).map((set) => set.reps)),
    totalReps: sets.reduce((sum, set) => sum + set.reps, 0), volume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0), sets: sets.length };
}

export function routineEntries(entries: WorkoutEntry[]): WorkoutEntry[] {
  return entries.map((entry) => ({ ...entry, settings: [], sets: entry.sets.map((set) => ({ ...blankSet(), ...(set.type ? { type: set.type } : {}) })) }));
}
function preset(name: string, ids: string[]): Routine {
  return { id: "preset:" + name, name, preset: true, entries: ids.map((id, index) => ({ ...newEntry(exerciseCatalog.find((item) => item.id === id)!), isMain: index === 0 })) };
}
export const starterRoutines: Routine[] = [
  preset("가슴", ["chest-bb:플랫 벤치프레스", "chest-db:인클라인 프레스", "chest-machine:팩덱 플라이"]),
  preset("등", ["back-cable:랫풀다운", "back-iso:DY 로우", "back-db:원암 로우"]),
  preset("어깨", ["shoulder-bb:바벨 OHP", "shoulder-db:사이드 레터럴 레이즈", "shoulder-machine:리버스 팩덱 플라이"]),
  preset("팔", ["arms-bb-bi:이지바 컬", "arms-cable-tri:케이블 푸시다운", "arms-db-bi:해머 컬"]),
  preset("전면하체", ["legs-bb-front:프론트 스쿼트", "legs-hammer-front:레그 프레스", "legs-cybex-front:레그 익스텐션"]),
  preset("후면하체", ["legs-bb-rear:루마니안 데드리프트", "legs-cybex-rear:라잉 레그 컬", "legs-bb-rear:힙 쓰러스트"])
];
