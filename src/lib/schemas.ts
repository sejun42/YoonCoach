import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

export const loginSchema = signUpSchema;

export const profileSchema = z.object({
  sex: z.enum(["male", "female"]),
  age: z.number().int().min(14).max(100),
  height_cm: z.number().int().min(120).max(230),
  weight_kg: z.number().min(30).max(300),
  activity: z.enum(["very_low", "low", "moderate", "high", "very_high"]),
  timezone: z.string().min(2).max(120)
});

export const planInitSchema = z.object({
  goal_type: z.enum(["target_weight", "weekly_rate"]),
  goal_value: z.number().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_phase: z.enum(["calibration", "cut", "bulk"])
});

export const planPatchSchema = z.object({
  goal_type: z.enum(["target_weight", "weekly_rate"]).optional(),
  goal_value: z.number().positive().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferred_phase: z.enum(["calibration", "cut", "bulk"]).optional()
});

export const weighInCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight_kg: z.number().min(30).max(300)
});

export const checkinSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adherence_status: z.enum(["good", "ok", "bad"]),
  intake_known: z.boolean(),
  intake_calories: z.number().int().positive().optional().nullable(),
  intake_carbs_g: z.number().int().nonnegative().optional().nullable(),
  intake_protein_g: z.number().int().nonnegative().optional().nullable(),
  intake_fat_g: z.number().int().nonnegative().optional().nullable()
});

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  }),
  device_meta: z.record(z.any()).optional()
});

export const settingsSchema = z.object({
  notify_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  coaching_day_of_week: z.number().int().min(0).max(6).optional(),
  coaching_time: z.string().regex(/^\d{2}:\d{2}$/).optional()
});
