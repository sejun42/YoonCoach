-- Existing exercise IDs, sessions, preferences and private catalogs are preserved.
ALTER TABLE "CustomExercise" ADD COLUMN IF NOT EXISTS "publicAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CustomExercise_publicAt_idx" ON "CustomExercise"("publicAt");
ALTER TABLE "UserSetting" ADD COLUMN IF NOT EXISTS "shareExercisesWeekly" BOOLEAN NOT NULL DEFAULT false;
