"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BodyPartKey = "chest" | "shoulders" | "back" | "legs" | "front_legs" | "back_legs" | "arms";

type WorkoutPartLog = {
  id: string;
  date: string;
  body_part: BodyPartKey;
};

const currentBodyParts: { key: BodyPartKey; label: string; color: string; soft: string; text: string }[] = [
  { key: "chest", label: "가슴", color: "bg-rose-500", soft: "bg-rose-50 border-rose-200", text: "text-rose-800" },
  { key: "shoulders", label: "어깨", color: "bg-violet-500", soft: "bg-violet-50 border-violet-200", text: "text-violet-800" },
  { key: "back", label: "등", color: "bg-sky-500", soft: "bg-sky-50 border-sky-200", text: "text-sky-800" },
  { key: "front_legs", label: "전면하체", color: "bg-lime-500", soft: "bg-lime-50 border-lime-200", text: "text-lime-800" },
  { key: "back_legs", label: "후면하체", color: "bg-emerald-600", soft: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  { key: "arms", label: "팔", color: "bg-amber-500", soft: "bg-amber-50 border-amber-200", text: "text-amber-800" }
];

const legacyBodyParts: { key: BodyPartKey; label: string; color: string; soft: string; text: string }[] = [
  { key: "legs", label: "하체", color: "bg-slate-400", soft: "bg-slate-50 border-slate-200", text: "text-slate-700" }
];

const bodyParts = [...currentBodyParts, ...legacyBodyParts];

const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];

function toYmd(d: Date) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseYmd(ymd: string) {
  return new Date(`${ymd}T00:00:00`);
}

