export const ACTIVITY_FACTORS = {
  very_low: 1.2,
  low: 1.35,
  moderate: 1.5,
  high: 1.7,
  very_high: 1.9
} as const;

export const MIN_CALORIES_BY_SEX = {
  male: 1500,
  female: 1200
} as const;

export const DEFAULT_NOTIFY_TIME = "08:30";
export const DEFAULT_COACHING_TIME = "09:00";
export const DEFAULT_COACHING_DAY = 0; // Sunday
