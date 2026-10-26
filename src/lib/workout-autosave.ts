import { z } from "zod";
import { RequestError, requestJson } from "./tracker-client";
import { sameWorkout, workoutEntrySchema, workoutSaveSchema, type WorkoutSession } from "./workouts";

// Local recovery must retain even out-of-range values while the user fixes them.
const draftSchema = workoutSaveSchema.extend({ entries: z.array(workoutEntrySchema.extend({
  sets: z.array(z.object({ weight: z.number().nullable(), reps: z.number().nullable() })).min(1).max(50)
})).max(60) });
const recordSchema = z.object({ session: draftSchema, attempt: workoutSaveSchema.optional(), updatedAt: z.number() });
type DraftRecord = z.infer<typeof recordSchema> & { needsCheck?: boolean };
export type SaveState = { kind: "pending" | "saving" | "saved" | "error" | "conflict" | "invalid"; message: string };
type Snapshot = { records: Record<string, DraftRecord>; states: Record<string, SaveState>; ready: boolean; storageError: boolean };

export class WorkoutAutosave {
  private snapshot: Snapshot = { records: {}, states: {}, ready: false, storageError: false };
  private listeners = new Set<() => void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<string>();
  private active = false;
  private prefix: string;
  constructor(private userId: string, private onSaved: (session: WorkoutSession) => Promise<void>) {
    this.prefix = "yooncoach:workout-draft:v1:" + encodeURIComponent(userId) + ":";
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private publish(next: Snapshot) { this.snapshot = next; this.listeners.forEach((listener) => listener()); }
  private state(date: string, state: SaveState) { this.publish({ ...this.snapshot, states: { ...this.snapshot.states, [date]: state } }); }
  private persist(date: string, record: DraftRecord | null) {
    try {
      if (record) localStorage.setItem(this.prefix + date, JSON.stringify(record));
      else localStorage.removeItem(this.prefix + date);
      this.snapshot = { ...this.snapshot, storageError: false };
    } catch { this.snapshot = { ...this.snapshot, storageError: true }; }
  }
  private put(date: string, record: DraftRecord | null) {
    // Persist synchronously in the input event, not in a later React effect.
    this.persist(date, record);
    const records = { ...this.snapshot.records };
    if (record) records[date] = record; else delete records[date];
    this.publish({ ...this.snapshot, records });
  }
  private clearTimer(date: string) { clearTimeout(this.timers.get(date)); this.timers.delete(date); }
  private schedule(date: string, delay = 5000) {
    this.clearTimer(date);
    if (!this.active) return;
    this.timers.set(date, setTimeout(() => { this.timers.delete(date); void this.save(date); }, delay));
  }
  setDraft = (date: string, session: WorkoutSession | null) => {
    if (!this.snapshot.ready) return;
    if (!session) {
      if (this.inFlight.has(date)) return;
      this.clearTimer(date); this.put(date, null); this.state(date, { kind: "pending", message: "" }); return;
    }
    const old = this.snapshot.records[date];
    this.put(date, { ...old, session, updatedAt: Date.now() });
    if (this.snapshot.states[date]?.kind === "conflict") return;
    if (!this.inFlight.has(date)) this.state(date, { kind: "pending", message: "" });
    this.schedule(date);
  };
  private retry = () => {
    for (const date of Object.keys(this.snapshot.records)) {
      const kind = this.snapshot.states[date]?.kind;
      if (kind !== "conflict" && kind !== "invalid") void this.save(date);
    }
  };
  private visibility = () => { if (document.visibilityState === "hidden") this.retry(); };
  private preventLoss = (event: BeforeUnloadEvent) => {
    if (this.snapshot.storageError && Object.keys(this.snapshot.records).length) { event.preventDefault(); event.returnValue = ""; }
  };
  start() {
    this.active = true;
    const records: Record<string, DraftRecord> = {};
    let storageError = false;
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)!;
        if (!key.startsWith(this.prefix)) continue;
        try {
          const parsed = recordSchema.safeParse(JSON.parse(localStorage.getItem(key)!));
          if (parsed.success && key === this.prefix + parsed.data.session.date) records[parsed.data.session.date] = { ...parsed.data, needsCheck: true };
        } catch { /* Leave malformed data untouched, never overwrite server data with it. */ }
      }
    } catch { storageError = true; }
    this.publish({ records, states: {}, ready: true, storageError });
    Object.keys(records).forEach((date) => this.schedule(date));
    window.addEventListener("online", this.retry);
    document.addEventListener("visibilitychange", this.visibility);
    window.addEventListener("beforeunload", this.preventLoss);
  }
  stop() {
    this.active = false;
    this.timers.forEach(clearTimeout); this.timers.clear();
    window.removeEventListener("online", this.retry);
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("beforeunload", this.preventLoss);
  }
  save = async (date: string, manual = false) => {
    this.clearTimer(date);
    let record = this.snapshot.records[date];
    if (!this.active || !record || this.inFlight.has(date)) return;
    if (!manual && this.snapshot.states[date]?.kind === "conflict") return;
    this.inFlight.add(date);
    this.state(date, { kind: "saving", message: "" });
    try {
      if (record.needsCheck || record.attempt) {
        const { session: server } = await requestJson<{ session: WorkoutSession }>("/api/workouts?date=" + date, { headers: { "X-Workout-Owner": this.userId } });
        if (!this.active) return;
        record = this.snapshot.records[date];
        if (sameWorkout(server, record.session)) {
          await this.complete(date, record.session, server, manual); return;
        }
        if (server.revision !== record.session.revision && (!record.attempt || !sameWorkout(server, record.attempt))) {
          throw new RequestError("다른 화면에서 이 날짜를 수정했습니다. 임시 입력은 보관 중이며 자동으로 덮어쓰지 않습니다.", 409);
        }
        record = { ...record, session: { ...record.session, revision: server.revision }, needsCheck: false, attempt: undefined };
        this.put(date, record);
      }
      const parsed = workoutSaveSchema.safeParse(record.session);
      if (!parsed.success) throw new RequestError("입력 범위를 확인해 주세요. 무게 0–2000kg, 횟수 1–1000 사이의 정수입니다. 임시 입력은 유지됩니다.", 400);
      const sent = parsed.data;
      this.put(date, { ...record, attempt: sent });
      const body = JSON.stringify(sent);
      const { session } = await requestJson<{ session: WorkoutSession }>("/api/workouts", {
        method: "PUT", headers: { "Content-Type": "application/json", "X-Workout-Owner": this.userId }, body,
        keepalive: new Blob([body]).size < 60000
      });
      if (this.active) await this.complete(date, sent, session, manual);
    } catch (error) {
      if (!this.active) return;
      const kind = error instanceof RequestError && [403, 409].includes(error.status) ? "conflict" :
        error instanceof RequestError && error.status === 400 ? "invalid" : "error";
      const latest = this.snapshot.records[date];
      if (latest) this.put(date, { ...latest, needsCheck: true });
      this.state(date, { kind, message: error instanceof Error ? error.message : "저장하지 못했습니다." });
    } finally {
      this.inFlight.delete(date);
      const latest = this.snapshot.records[date];
      const kind = this.snapshot.states[date]?.kind;
      if (latest && kind === "pending") this.schedule(date, Math.max(0, 5000 - (Date.now() - latest.updatedAt)));
      else if (latest && kind === "error") this.schedule(date, 15000);
    }
  };
  private async complete(date: string, sent: WorkoutSession, server: WorkoutSession, manual: boolean) {
    await this.onSaved(server);
    if (!this.active) return;
    const latest = this.snapshot.records[date];
    if (!latest) return;
    if (sameWorkout(latest.session, sent)) {
      this.put(date, null);
      this.state(date, { kind: "saved", message: manual ? "운동 기록을 저장했습니다." : "운동 기록을 자동 저장했습니다." });
    } else {
      // A slow save must never clear keystrokes entered after its snapshot.
      this.put(date, { ...latest, session: { ...latest.session, revision: server.revision }, attempt: undefined, needsCheck: false });
      this.state(date, { kind: "pending", message: "" });
    }
  }
}
