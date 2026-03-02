"use client";

import { useCallback, useEffect, useState } from "react";

type Checkin = {
    id: string;
    date: string;
    intake_calories: number | null;
};

function toYmd(d: Date) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

export default function CheckinCalendar({ refreshTrigger }: { refreshTrigger: number }) {
    const [currentDate, setCurrentDate] = useState(() => new Date());
    const [checkins, setCheckins] = useState<Checkin[]>([]);
    const [loading, setLoading] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const loadCheckins = useCallback(async () => {
        setLoading(true);
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        const from = toYmd(start);
        const to = toYmd(end);
        try {
            const res = await fetch(`/api/checkins?from=${from}&to=${to}`);
            if (res.ok) {
                const json = await res.json();
                setCheckins(json.checkins || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    useEffect(() => {
        loadCheckins();
    }, [loadCheckins, refreshTrigger]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDay = new Date(year, month, 1).getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    const todayStr = toYmd(new Date());
    const weeks = ["일", "월", "화", "수", "목", "금", "토"];

    return (
        <section className="panel p-4">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    {year}. {String(month + 1).padStart(2, "0")}
                </h2>
                <div className="flex items-center gap-2">
                    <button className="btn btn-ghost px-2 py-1 text-sm bg-slate-100 rounded-lg hover:bg-slate-200" onClick={prevMonth}>{"<"}</button>
                    <button className="btn btn-ghost px-3 py-1 text-sm bg-slate-100 rounded-lg hover:bg-slate-200" onClick={goToday}>오늘</button>
                    <button className="btn btn-ghost px-2 py-1 text-sm bg-slate-100 rounded-lg hover:bg-slate-200" onClick={nextMonth}>{">"}</button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-y-4 gap-x-1 text-center">
                {weeks.map(w => (
                    <div key={w} className="text-xs font-semibold text-slate-400 mb-1">
                        {w}
                    </div>
                ))}
                {days.map((d, i) => {
                    if (d === null) return <div key={`empty-${i}`} />;

                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const isToday = dateStr === todayStr;
                    const checkin = checkins.find(c => c.date === dateStr);
                    const hasCalories = checkin && checkin.intake_calories != null;

                    return (
                        <div key={i} className="flex flex-col items-center relative gap-1">
                            {isToday && (
                                <div className="absolute -top-5 rounded-full bg-slate-900 text-white text-[10px] px-2 py-0.5 whitespace-nowrap z-10 shadow-sm font-medium">
                                    오늘
                                </div>
                            )}
                            <div
                                className={`w-9 h-9 flex items-center justify-center rounded-full text-[15px] font-bold relative transition-colors
                  ${hasCalories ? "bg-sky-200 text-sky-900" : "bg-slate-50 text-slate-700"} 
                  ${isToday && !hasCalories ? "border-2 border-slate-300 bg-white" : ""}
                `}
                            >
                                {d}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium min-h-[16px] tracking-tight">
                                {hasCalories ? `+${checkin.intake_calories}` : "-"}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
