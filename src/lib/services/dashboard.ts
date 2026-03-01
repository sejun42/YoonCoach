import type { PlanPhase } from "@prisma/client";
import { db } from "@/lib/db";
import { daysAgo, toYmd } from "@/lib/date";
import { calculateWeeklyRatePercent, movingAverage } from "@/lib/calculations";

export async function getDashboardData(userId: string) {
  const [profile, plan, weighIns, checkins] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.plan.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: "desc" }
    }),
    db.weighIn.findMany({
      where: { userId },
      orderBy: { date: "asc" }
    }),
    db.dailyCheckin.findMany({
      where: { userId, date: { gte: daysAgo(6) } },
      orderBy: { date: "asc" }
    })
  ]);

  const weighIns7d = weighIns.filter((w) => w.date >= daysAgo(6));
  const ma = movingAverage(
    weighIns.map((w) => ({
      date: w.date,
      weightKg: w.weightKg
    })),
    7
  );

  const ma7 = ma.filter((m) => m.date >= daysAgo(6));
  const firstAvg = ma7[0]?.avg ?? null;
  const lastAvg = ma7[ma7.length - 1]?.avg ?? null;
  const delta7 = firstAvg !== null && lastAvg !== null ? Number((lastAvg - firstAvg).toFixed(2)) : null;
  const weeklyRatePercent =
    firstAvg !== null && lastAvg !== null
      ? Number(calculateWeeklyRatePercent(firstAvg, lastAvg).toFixed(2))
      : null;

  const adherence = {
    good: checkins.filter((c) => c.adherenceStatus === "good").length,
    ok: checkins.filter((c) => c.adherenceStatus === "ok").length,
    bad: checkins.filter((c) => c.adherenceStatus === "bad").length,
    unknown: checkins.filter((c) => !c.intakeKnown).length
  };

  return {
    profile,
    plan,
    weighIns: weighIns.map((w) => ({ ...w, date: toYmd(w.date) })),
    movingAverages: ma.map((m) => ({ date: toYmd(m.date), avg: Number(m.avg.toFixed(2)) })),
    weighInCount7d: weighIns7d.length,
    checkinCount7d: checkins.length,
    delta7dAvgKg: delta7,
    weeklyRatePercent,
    adherence
  };
}

export function makeWeeklySummary(
  delta7dAvgKg: number | null,
  adherenceBad: number,
  phase: PlanPhase | null | undefined
) {
  if (delta7dAvgKg === null) {
    return "최근 데이터가 아직 부족해요. 공복 체중 4회 이상 기록해 주세요.";
  }

  if (adherenceBad >= 3) {
    return "이번 주는 준수율 개선이 우선이에요. 칼로리 조정보다 루틴 고정을 먼저 해보세요.";
  }

  if (phase === "bulk") {
    if (delta7dAvgKg >= 0.6) {
      return "체중 증가 속도가 빠른 편이에요. 과도한 벌크를 피하도록 추세를 확인해요.";
    }
    if (delta7dAvgKg >= 0.15) {
      return "체중이 안정적으로 증가하고 있어요. 현재 벌크 목표를 유지해도 좋아요.";
    }
    if (delta7dAvgKg >= -0.1) {
      return "증가 속도가 다소 느려요. 식사량과 섭취 기록 정확도를 점검해요.";
    }
    return "체중이 감소 중이에요. 벌크 단계에서는 칼로리 상향을 우선 검토해요.";
  }

  if (delta7dAvgKg <= -0.5) {
    return "최근 7일 평균이 잘 내려가고 있어요. 현재 목표를 유지해도 좋아요.";
  }
  if (delta7dAvgKg < -0.15) {
    return "최근 7일 평균이 천천히 내려가는 중이에요. 좋은 흐름입니다.";
  }
  if (delta7dAvgKg <= 0.15) {
    return "체중 평균이 정체 구간이에요. 데이터가 충분하면 자동 코칭이 조정될 거예요.";
  }
  return "최근 평균이 올라가고 있어요. 체크인 정확도를 높여 코칭 조정을 반영해요.";
}
