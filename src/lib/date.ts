export function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function dateFromYmd(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function daysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function startOfIsoWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function isSameIsoWeek(a: Date, b: Date) {
  return toYmd(startOfIsoWeek(a)) === toYmd(startOfIsoWeek(b));
}
