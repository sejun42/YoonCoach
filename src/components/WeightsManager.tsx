"use client";

import { useEffect, useMemo, useState } from "react";

type WeighIn = {
  id: string;
  date: string;
  weight_kg: number;
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoYmd(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function WeightsManager() {
  const [from, setFrom] = useState(daysAgoYmd(60));
  const [to, setTo] = useState(todayYmd());
  const [rows, setRows] = useState<WeighIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [newDate, setNewDate] = useState(todayYmd());
  const [newWeight, setNewWeight] = useState("");

  async function load() {
    setLoading(true);
    setMessage(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`/api/weighins?from=${from}&to=${to}`, {
        cache: "no-store",
        signal: controller.signal
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "불러오기 실패");
      }
      setRows(json.weighIns);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setMessage("요청 시간이 초과됐어요. 새로고침 후 다시 시도해 주세요.");
      } else {
        setMessage(e instanceof Error ? e.message : "오류가 발생했어요.");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)), [rows]);

  async function addOrUpdate() {
    setMessage(null);
    try {
      const weightNum = Number(newWeight);
      if (!newDate || !newWeight || Number.isNaN(weightNum)) {
        throw new Error("날짜와 체중을 입력하세요.");
      }
      const res = await fetch("/api/weighins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, weight_kg: weightNum })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "저장 실패");
      }
      setMessage("저장 완료");
      setNewWeight("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    }
  }

  async function saveEdit(id: string) {
    setMessage(null);
    try {
      const weightNum = Number(editWeight);
      if (!editWeight || Number.isNaN(weightNum)) {
        throw new Error("수정 체중을 입력해 주세요.");
      }
      const res = await fetch(`/api/weighins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: weightNum })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "수정 실패");
      }
      setEditId(null);
      setEditWeight("");
      setMessage("수정 완료");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    }
  }

  async function remove(id: string) {
    if (!confirm("삭제할까요?")) {
      return;
    }
    setMessage(null);
    try {
      const res = await fetch(`/api/weighins/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "삭제 실패");
      }
      setMessage("삭제 완료");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "오류");
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <h2 className="text-lg font-bold">공복 체중 추가</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">날짜</label>
            <input className="field" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div>
            <label className="label">체중 (kg)</label>
            <input
              className="field"
              type="number"
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button className="btn btn-primary w-full" onClick={addOrUpdate}>
              저장
            </button>
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-lg font-bold">체중 기록</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">from</label>
            <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">to</label>
            <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button className="btn btn-ghost w-full" onClick={load}>
              조회
            </button>
          </div>
        </div>

        {loading ? (
          <p className="small mt-3">불러오는 중...</p>
        ) : sortedRows.length === 0 ? (
          <p className="small mt-3">기록이 없습니다.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {sortedRows.map((row) => (
              <li key={row.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold">{row.date}</p>
                  {editId === row.id ? (
                    <input
                      className="field mt-1 w-28"
                      type="number"
                      step="0.1"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                    />
                  ) : (
                    <p className="small">{row.weight_kg} kg</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {editId === row.id ? (
                    <>
                      <button className="btn btn-primary" onClick={() => saveEdit(row.id)}>
                        저장
                      </button>
                      <button className="btn btn-ghost" onClick={() => setEditId(null)}>
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setEditId(row.id);
                          setEditWeight(String(row.weight_kg));
                        }}
                      >
                        수정
                      </button>
                      <button className="btn btn-ghost" onClick={() => remove(row.id)}>
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && <p className="small">{message}</p>}
    </div>
  );
}
