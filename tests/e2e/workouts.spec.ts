import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import { exerciseCatalog, searchExercise } from "../../src/lib/exercise-catalog";
import { newEntry, representativeParts, exerciseMetrics, starterRoutines, type WorkoutEntry } from "../../src/lib/workouts";

function token(userId = "qa-user") {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return payload + "." + createHmac("sha256", "local-e2e-secret-only").update(payload).digest("base64url");
}
const auth = (userId = "qa-user") => ({ cookie: "yc_session=" + token(userId) });
const chest = () => newEntry(exerciseCatalog.find((item) => item.name === "해머 MTS 체스트 프레스")!);
async function open(page: Page, date = "2026-10-26") {
  await page.context().addCookies([{ name: "yc_session", value: token(), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.clock.install({ time: new Date("2026-10-26T03:00:00Z") });
  await page.goto("/workouts/" + date);
  await expect(page.getByRole("button", { name: "운동 추가", exact: false })).toBeEnabled();
}
async function saveDay(request: APIRequestContext, date: string, entries: WorkoutEntry[], userId = "qa-user") {
  const current = await (await request.get("/api/workouts?date=" + date, { headers: auth(userId) })).json();
  const result = await request.put("/api/workouts", { headers: auth(userId), data: { date, entries, revision: current.session.revision, note: "" } });
  expect(result.ok(), await result.text()).toBe(true);
  return result.json();
}

test("catalog keeps equipment identities, supplied exercises, extras and usable starter routines", () => {
  expect(new Set(exerciseCatalog.map((entry) => entry.id)).size).toBe(exerciseCatalog.length);
  expect(exerciseCatalog.length).toBeGreaterThan(110);
  for (const entry of exerciseCatalog) expect(entry.tags.length).toBeGreaterThan(0);
  for (const entry of exerciseCatalog) expect(entry.tags.length).toBeLessThanOrEqual(2);
  for (const name of ["파나타 디클라인 플라이", "해머 ISO 레터럴 로우", "메가매스 리니어 티바 로우", "덤벨 후면 로우", "시타델 핵프레스", "덤벨 투암 오버헤드 트라이셉스 익스텐션", "페이스풀"]) expect(exerciseCatalog.some((entry) => entry.name === name)).toBe(true);
  expect(searchExercise(exerciseCatalog.find((entry) => entry.name === "해머 ISO 와이드 랫풀다운")!, "헤머 iso 와이드 렛")).toBe(true);
  expect(searchExercise(exerciseCatalog.find((entry) => entry.name === "덤벨 사이드 레터럴 레이즈")!, "사레레")).toBe(true);
  expect(starterRoutines.map((routine) => routine.name)).toEqual(["가슴", "등", "어깨", "팔", "전면하체", "후면하체"]);
  expect(starterRoutines.every((routine) => routine.entries.every((entry) => entry.sets.length === 1 && entry.sets[0].weight === null))).toBe(true);
});

test("representatives rank main work then split set score; metrics exclude blank sets", () => {
  const main = { ...chest(), isMain: true, sets: [{ weight: 20, reps: 10 }] };
  const back = { ...chest(), id: "back", tags: ["back"] as const, sets: Array.from({ length: 5 }, () => ({ weight: 30, reps: 10 })) };
  const shoulders = { ...chest(), id: "shoulder", tags: ["shoulders"] as const, sets: [{ weight: 10, reps: 10 }, { weight: null, reps: null }] };
  const entries = [main, { ...back, tags: [...back.tags] }, { ...shoulders, tags: [...shoulders.tags] }];
  expect(representativeParts(entries)).toEqual(["chest", "back"]);
  expect(representativeParts(entries.map((entry) => ({ ...entry, isMain: false })))).toEqual(["back", "chest"]);
  expect(representativeParts([{ ...chest(), tags: ["shoulders", "triceps"], isMain: true, sets: [{ weight: null, reps: null }] }])).toEqual([]);
  expect(exerciseMetrics({ ...chest(), sets: [{ weight: 50, reps: 8 }, { weight: 50, reps: 10 }, { weight: 40, reps: 12 }, { weight: null, reps: null }] })).toEqual({ weight: 50, reps: 10, totalReps: 30, sets: 3, volume: 1380 });
  expect(exerciseMetrics({ ...chest(), sets: [{ weight: 0, reps: 12 }] })?.reps).toBe(12);
});

test("API rejects malformed and foreign entries, handles conflicts, and isolates users", async ({ request }) => {
  expect((await request.get("/api/workouts?date=2026-10-01")).status()).toBe(401);
  expect((await request.get("/api/workouts/library")).status()).toBe(401);
  expect((await request.get("/api/workouts?date=2026-02-30", { headers: auth() })).status()).toBe(400);
  const entry = { ...chest(), sets: [{ weight: 42.5, reps: 10 }] };
  for (const invalid of [
    { ...entry, tags: ["chest", "back", "shoulders"] }, { ...entry, tags: ["chest", "chest"] },
    { ...entry, sets: [{ weight: -1, reps: 10 }] }, { ...entry, sets: [{ weight: 20, reps: 1.2 }] },
    { ...entry, sets: [{ weight: 20, reps: null }] }, { ...entry, id: "unknown" }
  ]) expect((await request.put("/api/workouts", { headers: auth(), data: { date: "2026-10-10", revision: 0, note: "", entries: [invalid] } })).status()).toBe(400);
  const saved = await saveDay(request, "2026-10-10", [entry]);
  expect(saved.session.entries[0].sets[0].weight).toBe(42.5);
  const stale = await request.put("/api/workouts", { headers: auth(), data: { ...saved.session, revision: 0, entries: [] } });
  expect(stale.status()).toBe(409);
  const other = await (await request.get("/api/workouts?date=2026-10-10", { headers: auth("other-user") })).json();
  expect(other.session.entries).toEqual([]);
  const custom = await request.post("/api/workouts/exercises", { headers: auth(), data: { name: "QA 전용 로우", tags: ["back", "biceps"], equipment: "machine" } });
  expect(custom.status()).toBe(201);
  const customEntry = newEntry((await custom.json()).exercise);
  const foreign = await request.put("/api/workouts", { headers: auth("other-user"), data: { date: "2026-10-10", revision: 0, note: "", entries: [customEntry] } });
  expect(foreign.status()).toBe(400);
  const routine = await request.put("/api/workouts/routines", { headers: auth(), data: { name: "QA 루틴", entries: [entry] } });
  const routineData = await routine.json();
  expect(routineData.routine.entries[0].sets).toEqual([{ weight: null, reps: null }]);
  await request.delete("/api/workouts/routines?id=" + routineData.routine.id, { headers: auth("other-user") });
  const library = await (await request.get("/api/workouts/library", { headers: auth() })).json();
  expect(library.routines.some((item: { id: string }) => item.id === routineData.routine.id)).toBe(true);
  const foreignLibrary = await (await request.get("/api/workouts/library", { headers: auth("other-user") })).json();
  expect(foreignLibrary.exercises.some((item: { id: string }) => item.id === customEntry.id)).toBe(false);
});

test("history separates dates and exercises; legacy calendar survives clearing new sessions; CSV contains sets", async ({ request }) => {
  const entry = { ...chest(), sets: [{ weight: 60, reps: 8 }], settings: [{ label: "안장 높이", value: "3" }] };
  await saveDay(request, "2026-10-15", [entry]);
  await saveDay(request, "2026-10-20", [{ ...entry, sets: [{ weight: 60, reps: 10 }], settings: [{ label: "안장 높이", value: "4" }] }]);
  await saveDay(request, "2026-10-15", [{ ...entry, sets: [{ weight: 60, reps: 9 }] }]);
  const library = await (await request.get("/api/workouts/library", { headers: auth() })).json();
  expect(library.preferences[entry.id]).toEqual([{ label: "안장 높이", value: "4" }]);
  await saveDay(request, "2026-12-01", [{ ...entry, sets: [{ weight: 200, reps: 15 }] }]);
  const history = await (await request.get("/api/workouts/history?exerciseId=" + encodeURIComponent(entry.id) + "&through=2026-10-26", { headers: auth() })).json();
  expect(history.history.every((row: { date: string }) => row.date <= "2026-10-26")).toBe(true);
  expect(history.history.find((row: { date: string }) => row.date === "2026-10-15").entry.settings).toEqual([{ label: "안장 높이", value: "3" }]);
  const otherHistory = await (await request.get("/api/workouts/history?exerciseId=" + encodeURIComponent(entry.id) + "&through=2026-10-26", { headers: auth("other-user") })).json();
  expect(otherHistory.history).toEqual([]);
  await saveDay(request, "2026-09-06", [entry]);
  let month = await (await request.get("/api/workout-parts?month=2026-09&today=2026-10-26", { headers: auth() })).json();
  expect(month.logs.filter((row: { date: string }) => row.date === "2026-09-06").map((row: { body_part: string }) => row.body_part)).toEqual(["chest"]);
  await saveDay(request, "2026-09-06", []);
  month = await (await request.get("/api/workout-parts?month=2026-09&today=2026-10-26", { headers: auth() })).json();
  expect(month.logs.filter((row: { date: string }) => row.date === "2026-09-06").map((row: { body_part: string }) => row.body_part)).toEqual(["arms"]);
  const csv = await (await request.get("/api/export/csv", { headers: auth() })).text();
  expect(csv).toContain("# workout_sets"); expect(csv).toContain("해머 MTS 체스트 프레스"); expect(csv).toContain("# workout_routines"); expect(csv).toContain("2026-09-06,arms");
});

test("calendar opens a separate journal; mobile recording, settings, routines, retry and reload work", async ({ page }) => {
  await open(page, "2026-10-26");
  await page.getByRole("link", { name: "운동 캘린더", exact: true }).click();
  await page.getByRole("link", { name: "2026-10-26 기록 없음", exact: true }).click();
  await expect(page).toHaveURL(/\/workouts\/2026-10-26$/);
  await page.getByRole("button", { name: "운동 추가", exact: false }).click();
  const dialog = page.getByRole("dialog", { name: "운동 추가" });
  await dialog.getByLabel("운동 검색").fill("헤머 mts 체스트");
  await dialog.getByRole("button", { name: "해머 MTS 체스트 프레스 추가", exact: true }).click();
  await dialog.getByRole("button", { name: "선택 완료", exact: true }).click();
  const card = page.getByRole("article", { name: "해머 MTS 체스트 프레스", exact: true });
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("");
  await expect(card.locator(".set-row")).toHaveCount(1);
  await card.getByLabel("1세트 무게", { exact: true }).fill("65");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("8");
  await card.getByRole("button", { name: "세트 추가", exact: true }).click();
  await card.getByLabel("2세트 무게", { exact: true }).fill("60");
  await card.getByLabel("2세트 횟수", { exact: true }).fill("12");
  await card.getByRole("button", { name: "메인", exact: true }).click();
  await card.getByRole("button", { name: "해머 MTS 체스트 프레스 세부 설정", exact: true }).click();
  await page.getByLabel("안장 높이", { exact: true }).fill("5");
  await page.getByLabel("가슴 패드", { exact: true }).fill("2");
  await page.getByLabel("새 설정 항목", { exact: true }).fill("손잡이 위치");
  await page.getByRole("button", { name: "항목 추가", exact: true }).click();
  await page.getByLabel("손잡이 위치", { exact: true }).fill("안쪽");
  await page.getByRole("button", { name: "설정 적용", exact: true }).click();
  await page.getByRole("button", { name: "루틴으로 저장", exact: true }).click();
  await page.getByLabel("루틴 이름", { exact: true }).fill("가슴 A");
  await page.getByRole("button", { name: "루틴 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link", { name: "체중", exact: true }).click();
  await expect(page.locator(".workout-screen")).toHaveCount(0);
  await page.goBack();
  await expect(card.getByLabel("2세트 횟수", { exact: true })).toHaveValue("12");
  await page.route("**/api/workouts", (route) => route.request().method() === "PUT" ? route.fulfill({ status: 500, json: {} }) : route.continue());
  await page.getByRole("button", { name: "운동 기록 저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "요청을 처리하지 못했습니다" })).toBeVisible();
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("65");
  await page.unroute("**/api/workouts");
  await page.getByRole("button", { name: "운동 기록 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("운동 기록을 저장했습니다");
  await page.reload();
  await expect(card.getByLabel("2세트 횟수", { exact: true })).toHaveValue("12");
  await expect(card.locator(".settings-summary")).toContainText("손잡이 위치 안쪽");
  await expect(page.locator(".representative-parts .workout-tag")).toHaveText(["가슴"]);
  await page.getByRole("button", { name: "같은 무게의 횟수", exact: true }).click();
  await page.getByLabel("횟수 비교 무게", { exact: true }).selectOption("60");
  await expect(page.locator(".progress-summary > div").first()).toContainText("12");
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Overflow at " + width).toBe(true);
    const columns = await card.locator(".set-grid").evaluate((grid) => {
      const headers = [...grid.children].slice(0, 4).map((item) => item.getBoundingClientRect());
      const row = [...grid.querySelector(".set-row")!.children].map((item) => item.getBoundingClientRect());
      return { aligned: row.every((box, index) => Math.abs(box.left - headers[index].left) < 1), widths: row.slice(1, 3).map((box) => box.width) };
    });
    expect(columns.aligned, "Set column alignment at " + width).toBe(true);
    expect(columns.widths.every((value) => value >= 70), "Input width at " + width).toBe(true);
    await page.screenshot({ path: "test-results/workout-journal-" + width + ".png", fullPage: true });
  }
  await page.getByRole("link", { name: "운동 캘린더", exact: true }).click();
  await expect(page.getByRole("link", { name: "2026-10-26 가슴", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "2026-10-25 기록 없음", exact: true }).click();
  await page.getByRole("button", { name: "루틴 불러오기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "가슴 A 1개 종목 · 2세트", exact: true }).click();
  await expect(card.locator(".set-row")).toHaveCount(2);
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("");
  await expect(card.locator(".settings-summary")).toContainText("안장 높이 5");
  await page.getByRole("button", { name: "운동 기록 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("운동 기록을 저장했습니다");
});

test("custom exercise picker limits tags, makes account-owned exercises and preserves historical legacy labels", async ({ page }) => {
  await open(page, "2026-09-06");
  await page.getByText("이 날짜의 기존 부위 기록", { exact: true }).click();
  await expect(page.locator(".legacy-workout .workout-tag")).toHaveText(["팔 (기존)"]);
  await page.getByRole("button", { name: "운동 추가", exact: false }).click();
  await page.getByRole("button", { name: "직접 종목 만들기", exact: true }).click();
  await page.getByLabel("종목 이름", { exact: true }).fill("나만의 테스트 머신");
  const tags = page.locator(".custom-exercise .tag-picker");
  await tags.getByRole("button", { name: "가슴", exact: true }).click();
  await tags.getByRole("button", { name: "어깨", exact: true }).click();
  await expect(tags.getByRole("button", { name: "등", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "내 종목으로 저장하고 추가", exact: true }).click();
  await page.getByRole("button", { name: "선택 완료", exact: true }).click();
  await expect(page.getByRole("article", { name: "나만의 테스트 머신", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "운동 기록 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("운동 기록을 저장했습니다");
});
