-- Additive, repeatable upgrade: existing weight, nutrition and body-part rows are untouched.
ALTER TYPE "BodyPart" ADD VALUE IF NOT EXISTS 'core';

CREATE TABLE IF NOT EXISTS "WorkoutSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "date" TIMESTAMP(3) NOT NULL,
  "entries" JSONB NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutSession_userId_date_key" ON "WorkoutSession"("userId", "date");

CREATE TABLE IF NOT EXISTS "WorkoutRoutine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "entries" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutRoutine_userId_name_key" ON "WorkoutRoutine"("userId", "name");

CREATE TABLE IF NOT EXISTS "CustomExercise" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL,
  "equipment" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomExercise_userId_name_key" ON "CustomExercise"("userId", "name");

CREATE TABLE IF NOT EXISTS "ExercisePreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "exerciseId" TEXT NOT NULL,
  "settings" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExercisePreference_userId_exerciseId_key" ON "ExercisePreference"("userId", "exerciseId");