function daysBetween(from: string, to: string) {
  const diff = parseYmd(to).getTime() - parseYmd(from).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function daysAgoYmd(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toYmd(d);
}

export default function BodyPartCalendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toYmd(new Date()));
  const [logs, setLogs] = useState<WorkoutPartLog[]>([]);
  const [draftParts, setDraftParts] = useState<BodyPartKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = toYmd(new Date());

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/workout-parts?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("운동 부위 기록을 불러오지 못했습니다.");
      }
      const json = await res.json();
      setLogs(json.logs || []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "기록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, BodyPartKey[]>();
    for (const log of logs) {
      const parts = map.get(log.date) || [];
      if (!parts.includes(log.body_part)) {
        parts.push(log.body_part);
      }
      map.set(log.date, parts);
    }
    return map;
  }, [logs]);

  useEffect(() => {
    setDraftParts(logsByDate.get(selectedDate) || []);
  }, [logsByDate, selectedDate]);

  const selectedStoredParts = logsByDate.get(selectedDate) || [];
  const selectedHasRecord = selectedStoredParts.length > 0;

  const monthlyCounts = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return currentBodyParts.map((part) => ({
      ...part,
      count: logs.filter((log) => log.date.startsWith(monthPrefix) && log.body_part === part.key).length
    }));
  }, [logs, month, year]);

  const recommendation = useMemo(() => {
    const stats = currentBodyParts.map((part, index) => {
      const dates = logs.filter((log) => log.body_part === part.key).map((log) => log.date).sort();
      const lastDate = dates.at(-1) || null;
      return {
        ...part,
        index,
        lastDate,
        daysSince: lastDate ? daysBetween(lastDate, today) : Number.POSITIVE_INFINITY,
        monthlyCount: monthlyCounts.find((item) => item.key === part.key)?.count ?? 0
      };
    });

    return stats.sort((a, b) => {
      if (b.daysSince !== a.daysSince) {
        return b.daysSince - a.daysSince;
      }
      if (a.monthlyCount !== b.monthlyCount) {
        return a.monthlyCount - b.monthlyCount;
      }
      return a.index - b.index;
    })[0];
  }, [logs, monthlyCounts, today]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDay = new Date(year, month, 1).getDay();
  const days: (number | null)[] = [
    ...Array.from({ length: startingDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToday() {
    chooseDate(toYmd(new Date()));
  }

  function chooseDate(dateStr: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return;
    }
    setSelectedDate(dateStr);
    setCurrentDate(parseYmd(dateStr));
    setMessage(null);
  }

  function togglePart(part: BodyPartKey) {
    setDraftParts((prev) => {
      const base = part === "front_legs" || part === "back_legs" ? prev.filter((item) => item !== "legs") : prev;
      return base.includes(part) ? base.filter((item) => item !== part) : [...base, part];
    });
  }

  async function saveSelectedDate() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/workout-parts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, body_parts: draftParts })
      });
      if (!res.ok) {
        throw new Error("운동 부위 기록 저장에 실패했습니다.");
      }
      const json = await res.json();
      const savedParts = (json.body_parts || draftParts) as BodyPartKey[];
      setLogs((prev) => [
        ...prev.filter((log) => log.date !== selectedDate),
        ...savedParts.map((bodyPart) => ({
          id: `${selectedDate}-${bodyPart}`,
          date: selectedDate,
          body_part: bodyPart
        }))
      ]);
      setMessage(selectedHasRecord ? "운동 부위 기록을 수정했습니다." : "운동 부위 기록을 저장했습니다.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className={`panel border p-4 ${recommendation.soft}`}>
        <p className="small mb-1">오늘 추천 부위</p>
        <div className={`text-2xl font-black ${recommendation.text}`}>{recommendation.label}</div>
        <p className="mt-1 text-sm text-slate-700">
          {recommendation.lastDate
            ? `마지막 기록 ${recommendation.daysSince}일 전 (${recommendation.lastDate})`
            : "아직 기록이 없어 우선 추천합니다."}
        </p>
      </section>

      <section className="panel p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {year}. {String(month + 1).padStart(2, "0")}
            </h2>
            <p className="small">날짜를 눌러 여러 부위를 함께 체크할 수 있습니다.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="btn btn-ghost px-2 py-1 text-sm" onClick={prevMonth} type="button">
              {"<"}
            </button>
            <button className="btn btn-ghost px-3 py-1 text-sm" onClick={goToday} type="button">
              오늘
            </button>
            <button className="btn btn-ghost px-2 py-1 text-sm" onClick={nextMonth} type="button">
              {">"}
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {monthlyCounts.map((part) => (
            <div key={part.key} className={`rounded-lg border px-2 py-2 text-center ${part.soft}`}>
              <div className={`mx-auto mb-1 h-2 w-8 rounded-full ${part.color}`} />
              <div className={`text-xs font-bold ${part.text}`}>{part.label}</div>
              <div className="text-sm font-black text-slate-900">{part.count}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekLabels.map((label) => (
            <div key={label} className="mb-1 text-xs font-semibold text-slate-400">
              {label}
            </div>
          ))}
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="min-h-[68px]" />;
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const partsForDay = logsByDate.get(dateStr) || [];
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={dateStr}
                className={`flex min-h-[68px] flex-col items-center justify-start rounded-lg border px-1 py-2 transition ${
                  isSelected ? "border-slate-900 bg-slate-50" : "border-transparent bg-white hover:border-slate-200"
                }`}
                onClick={() => chooseDate(dateStr)}
                type="button"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday ? "bg-slate-900 text-white" : "text-slate-800"
                  }`}
                >
                  {day}
                </span>
                <span className="mt-2 flex min-h-[18px] flex-wrap items-center justify-center gap-1">
                  {partsForDay.map((partKey) => {
                    const part = bodyParts.find((item) => item.key === partKey);
                    if (!part) {
                      return null;
                    }
                    return <span key={partKey} className={`h-2.5 w-2.5 rounded-full ${part.color}`} />;
                  })}
                </span>
              </button>
            );
          })}
        </div>

        {loading && <p className="small mt-3">운동 부위 기록을 불러오는 중입니다.</p>}
      </section>

      <section className="panel p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label className="label">수정할 날짜</label>
            <input className="field" type="date" value={selectedDate} onChange={(e) => chooseDate(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => chooseDate(daysAgoYmd(2))} type="button">
                엊그제
              </button>
              <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => chooseDate(daysAgoYmd(1))} type="button">
                어제
              </button>
              <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={goToday} type="button">
                오늘
              </button>
              {selectedHasRecord && (
                <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => setDraftParts([])} type="button">
                  선택 모두 해제
                </button>
              )}
            </div>
            <p className="small mt-2">운동한 부위를 다시 선택한 뒤 저장하면 기존 기록이 수정됩니다.</p>
          </div>
          <button className="btn btn-primary shrink-0" disabled={saving} onClick={saveSelectedDate} type="button">
            {saving ? "저장 중" : selectedHasRecord ? "수정 저장" : "저장"}
          </button>
        </div>

        {draftParts.includes("legs") && (
          <p className="small mb-3">
            기존 하체 기록이 남아 있습니다. 전면하체나 후면하체를 선택하면 기존 하체 기록은 자동으로 새 분할 기록으로 전환됩니다.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          {currentBodyParts.map((part) => {
            const active = draftParts.includes(part.key);
            return (
              <button
                key={part.key}
                className={`rounded-lg border px-3 py-3 text-sm font-bold transition ${
                  active ? `${part.soft} ${part.text}` : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
                onClick={() => togglePart(part.key)}
                type="button"
              >
                <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${part.color}`} />
                {part.label}
              </button>
            );
          })}
        </div>

        {message && <p className="small mt-3">{message}</p>}
      </section>
    </div>
  );
}
