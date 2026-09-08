import { PGlite } from "@electric-sql/pglite";
import { createServer } from "pglite-server";
import { execFileSync, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const database = new PGlite();
await database.waitReady;
const schema = execFileSync(process.execPath, [
  "node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"
], { encoding: "utf8" });
// Recreate the deployed enum before this change, then apply the production upgrade twice.
await database.exec(schema.replace(", 'biceps', 'triceps'", ""));
await database.exec(`
  INSERT INTO "User" ("id","email","passwordHash") VALUES
    ('qa-user','qa@example.invalid','unused'), ('other-user','other@example.invalid','unused');
  INSERT INTO "Profile" ("userId","sex","age","heightCm","timezone","activity","updatedAt")
    VALUES ('qa-user','male',30,175,'Asia/Seoul','moderate',CURRENT_TIMESTAMP);
  INSERT INTO "Plan" ("id","userId","phase","goalType","goalValue","startDate","endDate","targetCalories","targetCarbsG","targetProteinG","targetFatG","updatedAt")
    VALUES ('qa-plan','qa-user','cut','target_weight',68,'2026-07-01','2026-12-31',2000,240,140,60,CURRENT_TIMESTAMP);
  INSERT INTO "UserSetting" ("userId","updatedAt") VALUES ('qa-user',CURRENT_TIMESTAMP);
  INSERT INTO "WorkoutBodyPartLog" ("id","userId","date","bodyPart","updatedAt") VALUES
    ('legacy-arm','qa-user','2026-09-06','arms','2026-09-06'),
    ('legacy-leg','qa-user','2026-08-20','legs','2026-08-20'),
    ('other-arm','other-user','2026-09-06','arms','2026-09-06'),
    ('chest','qa-user','2026-09-01','chest','2026-09-01'),
    ('shoulders','qa-user','2026-09-02','shoulders','2026-09-02'),
    ('back','qa-user','2026-09-03','back','2026-09-03'),
    ('front','qa-user','2026-08-28','front_legs','2026-08-28'),
    ('rear','qa-user','2026-09-05','back_legs','2026-09-05');
  INSERT INTO "DailyCheckin" ("id","userId","date","adherenceStatus","intakeKnown","intakeCalories","updatedAt")
    VALUES ('old-checkin','qa-user','2026-08-20','good',true,2100,CURRENT_TIMESTAMP);
  INSERT INTO "CoachingLog" ("id","userId","reason","inputSnapshot","outputJson") VALUES
    ('old-coaching','qa-user','manual_request','{}','{}');
`);
for (let index = 0; index < 60; index++) {
  const date = new Date(Date.UTC(2026, 6, 11 + index));
  await database.query('INSERT INTO "WeighIn" ("id","userId","date","weightKg","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)',
    ["weight-" + index, "qa-user", date.toISOString(), Number((75.6 - index * .045 + Math.sin(index) * .2).toFixed(1))]);
}
const before = (await database.query('SELECT * FROM "WorkoutBodyPartLog" ORDER BY "id"')).rows;
const migration = await readFile("prisma/migrations/20260908000000_split_arm_parts/migration.sql", "utf8");
await database.exec(migration);
await database.exec(migration);
assert.deepEqual((await database.query('SELECT * FROM "WorkoutBodyPartLog" ORDER BY "id"')).rows, before);
console.log("Verified: additive migration preserves all legacy rows and can be repeated.");

const pgServer = createServer(database);
await new Promise((resolve, reject) => {
  pgServer.once("error", reject);
  pgServer.listen(55432, "127.0.0.1", resolve);
});
const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:55432/postgres?connection_limit=1";
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3100", "--hostname", "127.0.0.1"], {
  stdio: "inherit", env: { ...process.env, AUTH_SECRET: "local-e2e-secret-only", DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl }
});
async function close() {
  next.kill();
  pgServer.close();
  await database.close();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
next.on("exit", () => { pgServer.close(); void database.close().then(() => process.exit(0)); });
