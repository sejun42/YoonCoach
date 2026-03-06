"use client";

import { useEffect, useMemo, useState } from "react";

type Row = { date: string; weightKg: number };
type MA = { date: string; avg: number };
type PointKind = "record" | "trend";
type SelectedPoint = { kind: PointKind; date: string; value: number };

type PlotPoint = {
  date: string;
  value: number;
  x: number;
  y: number;
};

type YTick = {
  value: number;
  y: number;
};

type XTick = {
  date: string;
  label: string;
  x: number;
};

type ChartModel = {
  width: number;
  height: number;
  yTicks: YTick[];
  xTicks: XTick[];
  recordPoints: PlotPoint[];
  trendPoints: PlotPoint[];
  recordPolyline: string;
  trendPolyline: string;
};

type DashboardPayload = {
  ok: boolean;
  weighIns: Array<{ date: string; weightKg: number }>;
  movingAverages: Array<{ date: string; avg: number }>;
  plan: PlanSummary | null;
};

type GraphViewInitialData = {
  weighIns: Row[];
  movingAverages: MA[];
  plan: PlanSummary | null;
};

type PlanSummary = {
  phase: "calibration" | "cut" | "bulk";
  goalType: "target_weight" | "weekly_rate";
  goalValue: number;
  startDate: string;
  endDate: string;
};

type GoalDirection = "loss" | "gain";
type ProgressMode = "cut" | "bulk";

type DietProgress = {
  rangeStartDate: string;
  rangeEndDate: string;
  mode: ProgressMode;
  overallChangeKg: number;
  direction: GoalDirection;
  remainingKg: number | null;
  progressPercent: number | null;
  weeklyRequiredKg: number | null;
  weeklyActualKg: number | null;
  weeklyAchievementPercent: number | null;
  pacePerWeekKg: number | null;
  paceVsRequiredPercent: number | null;
};

const CHART_WIDTH = 860;
const CHART_HEIGHT = 300;
const CHART_PADDING = { top: 30, right: 30, bottom: 50, left: 100 };
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeYmd(value: string) {
  return value.slice(0, 10);
}

function toOneDecimal(value: number) {
  return Number(value.toFixed(1));
}

function toPercent(value: number) {
  return Number(value.toFixed(1));
}

