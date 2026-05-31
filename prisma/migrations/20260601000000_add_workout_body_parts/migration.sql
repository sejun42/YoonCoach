-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BodyPart') THEN
        CREATE TYPE "BodyPart" AS ENUM ('chest', 'shoulders', 'back', 'legs', 'arms');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkoutBodyPartLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bodyPart" "BodyPart" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutBodyPartLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkoutBodyPartLog_userId_date_idx" ON "WorkoutBodyPartLog"("userId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkoutBodyPartLog_userId_bodyPart_date_idx" ON "WorkoutBodyPartLog"("userId", "bodyPart", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutBodyPartLog_userId_date_bodyPart_key" ON "WorkoutBodyPartLog"("userId", "date", "bodyPart");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'WorkoutBodyPartLog_userId_fkey'
    ) THEN
        ALTER TABLE "WorkoutBodyPartLog"
        ADD CONSTRAINT "WorkoutBodyPartLog_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
