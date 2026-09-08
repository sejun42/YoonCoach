"use client";

import { useEffect, useState } from "react";

export type WeighIn = { id: string; date: string; weight_kg: number };
export type WeightResponse = { ok: true; weighIns: WeighIn[] };
export type Plan = {
  goalType: "target_weight" | "weekly_rate";
  goalValue: number;
  startDate: string;
  endDate: string;
  phase: "calibration" | "cut" | "bulk";
};
export type PlanResponse = { ok: true; plan: Plan | null };

export async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000), ...options });
  if (response.status === 401) {
    window.location.replace("/auth");
    throw new Error("다시 로그인해 주세요.");
  }
  if (!response.ok) {
    throw new Error("요청을 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.");
  }
  return response.json() as Promise<T>;
}

export function localYmd(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftDate(ymd: string, days: number) {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function elapsedDays(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function useToday() {
  const [today, setToday] = useState("");
  useEffect(() => {
    const update = () => setToday(localYmd());
    update();
    const interval = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => { clearInterval(interval); window.removeEventListener("focus", update); };
  }, []);
  return today;
}
