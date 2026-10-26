"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { WorkoutAutosave } from "@/lib/workout-autosave";
import type { WorkoutSession } from "@/lib/workouts";

const DraftContext = createContext<WorkoutAutosave | null>(null);
export function WorkoutDrafts({ children, userId }: { children: ReactNode; userId: string }) {
  const { mutate } = useSWRConfig();
  const [manager] = useState(() => new WorkoutAutosave(userId, async (session) => {
    await mutate("/api/workouts?date=" + session.date, (current: { legacyParts?: string[] } | undefined) => ({
      ...current, session, legacyParts: current?.legacyParts ?? []
    }), { revalidate: false });
    // Chart refreshes are independent of a successful save; keep typing enabled.
    void mutate((key) => typeof key === "string" && (key.startsWith("/api/workout-parts?") || key.startsWith("/api/workouts/history?") || key === "/api/workouts/library")).catch(() => {});
  }));
  useEffect(() => { manager.start(); return () => manager.stop(); }, [manager]);
  return <DraftContext.Provider value={manager}>{children}</DraftContext.Provider>;
}
export function useWorkoutDraft(date: string) {
  const manager = useContext(DraftContext)!;
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  return { draft: snapshot.records[date]?.session, setDraft: (value: WorkoutSession | null) => manager.setDraft(date, value),
    save: () => manager.save(date, true), state: snapshot.states[date], ready: snapshot.ready, storageError: snapshot.storageError };
}
