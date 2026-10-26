// Monday 09:00 in Asia/Seoul is Monday 00:00 UTC; Korea has no DST.
export function nextExercisePublication(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7 || 7));
  return next;
}

export type ExerciseSharingStatus = {
  enabled: boolean;
  nextPublicationAt: string;
  privateCount: number;
  scheduledCount: number;
  publishedCount: number;
};
