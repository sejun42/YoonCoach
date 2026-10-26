"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { WorkoutSession } from "@/lib/workouts";

const DraftContext = createContext<{ drafts: Record<string, WorkoutSession>; setDraft: (date: string, value: WorkoutSession | null) => void } | null>(null);
export function WorkoutDrafts({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, WorkoutSession>>({});
  useEffect(() => {
    if (!Object.keys(drafts).length) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [drafts]);
  function setDraft(date: string, value: WorkoutSession | null) {
    setDrafts((current) => { const next = { ...current }; if (value) next[date] = value; else delete next[date]; return next; });
  }
  return <DraftContext.Provider value={{ drafts, setDraft }}>{children}</DraftContext.Provider>;
}
export function useWorkoutDraft(date: string) {
  const context = useContext(DraftContext)!;
  return [context.drafts[date], (value: WorkoutSession | null) => context.setDraft(date, value)] as const;
}
