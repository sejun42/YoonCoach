-- Preserve existing check-ins; targets are historical snapshots, not the current plan.
BEGIN;
ALTER TABLE public."DailyCheckin"
  ALTER COLUMN "adherenceStatus" DROP NOT NULL,
  ALTER COLUMN "intakeCalories" TYPE DOUBLE PRECISION,
  ALTER COLUMN "intakeCarbsG" TYPE DOUBLE PRECISION,
  ALTER COLUMN "intakeProteinG" TYPE DOUBLE PRECISION,
  ALTER COLUMN "intakeFatG" TYPE DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "nutritionTargetCalories" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "nutritionTargetCarbsG" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "nutritionTargetProteinG" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "nutritionTargetFatG" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "nutritionSource" TEXT;
COMMIT;