function toSignedKg(value: number | null) {
  if (value === null) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function toKg(value: number | null) {
  if (value === null) {
    return "-";
  }
  return value.toFixed(1);
}

function toPercentText(value: number | null) {
  if (value === null) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
}

function dateDiffInDays(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / MS_PER_DAY;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDateLabel(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  const shortYear = String(year).slice(2);
  return `${shortYear}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

function formatDateLabelMd(ymd: string) {
  const [, month, day] = ymd.split("-").map(Number);
  return `${month}/${day}`;
}

function formatDateLabelYm(ymd: string) {
  const [year, month] = ymd.split("-").map(Number);
  const shortYear = String(year).slice(2);
  return `${shortYear}.${String(month).padStart(2, "0")}`;
}

function formatPointDate(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function formatWeight(weight: number) {
  return `${weight.toFixed(1)}kg`;
}

function polyline(points: PlotPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function areaPath(points: PlotPoint[], height: number) {
  if (points.length === 0) {
    return "";
  }

  const baseY = height - CHART_PADDING.bottom;
  const first = points[0];
  const last = points[points.length - 1];
  const poly = points.map((point) => `L ${point.x} ${point.y}`).join(" ");
  return `M ${first.x} ${baseY} ${poly} L ${last.x} ${baseY} Z`;
}

function chooseNiceStep(rawStep: number) {
  const baseSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10];
  for (const step of baseSteps) {
    if (rawStep <= step) {
      return step;
    }
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  if (normalized <= 2) {
    return 2 * magnitude;
  }
  if (normalized <= 5) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
}

function buildTickValues(minValue: number, maxValue: number, targetTicks = 5) {
  const safeRange = Math.max(0.1, maxValue - minValue);
  const step = chooseNiceStep(safeRange / Math.max(1, targetTicks - 1));
  const start = Math.floor(minValue / step) * step;
  const end = Math.ceil(maxValue / step) * step;

  const ticks: number[] = [];
  for (let value = start; value <= end + step * 0.5; value += step) {
    ticks.push(Number(value.toFixed(3)));
  }
  return ticks;
}

function xAt(index: number, total: number, width: number) {
  const graphW = width - CHART_PADDING.left - CHART_PADDING.right;
  if (total <= 1) {
    return CHART_PADDING.left + graphW / 2;
  }
  const xStep = graphW / (total - 1);
  return CHART_PADDING.left + index * xStep;
}

function yAt(
  value: number,
  minValue: number,
  maxValue: number,
  height: number
) {
  const graphH = height - CHART_PADDING.top - CHART_PADDING.bottom;
  const ratio = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue);
  return CHART_PADDING.top + graphH - ratio * graphH;
}

function makePoints(
  rows: Array<{ date: string; value: number }>,
  minValue: number,
  maxValue: number,
  width: number,
  height: number
) {
  return rows.map((row, i) => ({
    date: row.date,
    value: row.value,
    x: xAt(i, rows.length, width),
    y: yAt(row.value, minValue, maxValue, height)
  }));
}

function pickXTickIndexes(length: number, maxTicks: number) {
  if (length === 0) {
    return [];
  }
  if (length <= maxTicks) {
    return Array.from({ length }, (_, i) => i);
  }

  const step = (length - 1) / Math.max(1, maxTicks - 1);
  const indexes = new Set<number>();
  for (let i = 0; i < maxTicks; i += 1) {
    indexes.add(Math.round(i * step));
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

function buildChartModel(
  rows: Row[],
  trendRows: MA[],
  maxXTicks: number,
  xTickFormatter: (ymd: string) => string
): ChartModel {
  if (rows.length === 0) {
    return {
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      yTicks: [],
      xTicks: [],
      recordPoints: [],
      trendPoints: [],
      recordPolyline: "",
      trendPolyline: ""
    };
  }

  const mergedValues = [...rows.map((row) => row.weightKg), ...trendRows.map((row) => row.avg)];
  let min = Math.min(...mergedValues);
  let max = Math.max(...mergedValues);

  if (min === max) {
    min -= 1;
    max += 1;
  } else {
    min -= 0.4;
    max += 0.4;
  }

  const tickValues = buildTickValues(min, max);
  const chartMin = tickValues[0] ?? min;
  const chartMax = tickValues[tickValues.length - 1] ?? max;

  const recordPoints = makePoints(
    rows.map((row) => ({ date: row.date, value: row.weightKg })),
    chartMin,
    chartMax,
    CHART_WIDTH,
    CHART_HEIGHT
  );
  const xByDate = new Map(recordPoints.map((point) => [point.date, point.x]));
  const trendPoints = trendRows.map((row, i) => ({
    date: row.date,
    value: row.avg,
    x: xByDate.get(row.date) ?? xAt(i, trendRows.length, CHART_WIDTH),
    y: yAt(row.avg, chartMin, chartMax, CHART_HEIGHT)
  }));

  const yTicks = tickValues.map((value) => ({
    value,
    y: yAt(value, chartMin, chartMax, CHART_HEIGHT)
  }));
  const xTickIndexes = pickXTickIndexes(rows.length, maxXTicks);
  const xTicks = xTickIndexes.map((idx) => ({
    date: rows[idx].date,
    label: xTickFormatter(rows[idx].date),
    x: recordPoints[idx].x
  }));

  return {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    yTicks,
    xTicks,
    recordPoints,
    trendPoints,
    recordPolyline: polyline(recordPoints),
    trendPolyline: polyline(trendPoints)
  };
}

function pickReferenceRow(rows: Row[], refDate: Date) {
  const beforeOrEqual = [...rows].reverse().find((row) => parseYmd(row.date) <= refDate);
  if (beforeOrEqual) {
    return beforeOrEqual;
  }
  return rows.find((row) => parseYmd(row.date) >= refDate) ?? null;
}

function signedProgress(deltaKg: number, direction: GoalDirection) {
  return direction === "loss" ? -deltaKg : deltaKg;
}

function ProgressRing({ percent, mode }: { percent: number | null; mode: ProgressMode }) {
  const safePercent = percent === null ? null : clamp(percent, 0, 100);
  const radius = 50;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const strokeDashoffset =
    safePercent === null ? circumference : circumference - (safePercent / 100) * circumference;
  const ringColor = mode === "bulk" ? "#d97706" : "#059669";
  const ringBgColor = mode === "bulk" ? "#fef3c7" : "#d1fae5";

  return (
    <div className="flex items-center justify-center">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 100 100" className="-rotate-90 h-full w-full">
          <circle
            cx="50"
            cy="50"
            r={normalizedRadius}
            fill="none"
            stroke={ringBgColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx="50"
            cy="50"
            r={normalizedRadius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`text-lg font-black ${mode === "bulk" ? "text-amber-700" : "text-emerald-700"}`}>
            {toPercentText(percent)}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightTrendChart({
  title,
  subtitle,
  rows,
  trendRows,
  selected,
  onSelect,
  maxXTicks,
  showTrend = true,
  showRecordPoints = true,
  xTickFormatter = formatDateLabel,
  readabilityMode = "normal"
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  trendRows: MA[];
  selected: SelectedPoint | null;
  onSelect: (point: SelectedPoint) => void;
  maxXTicks: number;
  showTrend?: boolean;
  showRecordPoints?: boolean;
  xTickFormatter?: (ymd: string) => string;
  readabilityMode?: "normal" | "high";
}) {
  const chart = useMemo(
    () => buildChartModel(rows, trendRows, maxXTicks, xTickFormatter),
    [rows, trendRows, maxXTicks, xTickFormatter]
  );
  const recordArea = useMemo(
    () => (readabilityMode === "high" ? areaPath(chart.recordPoints, chart.height) : ""),
    [chart.recordPoints, chart.height, readabilityMode]
  );

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-4">
        <h3 className="text-base font-black tracking-tight text-slate-800">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
          표시할 체중 데이터가 아직 없습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4">
      <h3 className="text-base font-black tracking-tight text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-2">
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-auto w-full overflow-visible">
          <rect x="0" y="0" width={chart.width} height={chart.height} fill="#f8fafc" rx="12" />

          {chart.yTicks.map((tick) => (
            <g key={`y-${tick.value}`}>
              <line
                x1={CHART_PADDING.left}
                y1={tick.y}
                x2={chart.width - CHART_PADDING.right}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeWidth="2"
              />
              <text
                x={CHART_PADDING.left - 12}
                y={tick.y + 6}
                textAnchor="end"
                fontSize={readabilityMode === "high" ? "22" : "20"}
                fill="#1e293b"
                fontWeight="700"
              >
                {`${tick.value.toFixed(1)}kg`}
              </text>
            </g>
          ))}

          {chart.xTicks.map((tick) => (
            <text
              key={`x-${tick.date}`}
              x={tick.x}
              y={chart.height - 12}
              textAnchor="middle"
              fontSize={readabilityMode === "high" ? "22" : "20"}
              fill="#334155"
              fontWeight={readabilityMode === "high" ? "700" : "600"}
            >
              {tick.label}
            </text>
          ))}

          {readabilityMode === "high" && recordArea && <path d={recordArea} fill="#38bdf8" fillOpacity="0.12" />}

          {showTrend && (
            <polyline
              fill="none"
              stroke="#94a3b8"
              strokeOpacity="0.75"
              strokeDasharray="8 6"
              strokeWidth="3.5"
              points={chart.trendPolyline}
            />
          )}
          {showTrend &&
            chart.trendPoints.map((point, index) => (
              <circle
                key={`trend-${point.date}-${index}`}
                cx={point.x}
                cy={point.y}
                r="6"
                fill="#94a3b8"
                className="cursor-pointer"
                onClick={() =>
                  onSelect({
                    kind: "trend",
                    date: point.date,
                    value: point.value
                  })
                }
              />
            ))}

          <polyline
            fill="none"
            stroke="#06b6d4"
            strokeWidth={readabilityMode === "high" ? "5" : "4"}
            points={chart.recordPolyline}
          />
          {showRecordPoints &&
            chart.recordPoints.map((point, index) => (
              <circle
                key={`record-visible-${point.date}-${index}`}
                cx={point.x}
                cy={point.y}
                r={readabilityMode === "high" ? "8" : "5"}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={readabilityMode === "high" ? "2.5" : "1.8"}
              />
            ))}
          {chart.recordPoints.map((point, index) => (
            <circle
              key={`record-hit-${point.date}-${index}`}
              cx={point.x}
              cy={point.y}
              r="24"
              fill="transparent"
              className="cursor-pointer"
              onClick={() =>
                onSelect({
                  kind: "record",
                  date: point.date,
                  value: point.value
                })
              }
            />
          ))}
        </svg>
      </div>

      <div className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
        {selected ? (
          <p>
            {formatPointDate(selected.date)} · {formatWeight(selected.value)} ·{" "}
            {selected.kind === "record" ? "일자별 기록" : "7일 이동평균"}
          </p>
        ) : (
          <p>그래프 점을 누르면 날짜와 체중이 표시됩니다.</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-5 text-[12px] font-semibold">
        <span className="flex items-center gap-1.5 text-cyan-800">
          <span className="block h-2.5 w-2.5 rounded-full bg-cyan-600" />
          일자별 기록
        </span>
        {showTrend && (
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="block h-2.5 w-2.5 rounded-full bg-slate-400" />
            7일 이동평균(추세)
          </span>
        )}
      </div>
    </section>
  );
}

export default function GraphView({ initialData }: { initialData?: GraphViewInitialData }) {
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [weighIns, setWeighIns] = useState<Row[]>(initialData?.weighIns ?? []);
  const [ma, setMa] = useState<MA[]>(initialData?.movingAverages ?? []);
  const [plan, setPlan] = useState<PlanSummary | null>(initialData?.plan ?? null);
  const [selected7d, setSelected7d] = useState<SelectedPoint | null>(null);
  const [selectedAll, setSelectedAll] = useState<SelectedPoint | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    (async () => {
      if (!initialData) {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetch(`/api/dashboard/today?ts=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const json = (await res.json()) as DashboardPayload;
        if (!res.ok) {
          throw new Error("그래프 데이터를 불러오지 못했어요.");
        }

        setWeighIns(json.weighIns);
        setMa(json.movingAverages);
        setPlan(json.plan);
        setError(null);
      } catch (e) {
        if (!initialData) {
          if (e instanceof DOMException && e.name === "AbortError") {
            setError("요청 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.");
          } else {
            setError(e instanceof Error ? e.message : "오류가 발생했어요.");
          }
        }
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [initialData]);

  const sevenDayData = useMemo(() => {
    if (weighIns.length === 0) {
      return { rows: [], trendRows: [] };
    }

    const latestDate = parseYmd(weighIns[weighIns.length - 1].date);
    const fromDate = addDays(latestDate, -6);
    const rows = weighIns.filter((row) => parseYmd(row.date) >= fromDate);
    const trendRows = ma.filter((row) => parseYmd(row.date) >= fromDate);

    return { rows, trendRows };
  }, [weighIns, ma]);

  const progress = useMemo<DietProgress>(() => {
    const first = weighIns[0];
    const latest = weighIns[weighIns.length - 1];

    if (!first || !latest) {
      return {
        rangeStartDate: "-",
        rangeEndDate: "-",
        mode: "cut",
        overallChangeKg: 0,
        direction: "loss",
        remainingKg: null,
        progressPercent: null,
        weeklyRequiredKg: null,
        weeklyActualKg: null,
        weeklyAchievementPercent: null,
        pacePerWeekKg: null,
        paceVsRequiredPercent: null
      };
    }

    const latestDate = parseYmd(latest.date);
    const overallChangeKg = toOneDecimal(latest.weightKg - first.weightKg);

    const weekStartDate = addDays(latestDate, -7);
    const weekBase = pickReferenceRow(weighIns, weekStartDate);
    const weeklyRawDelta =
      weekBase && weekBase.date !== latest.date ? latest.weightKg - weekBase.weightKg : null;

    const planStartDate = plan ? parseYmd(normalizeYmd(plan.startDate)) : parseYmd(first.date);
    const planEndDate = plan ? parseYmd(normalizeYmd(plan.endDate)) : null;
    const startRow = pickReferenceRow(weighIns, planStartDate) ?? first;

    let mode: ProgressMode =
      plan?.phase === "bulk" ? "bulk" : plan?.phase === "cut" ? "cut" : overallChangeKg <= 0 ? "cut" : "bulk";
    let direction: GoalDirection = mode === "bulk" ? "gain" : "loss";
    let remainingKg: number | null = null;
    let progressPercent: number | null = null;
    let weeklyRequiredKg: number | null = null;

    if (plan?.goalType === "target_weight") {
      const targetDirection: GoalDirection = plan.goalValue <= startRow.weightKg ? "loss" : "gain";
      if (plan.phase === "cut") {
        direction = "loss";
      } else if (plan.phase === "bulk") {
        direction = "gain";
      } else {
        direction = targetDirection;
      }
      mode = direction === "loss" ? "cut" : "bulk";
      const totalGoalChange = Math.abs(startRow.weightKg - plan.goalValue);
      const remainingRaw =
        direction === "loss" ? latest.weightKg - plan.goalValue : plan.goalValue - latest.weightKg;
      remainingKg = toOneDecimal(Math.max(0, remainingRaw));

      if (totalGoalChange <= 0.0001) {
        progressPercent = 100;
      } else {
        const achieved = Math.max(0, totalGoalChange - Math.max(0, remainingRaw));
        progressPercent = toPercent((achieved / totalGoalChange) * 100);
      }

      if (planEndDate) {
        if (remainingKg <= 0) {
          weeklyRequiredKg = 0;
        } else {
          const daysLeft = Math.max(0, Math.ceil(dateDiffInDays(latestDate, planEndDate)));
          weeklyRequiredKg =
            daysLeft > 0
              ? toOneDecimal(remainingKg / Math.max(daysLeft / 7, 1 / 7))
              : toOneDecimal(remainingKg);
        }
      }
    } else if (plan?.goalType === "weekly_rate") {
      direction = plan.phase === "bulk" ? "gain" : "loss";
      mode = direction === "loss" ? "cut" : "bulk";
      weeklyRequiredKg = toOneDecimal((startRow.weightKg * plan.goalValue) / 100);
    }

    const weeklyActualKg =
      weeklyRawDelta === null ? null : toOneDecimal(signedProgress(weeklyRawDelta, direction));

    const weeklyAchievementPercent =
      weeklyRequiredKg !== null && weeklyRequiredKg > 0 && weeklyActualKg !== null
        ? toPercent((weeklyActualKg / weeklyRequiredKg) * 100)
        : null;

    const elapsedDays = Math.max(1, dateDiffInDays(parseYmd(startRow.date), latestDate));
    const periodProgress = signedProgress(latest.weightKg - startRow.weightKg, direction);
    const pacePerWeekKg = toOneDecimal(periodProgress / (elapsedDays / 7));
    const paceVsRequiredPercent =
      weeklyRequiredKg !== null && weeklyRequiredKg > 0
        ? toPercent((pacePerWeekKg / weeklyRequiredKg) * 100)
        : null;

    return {
      rangeStartDate: first.date,
      rangeEndDate: latest.date,
      mode,
      overallChangeKg,
      direction,
      remainingKg,
      progressPercent,
      weeklyRequiredKg,
      weeklyActualKg,
      weeklyAchievementPercent,
      pacePerWeekKg,
      paceVsRequiredPercent
    };
  }, [weighIns, plan]);

  const modeText = progress.mode === "bulk" ? "벌크 모드" : "다이어트 모드";
  const directionLabel = progress.mode === "bulk" ? "증량" : "감량";
  const remainingLabel = progress.mode === "bulk" ? "목표까지 남은 증량" : "목표까지 남은 감량";
  const accentTextClass = progress.mode === "bulk" ? "text-amber-700" : "text-emerald-700";
  const modeBadgeClass =
    progress.mode === "bulk" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";

  useEffect(() => {
    setSelected7d(null);
    setSelectedAll(null);
  }, [weighIns, ma]);

  if (loading) {
    return <div className="panel p-4 text-slate-500 font-medium">데이터 불러오는 중...</div>;
  }
  if (error) {
    return <div className="panel p-4 text-red-600 font-medium">{error}</div>;
  }
  if (weighIns.length === 0) {
    return (
      <div className="panel p-5 text-center text-slate-500">
        체중 데이터가 아직 없습니다. 먼저 체중을 입력해 보세요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h2 className="mb-4 text-lg font-black tracking-tight text-slate-800">체중 변화 추이</h2>
        <div className="space-y-4">
          <WeightTrendChart
            title="최근 7일 그래프"
            subtitle="최신 기록일 기준 최근 7일 체중 변화와 7일 이동평균"
            rows={sevenDayData.rows}
            trendRows={sevenDayData.trendRows}
            selected={selected7d}
            onSelect={setSelected7d}
            maxXTicks={7}
            showTrend
            showRecordPoints
            xTickFormatter={formatDateLabelMd}
            readabilityMode="high"
          />

          <WeightTrendChart
            title="전체 기간 그래프"
            subtitle={`누적 체중 기록 ${weighIns.length}회 기준 추이 (이동평균 제외)`}
            rows={weighIns}
            trendRows={ma}
            selected={selectedAll}
            onSelect={setSelectedAll}
            maxXTicks={5}
            showTrend={false}
            showRecordPoints={false}
            xTickFormatter={formatDateLabelYm}
            readabilityMode="normal"
          />
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="mb-1 text-[14px] font-bold text-slate-500">전체 진행 상황</h3>
            <p className="small mt-1 text-slate-500">
              전체 기록 기준 {progress.rangeStartDate} ~ {progress.rangeEndDate}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold tracking-tight ${modeBadgeClass}`}
            >
              {modeText}
            </span>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-center text-xs font-semibold text-slate-500">목표 진행률</p>
            <ProgressRing percent={progress.progressPercent} mode={progress.mode} />
          </div>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
            <p className="mb-1 text-xs text-slate-500">전체 기간 변화</p>
            <p className={`text-xl font-black ${accentTextClass}`}>
              {toSignedKg(progress.overallChangeKg)} <span className="text-sm font-medium">kg</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
            <p className="mb-1 text-xs text-slate-500">{remainingLabel}</p>
            <p className={`text-xl font-black ${accentTextClass}`}>
              {toKg(progress.remainingKg)} <span className="text-sm font-medium">kg</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
            <p className="mb-1 text-xs text-slate-500">이번 주 목표 {directionLabel}</p>
            <p className={`text-xl font-black ${accentTextClass}`}>
              {toKg(progress.weeklyRequiredKg)} <span className="text-sm font-medium">kg</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
            <p className="mb-1 text-xs text-slate-500">이번 주 실제 {directionLabel}</p>
            <p className={`text-xl font-black ${accentTextClass}`}>
              {toSignedKg(progress.weeklyActualKg)} <span className="text-sm font-medium">kg</span>
            </p>
            <p className="small mt-1 text-slate-500">주간 목표 대비 {toPercentText(progress.weeklyAchievementPercent)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm">
            <p className="mb-1 text-xs text-slate-500">현재 평균 {directionLabel} 속도</p>
            <p className={`text-xl font-black ${accentTextClass}`}>
              {toKg(progress.pacePerWeekKg)} <span className="text-sm font-medium">kg/주</span>
            </p>
            <p className="small mt-1 text-slate-500">필요 속도 대비 {toPercentText(progress.paceVsRequiredPercent)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
