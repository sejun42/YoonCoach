import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { exerciseCatalog } from "../../src/lib/exercise-catalog";
import { newEntry, routineEntries, type WorkoutEntry } from "../../src/lib/workouts";

function token(userId = "qa-user") {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return payload + "." + createHmac("sha256", "local-e2e-secret-only").update(payload).digest("base64url");
}
const auth = (user = "qa-user") => ({ cookie: "yc_session=" + token(user) });
const bench = () => newEntry(exerciseCatalog.find((e) => e.id === "chest-bb:플랫 벤치프레스")!);
const fly = () => newEntry(exerciseCatalog.find((e) => e.id === "chest-machine:팩덱 플라이")!);
async function signIn(page: Page, user = "qa-user") {
  await page.context().addCookies([{ name: "yc_session", value: token(user), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
}
async function saveRoutine(request: APIRequestContext, name: string, entries: WorkoutEntry[], user = "qa-user") {
  const response = await request.put("/api/workouts/routines", { headers: auth(user), data: { name, entries } });
  expect(response.ok()).toBe(true); return (await response.json()).routine;
}
async function shareRoutine(request: APIRequestContext, id: string, user = "qa-user") {
  const response = await request.post("/api/workouts/routines/share", { headers: auth(user), data: { id } });
  expect(response.ok()).toBe(true); const path = (await response.json()).path as string;
  return { path, api: "/api/workouts/routines/shared/" + path.split("/").at(-1) };
}

test("shared snapshots omit private values, import private machines safely, are idempotent and revocable", async ({ request }) => {
  const customResponse = await request.post("/api/workouts/exercises", { headers: auth("share-owner"), data: { name: "공유 전용 머신", tags: ["chest"], equipment: "machine" } });
  const custom = newEntry((await customResponse.json()).exercise);
  const entries: WorkoutEntry[] = [{ ...bench(), sets: [{ weight: 111, reps: 7, type: "mini" }], settings: [{ label: "개인 메모", value: "공개 금지" }] }, custom];
  const original = await saveRoutine(request, "친구 루틴", entries, "share-owner");
  const peerRoutine = await saveRoutine(request, "친구 루틴", [fly()], "share-peer");
  expect((await request.post("/api/workouts/routines/share", { data: { id: original.id } })).status()).toBe(401);
  expect((await request.post("/api/workouts/routines/share", { headers: auth("share-peer"), data: { id: original.id } })).status()).toBe(404);
  const { api } = await shareRoutine(request, original.id, "share-owner");
  const publicData = await (await request.get(api)).json();
  expect(Object.keys(publicData.routine).sort()).toEqual(["entries", "name"]);
  expect(publicData.routine.entries[0].sets).toEqual([{ weight: null, reps: null, type: "mini" }]);
  expect(publicData.routine.entries[0].settings).toEqual([]);
  expect(JSON.stringify(publicData)).not.toContain("공개 금지");
  expect((await request.post(api)).status()).toBe(401);
  const imported = await (await request.post(api, { headers: auth("share-peer") })).json();
  const again = await (await request.post(api, { headers: auth("share-peer") })).json();
  expect(again).toEqual({ id: imported.id, existing: true });
  const library = await (await request.get("/api/workouts/library", { headers: auth("share-peer") })).json();
  expect(library.routines.find((r: { id: string }) => r.id === peerRoutine.id).entries[0].id).toBe(fly().id);
  const received = library.routines.find((r: { id: string }) => r.id === imported.id);
  expect(received.name).toBe("친구 루틴 (공유 2)");
  expect(received.entries[0].id).toBe(bench().id);
  expect(received.entries[1].id).not.toBe(custom.id);
  expect(library.exercises.some((e: { id: string }) => e.id === received.entries[1].id)).toBe(true);
  expect((await request.put("/api/workouts", { headers: auth("share-peer"), data: { date: "2026-01-01", revision: 0, note: "", entries: received.entries } })).ok()).toBe(true);
  await request.delete("/api/workouts/routines/share?id=" + original.id, { headers: auth("share-peer") });
  expect((await request.get(api)).ok()).toBe(true);
  await request.delete("/api/workouts/routines/share?id=" + original.id, { headers: auth("share-owner") });
  expect((await request.get(api)).status()).toBe(404);
  expect((await request.post(api, { headers: auth("share-private") })).status()).toBe(404);
  const after = await (await request.get("/api/workouts/library", { headers: auth("share-peer") })).json();
  expect(after.routines.some((r: { id: string }) => r.id === imported.id)).toBe(true);
});

test("share dialog generates QR and public page previews, keeps login destination, and imports", async ({ page, request, browser }) => {
  const routine = await saveRoutine(request, "QR 테스트 루틴", [bench(), fly()]);
  await signIn(page); await page.goto("/workouts/2026-01-02");
  await page.getByRole("button", { name: "루틴 불러오기", exact: true }).click();
  await page.getByRole("button", { name: routine.name + " 루틴 공유", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "친구에게 루틴 공유" });
  await expect(dialog.getByRole("img", { name: "루틴 공유 QR 코드" })).toBeVisible();
  await expect.poll(() => dialog.locator("canvas").evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(240);
  const url = await dialog.getByLabel("공유 URL").inputValue();
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3100\/routines\/shared\/[a-f0-9]{48}$/);
  await page.screenshot({ path: "test-results/routine-share-dark.png" });
  const context = await browser.newContext();
  const guest = await context.newPage(); await guest.goto(url);
  await expect(guest.getByRole("heading", { name: "QR 테스트 루틴" })).toBeVisible();
  await guest.getByRole("link", { name: "로그인하고 루틴 받기" }).click();
  await expect(guest).toHaveURL(/\/auth\?next=/);
  expect(new URL(guest.url()).searchParams.get("next")).toBe(new URL(url).pathname);
  // Exercise the actual signup flow and preserved return path.
  await guest.getByRole("button", { name: "회원가입", exact: true }).click();
  await guest.getByLabel("이메일", { exact: true }).fill("routine-recipient@example.invalid");
  await guest.getByLabel("비밀번호", { exact: true }).fill("test-password-1299");
  await guest.getByRole("button", { name: "계정 만들기", exact: true }).click();
  await expect(guest).toHaveURL(url);
  await guest.getByRole("button", { name: "내 루틴으로 저장", exact: true }).click();
  await expect(guest.getByRole("status")).toContainText("내 루틴에 저장했습니다");
  await guest.getByRole("link", { name: "운동 캘린더 열기" }).click();
  await expect(guest).toHaveURL(/\/body-parts$/);
  await context.close();
});

test("replacement retains position and template, clears values only with confirmation and autosaves", async ({ page, request }) => {
  const date = "2026-01-03";
  const first = { ...bench(), isMain: true, sets: [{ weight: 60, reps: 8, type: "drop" as const }, { weight: null, reps: null }] };
  await request.put("/api/workouts", { headers: auth(), data: { date, revision: 0, note: "유지할 메모", entries: [first, fly()] } });
  await signIn(page); await page.goto("/workouts/" + date);
  await page.getByRole("button", { name: first.name + " 운동 교체" }).click();
  const picker = page.getByRole("dialog", { name: "운동 교체", exact: true });
  await picker.getByLabel("운동 검색").fill("덤벨 인클라인 프레스");
  page.once("dialog", (dialog) => dialog.dismiss());
  await picker.getByRole("button", { name: "덤벨 인클라인 프레스 교체", exact: true }).click();
  await expect(page.getByRole("article").first()).toHaveAttribute("aria-label", first.name);
  page.once("dialog", (dialog) => dialog.accept());
  await picker.getByRole("button", { name: "덤벨 인클라인 프레스 교체", exact: true }).click();
  await expect(picker).toHaveCount(0);
  const card = page.getByRole("article").first();
  await expect(card).toHaveAttribute("aria-label", "덤벨 인클라인 프레스");
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("");
  await expect(card.locator(".set-row")).toHaveCount(2);
  await expect(card.getByRole("button", { name: "1세트 유형: 드랍세트", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "메인", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article").nth(1)).toHaveAttribute("aria-label", fly().name);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다", { timeout: 10000 });
  await page.reload();
  await expect(card).toHaveAttribute("aria-label", "덤벨 인클라인 프레스");
  await expect(page.getByLabel("오늘의 메모")).toHaveValue("유지할 메모");
});

test("card add inserts selections below in order, preserves records, and resets to append after closing", async ({ page, request }) => {
  const date = "2026-01-07";
  const first = { ...bench(), sets: [{ weight: 80, reps: 8, type: "drop" as const }] };
  const last = { ...fly(), sets: [{ weight: 45, reps: 12 }] };
  const additions = exerciseCatalog.filter((exercise) => ![first.id, last.id].includes(exercise.id)).slice(0, 3);
  await request.put("/api/workouts", { headers: auth(), data: { date, revision: 0, note: "기록 유지", entries: [first, last] } });
  await signIn(page); await page.clock.install(); await page.goto("/workouts/" + date);
  const card = page.getByRole("article", { name: first.name, exact: true });
  for (const action of ["성장 보기", "운동 교체", "아래에 운동 추가"]) {
    const button = card.getByRole("button", { name: first.name + " " + action, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toHaveText("");
  }
  await card.getByRole("button", { name: first.name + " 아래에 운동 추가" }).click();
  const picker = page.getByRole("dialog", { name: "운동 추가", exact: true });
  for (const exercise of additions.slice(0, 2)) {
    await picker.getByLabel("운동 검색").fill(exercise.name);
    await picker.getByRole("button", { name: exercise.name + " 추가", exact: true }).click();
    await expect(picker.getByRole("button", { name: exercise.name + " 추가됨", exact: true })).toBeDisabled();
  }
  await picker.getByRole("button", { name: "선택 완료", exact: true }).click();
  await expect(page.locator(".workout-card h3")).toHaveText([first.name, additions[0].name, additions[1].name, last.name]);
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("80");
  await expect(page.getByRole("article", { name: last.name, exact: true }).getByLabel("1세트 횟수", { exact: true })).toHaveValue("12");
  // Closing an unused insertion picker must also clear its target.
  await card.getByRole("button", { name: first.name + " 아래에 운동 추가" }).click();
  await picker.getByRole("button", { name: "선택 완료", exact: true }).click();
  await page.locator(".add-exercise").click();
  await picker.getByLabel("운동 검색").fill(additions[2].name);
  await picker.getByRole("button", { name: additions[2].name + " 추가", exact: true }).click();
  await picker.getByRole("button", { name: "선택 완료", exact: true }).click();
  const names = [first.name, additions[0].name, additions[1].name, last.name, additions[2].name];
  await expect(page.locator(".workout-card h3")).toHaveText(names);
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  const stored = (await (await request.get("/api/workouts?date=" + date, { headers: auth() })).json()).session;
  expect(stored.entries.map((entry: WorkoutEntry) => entry.name)).toEqual(names);
  expect(stored.entries[0].sets).toEqual(first.sets);
  expect(stored.entries[3].sets).toEqual(last.sets);
  await page.reload();
  await expect(page.locator(".workout-card h3")).toHaveText(names);
  await expect(page.getByLabel("오늘의 메모")).toHaveValue("기록 유지");
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.screenshot({ path: "test-results/card-insert-icons-mobile.png" });
});

test("set type survives local recovery, autosave, routine loading and export; insertion copies source type", async ({ page, request }) => {
  const date = "2026-01-04";
  const entry = { ...bench(), sets: [{ weight: 60, reps: 8 }] };
  await request.put("/api/workouts", { headers: auth(), data: { date, revision: 0, note: "", entries: [entry] } });
  await signIn(page); await page.goto("/workouts/" + date);
  const card = page.getByRole("article", { name: entry.name });
  await card.getByRole("button", { name: "1세트 유형: 일반" }).click();
  await page.getByRole("dialog", { name: "1세트 유형", exact: true }).getByRole("button", { name: "미니세트 짧게 쉬고 이어서 수행" }).click();
  await card.getByRole("button", { name: "1세트 복사해 아래에 추가" }).click();
  await expect(card.getByRole("button", { name: "2세트 유형: 미니세트" })).toBeVisible();
  await page.reload();
  await expect(card.getByRole("button", { name: "2세트 유형: 미니세트" })).toBeVisible();
  await expect(card.getByLabel("2세트 무게", { exact: true })).toHaveValue("60");
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다", { timeout: 10000 });
  const stored = (await (await request.get("/api/workouts?date=" + date, { headers: auth() })).json()).session;
  expect(stored.entries[0].sets[1]).toEqual({ weight: 60, reps: 8, type: "mini" });
  const routine = await saveRoutine(request, "세트 유형 보존", stored.entries);
  expect(routine.entries[0].sets[1]).toEqual({ weight: null, reps: null, type: "mini" });
  const csv = await (await request.get("/api/export/csv", { headers: auth() })).text();
  expect(csv).toContain("set_type"); expect(csv).toContain(",mini,");
  expect(routineEntries(stored.entries)[0].sets[1].type).toBe("mini");
  await page.goto("/workouts/2026-01-06");
  await page.getByRole("button", { name: "루틴 불러오기", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "세트 유형 보존 1개 종목 · 2세트", exact: true }).click();
  await expect(card.getByRole("button", { name: "2세트 유형: 미니세트" })).toBeVisible();
  await expect(card.getByLabel("2세트 무게", { exact: true })).toHaveValue("");
});

test("reordering animates cards, respects reduced motion and dark layouts fit mobile", async ({ page, request }) => {
  const date = "2026-01-05";
  await request.put("/api/workouts", { headers: auth(), data: { date, revision: 0, note: "", entries: [bench(), fly()] } });
  await signIn(page); await page.goto("/workouts/" + date);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    (window as unknown as { moves: number }).moves = 0;
    Element.prototype.animate = function (...args) { if (this.classList.contains("workout-card")) (window as unknown as { moves: number }).moves++; return original.apply(this, args); };
  });
  await page.getByRole("button", { name: bench().name + " 아래로 이동" }).click();
  await expect(page.getByRole("article").first()).toHaveAttribute("aria-label", fly().name);
  expect(await page.evaluate(() => (window as unknown as { moves: number }).moves)).toBe(2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: bench().name + " 위로 이동" }).click();
  expect(await page.evaluate(() => (window as unknown as { moves: number }).moves)).toBe(2);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const colors = await page.evaluate(() => ({ canvas: getComputedStyle(document.querySelector(".app-shell")!).backgroundColor, card: getComputedStyle(document.querySelector(".workout-card")!).backgroundColor }));
    expect(colors.canvas).not.toBe(colors.card);
    await page.screenshot({ path: `test-results/cobalt-workout-${width}.png`, fullPage: true });
  }
  await page.goto("/logo-concepts/index.html");
  await page.setViewportSize({ width: 1200, height: 790 });
  await expect(page.getByRole("heading", { name: "01 · 클래식" })).toBeVisible();
  await page.screenshot({ path: "test-results/logo-concepts.png", fullPage: true });
});
