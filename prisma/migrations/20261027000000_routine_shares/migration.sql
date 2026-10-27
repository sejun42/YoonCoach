ALTER TABLE "WorkoutRoutine" ADD COLUMN IF NOT EXISTS "importedFrom" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutRoutine_userId_importedFrom_key" ON "WorkoutRoutine"("userId", "importedFrom");
CREATE TABLE IF NOT EXISTS "RoutineShare" (
  "token" TEXT PRIMARY KEY,
  "routineId" TEXT NOT NULL REFERENCES "WorkoutRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "entries" JSONB NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "RoutineShare_routineId_key" ON "RoutineShare"("routineId");
