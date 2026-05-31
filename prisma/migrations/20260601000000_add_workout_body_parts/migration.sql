-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('chest', 'shoulders', 'back', 'legs', 'arms');

-- CreateTable
CREATE TABLE "WorkoutBodyPartLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bodyPart" "BodyPart" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutBodyPartLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutBodyPartLog_userId_date_idx" ON "WorkoutBodyPartLog"("userId", "date");

-- CreateIndex
CREATE INDEX "WorkoutBodyPartLog_userId_bodyPart_date_idx" ON "WorkoutBodyPartLog"("userId", "bodyPart", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutBodyPartLog_userId_date_bodyPart_key" ON "WorkoutBodyPartLog"("userId", "date", "bodyPart");

-- AddForeignKey
ALTER TABLE "WorkoutBodyPartLog" ADD CONSTRAINT "WorkoutBodyPartLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
