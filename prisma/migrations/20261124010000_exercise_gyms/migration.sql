CREATE TABLE IF NOT EXISTS "ExerciseGym" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "exerciseId" TEXT NOT NULL,
  "gym" TEXT NOT NULL,
  PRIMARY KEY ("userId", "exerciseId", "gym")
);
