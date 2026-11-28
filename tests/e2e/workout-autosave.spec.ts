import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import { exerciseCatalog } from "../../src/lib/exercise-catalog";
import { newEntry } from "../../src/lib/workouts";

const name = "바벨 플랫 벤치프레스";
function token(userId = "qa-user") {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return payload + "." + createHmac("sha256", "local-e2e-secret-only").update(payload).digest("base64url");
}
const auth = (userId = "qa-user") => ({ cookie: "yc_session=" + token(userId) });
const stored = async (request: APIRequestContext, date: string) => (await (await request.get("/api/workouts?date=" + date, { headers: auth() })).json()).session;
async function open(page: Page, date: string) {
  await page.context().addCookies([{ name: "yc_session", value: token(), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.clock.install({ time: new Date("2026-10-27T03:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-27T03:00:01Z"));
  await page.goto("/workouts/" + date);
  await expect(page.getByRole("button", { name: "운동 추가", exact: false })).toBeEnabled();
  await page.getByRole("button", { name: "운동 추가", exact: false }).click();
  await page.getByLabel("운동 검색").fill(name);
  await page.getByRole("button", { name: name + " 추가", exact: true }).click();
  await page.getByRole("button", { name: "선택 완료", exact: true }).click();
  return page.getByRole("article", { name, exact: true });
}

test("manual parts persist without sets and share two calendar slots with completed exercises", async ({ page, request }) => {
  const date = "2026-02-28";
  await page.context().addCookies([{ name: "yc_session", value: token(), domain: "127.0.0.1", path: "/" }]);
  await page.goto("/workouts/" + date);
  const choose = page.getByRole("button", { name: "부위 직접 체크" });
  const back = page.getByRole("button", { name: "등", exact: true });
  await choose.click();
  await back.click();
  await page.getByRole("button", { name: "운동 기록 저장", exact: true }).click();
  await expect.poll(async () => (await stored(request, date)).manualParts).toEqual(["back"]);
  await page.reload();
  await expect(page.locator(".representative-parts .workout-tag")).toHaveText(["등"]);
  await expect(page.locator(".session-summary")).toContainText("0세트");
  const calendarParts = async () => {
    const res = await request.get("/api/workout-parts?month=2026-02", { headers: auth() });
    return (await res.json()).logs.filter((log: { date: string }) => log.date === date).map((log: { body_part: string }) => log.body_part);
  };
  expect(await calendarParts()).toEqual(["back"]);
  const session = await stored(request, date);
  const bench = newEntry(exerciseCatalog.find(e => e.name === name)!);
  bench.sets = [{ weight: 60, reps: 8, completed: true }];
  expect((await request.put("/api/workouts", { headers: auth(), data: { ...session, entries: [bench] } })).ok()).toBe(true);
  expect(await calendarParts()).toEqual(["back", "chest"]);
  await page.reload();
  await choose.click();
  await back.click();
  await page.getByRole("button", { name: "운동 기록 저장", exact: true }).click();
  await expect.poll(calendarParts).toEqual(bench.tags.slice(0, 2));
});

test("machine gyms save separately from the session and appear in the picker", async ({ page, request }) => {
  const barbell = await open(page, "2026-02-25");
  await expect(barbell.locator(".gym-selector")).toHaveCount(0);
  const machine = exerciseCatalog.find(item => item.equipment === "machine")!;
  const addButton = page.locator(".add-exercise");
  await addButton.click();
  await page.getByLabel("운동 검색").fill(machine.name);
  const result = page.getByRole("button", { name: machine.name + " 추가", exact: true });
  await result.click();
  await page.getByRole("button", { name: "선택 완료" }).click();
  const card = page.getByRole("article", { name: machine.name, exact: true });
  const summary = card.locator(".gym-selector summary");
  await expect(summary).toHaveText("헬스장");
  await summary.click();
  for (const gym of ["에이블짐 수유점", "키스트 헬스장"]) {
    await card.getByLabel(gym, { exact: true }).click();
    await expect(summary).toContainText(gym);
  }
  const peer = await request.get("/api/workouts/library", { headers: auth("other-user") });
  expect((await peer.json()).gyms[machine.id]).toBeUndefined();
  await page.goto("/workouts/2026-02-26");
  await addButton.click();
  await page.getByLabel("운동 검색").fill(machine.name);
  await expect(result).toContainText("키스트 헬스장");
  await expect(result).toContainText("에이블짐 수유점");
  await result.click();
  await page.getByRole("button", { name: "선택 완료" }).click();
  await summary.click();
  await card.getByLabel("키스트 헬스장", { exact: true }).click();
  await expect(summary).toHaveText("헬스장에이블짐 수유점");
});

test("pasted targets become recorded sets only when checked and survive reload", async ({ page, request }) => {
  const date = "2026-02-01";
  const card = await open(page, date);
  await page.getByRole("button", { name: "GPT 루틴 붙여넣기" }).click();
  await page.getByLabel("추천 루틴").fill(name + "|80|8|일반|2\n" + name + "|60|10|드랍세트|1");
  await page.getByRole("button", { name: "이 날짜의 계획 교체" }).click();
  await expect(card.getByRole("checkbox")).toHaveCount(3);
  await expect(page.locator(".session-summary")).toContainText("0세트");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("6");
  await card.getByLabel("1세트 수행 완료").check();
  const timer = page.getByRole("timer");
  await expect(timer).toHaveText("0분 00초");
  await expect(page.locator(".session-summary")).toContainText("480kg·회");
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request,date)).entries[0].sets[0]).toMatchObject({reps:6,completed:true});
  await page.clock.runFor(60000);
  await expect(timer).toHaveText("1분 05초");
  await card.getByRole("button", {name:"1세트 유형: 일반"}).click();
  await page.getByRole("button", {name:"RIR 2회",exact:true}).click();
  await page.getByRole("button", {name:"닫기",exact:true}).click();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
  await page.getByRole("button", {name:"오늘 기록 복사"}).click();
  await expect(page.getByRole("button", {name:"복사했습니다"})).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split(/\r?\n/)).toEqual([date + " 운동 기록", "", expect.stringContaining(name), "1세트: 80kg × 6회 / 일반 / RIR 2"]);
  await expect(timer).toHaveText("1분 05초");
  const start = await page.evaluate(() => Date.now());
  await page.goto("/body-parts");
  await page.clock.fastForward(30000);
  await page.goto("/workouts/" + date);
  await expect(timer).toBeVisible();
  const elapsed = await page.evaluate(first => Math.floor((Date.now() - first) / 1000) + 65, start);
  await expect(timer).toHaveText(Math.floor(elapsed / 60) + "분 " + String(elapsed % 60).padStart(2,"0") + "초");
  await page.reload();
  await expect(timer).toBeVisible();
  await card.getByLabel("2세트 수행 완료").check();
  await expect(timer).toHaveText("0분 00초");
  await page.clock.runFor(1000);
  await card.getByLabel("2세트 수행 완료").uncheck();
  await expect(timer).toHaveText("0분 01초");
  await page.getByRole("button", {name:"휴식 타이머 닫기"}).click();
  await expect(timer).toHaveCount(0);
  await page.reload();
  await expect(card.getByLabel("1세트 수행 완료")).toBeChecked();
  await expect(timer).toHaveCount(0);
  await expect(card.getByLabel("2세트 수행 완료")).not.toBeChecked();
});

test("replacing a full plan is repeatable and clearing it preserves performed sets and the day note", async ({ page, request }) => {
  const date = "2026-02-27";
  const card = await open(page, date);
  await page.getByLabel("오늘의 메모").fill("세션 메모");
  const openImport = page.getByRole("button", { name: "GPT 루틴 붙여넣기" });
  const input = page.getByLabel("추천 루틴");
  const replace = page.getByRole("button", { name: "이 날짜의 계획 교체" });
  const clear = page.getByRole("button", { name: "이 날짜의 미수행 계획 비우기" });
  await openImport.click();
  await input.fill(name + "|80|8|일반|3");
  await replace.click();
  await card.getByLabel("2세트 횟수", { exact: true }).fill("6");
  await card.getByLabel("2세트 수행 완료").check();
  for (let i = 0; i < 2; i++) {
    await openImport.click();
    await input.fill(name + "|75|10|일반|2");
    await replace.click();
    await expect(card.locator(".set-row")).toHaveCount(2);
    await expect(card.getByLabel("2세트 횟수", { exact: true })).toHaveValue("6");
  }
  await openImport.click();
  await input.fill("0");
  page.once("dialog", dialog => dialog.dismiss());
  await clear.click();
  await expect(input).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await clear.click();
  await page.clock.runFor(5000);
  await expect.poll(async () => (await stored(request, date)).entries[0]?.sets).toEqual([
    { weight: 80, reps: 6, type: "normal", completed: true }
  ]);
  await page.reload();
  await expect(page.getByLabel("오늘의 메모")).toHaveValue("세션 메모");
  await card.getByLabel("1세트 수행 완료").uncheck();
  await openImport.click();
  page.once("dialog", dialog => dialog.accept());
  await clear.click();
  await page.clock.runFor(5000);
  await expect.poll(async () => (await stored(request, date)).entries).toEqual([]);
});

test("copy inserts the current set below without overwriting later sets and autosaves after five seconds", async ({ page, request }) => {
  const date = "2026-02-11";
  const card = await open(page, date);
  let writes = 0;
  page.on("request", (r) => { if (r.method() === "PUT" && r.url().endsWith("/api/workouts")) writes++; });
  await card.getByLabel("1세트 무게", { exact: true }).fill("65");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("8");
  await card.getByRole("button", { name: "1세트 복사해 아래에 추가" }).click();
  await expect(card.getByLabel("2세트 무게", { exact: true })).toHaveValue("65");
  await expect(card.getByLabel("2세트 횟수", { exact: true })).toHaveValue("8");
  await card.getByLabel("2세트 무게", { exact: true }).fill("60");
  await card.getByLabel("2세트 횟수", { exact: true }).fill("12");
  await card.getByRole("button", { name: "2세트 복사해 아래에 추가" }).click();
  await expect(card.getByLabel("3세트 무게", { exact: true })).toHaveValue("60");
  await expect(card.getByLabel("3세트 횟수", { exact: true })).toHaveValue("12");
  await card.getByLabel("3세트 무게", { exact: true }).fill("55");
  await expect(card.getByLabel("2세트 무게", { exact: true })).toHaveValue("60");
  await card.getByRole("button", { name: "1세트 복사해 아래에 추가" }).click();
  await expect(card.locator(".set-row")).toHaveCount(4);
  await expect(card.getByLabel("2세트 무게", { exact: true })).toHaveValue("65");
  await expect(card.getByLabel("3세트 무게", { exact: true })).toHaveValue("60");
  await expect(card.getByLabel("4세트 무게", { exact: true })).toHaveValue("55");
  await card.getByLabel("2세트 무게", { exact: true }).fill("64");
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("65");
  await page.clock.runFor(4999); expect(writes).toBe(0);
  await card.getByLabel("4세트 횟수", { exact: true }).fill("10");
  await page.clock.runFor(4999); expect(writes).toBe(0);
  await page.clock.runFor(1);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect(writes).toBe(1);
  expect((await stored(request, date)).entries[0].sets).toEqual([{ weight: 65, reps: 8, completed: false }, { weight: 64, reps: 8, completed: false }, { weight: 60, reps: 12, completed: false }, { weight: 55, reps: 10, completed: false }]);
  await page.reload();
  await expect(card.getByLabel("4세트 횟수", { exact: true })).toHaveValue("10");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: "test-results/workout-autosave-copy.png", fullPage: true });
});

test("partial sets survive autosave and reload without being counted as completed sets", async ({ page, request }) => {
  const date = "2026-02-12";
  const card = await open(page, date);
  await card.getByLabel("1세트 무게", { exact: true }).fill("70");
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request, date)).entries[0].sets).toEqual([{ weight: 70, reps: null, completed: false }]);
  await expect(page.locator(".session-summary")).toContainText("0세트");
  await page.reload();
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("70");
  await expect(card.getByLabel("1세트 횟수", { exact: true })).toHaveValue("");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("9");
  await expect(page.locator(".session-summary")).toContainText("0세트");
  await card.getByLabel("1세트 수행 완료").check();
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  await expect(page.locator(".session-summary")).toContainText("1세트");
});

test("failed saves retain local inputs through reload and retry after reconnect", async ({ page, request }) => {
  const date = "2026-02-13";
  const card = await open(page, date);
  await page.route("**/api/workouts", (route) => route.fulfill({ status: 500, json: {} }));
  await card.getByLabel("1세트 무게", { exact: true }).fill("72.5");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("7");
  await page.clock.runFor(5000);
  await expect(page.getByRole("alert").filter({ hasText: "요청을 처리하지 못했습니다" })).toBeVisible();
  await page.reload();
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("72.5");
  await expect(card.getByLabel("1세트 횟수", { exact: true })).toHaveValue("7");
  await page.unroute("**/api/workouts");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request, date)).entries[0].sets[0]).toEqual({ weight: 72.5, reps: 7, completed: false });
});

test("slow responses cannot erase typing made while a save is in flight", async ({ page, request }) => {
  const date = "2026-02-14";
  const card = await open(page, date);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let started = false;
  await page.route("**/api/workouts", async (route) => { if (!started) { started = true; await gate; } await route.continue(); });
  await card.getByLabel("1세트 무게", { exact: true }).fill("80");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("5");
  await page.clock.runFor(5000);
  await expect.poll(() => started).toBe(true);
  await expect(card.getByLabel("1세트 횟수", { exact: true })).toBeEnabled();
  await card.getByLabel("1세트 횟수", { exact: true }).fill("8");
  release();
  await expect.poll(async () => (await stored(request, date)).revision).toBe(1);
  await expect(card.getByLabel("1세트 횟수", { exact: true })).toHaveValue("8");
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request, date)).entries[0].sets[0].reps).toBe(8);
});

test("the pending save continues after navigating away from the workout", async ({ page, request }) => {
  const date = "2026-02-15";
  const card = await open(page, date);
  await card.getByLabel("1세트 무게", { exact: true }).fill("0");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("15");
  await page.getByRole("link", { name: "운동 캘린더", exact: true }).click();
  await expect(page.locator(".workout-screen")).toHaveCount(0);
  await page.clock.runFor(5000);
  await expect.poll(async () => (await stored(request, date)).entries[0]?.sets[0]).toEqual({ weight: 0, reps: 15, completed: false });
});

test("a committed save with a lost response is reconciled after reload before newer edits are saved", async ({ page, request }) => {
  const date = "2026-02-16";
  const card = await open(page, date);
  await page.route("**/api/workouts", async (route) => { await route.fetch(); await route.abort("failed"); });
  await card.getByLabel("1세트 무게", { exact: true }).fill("90");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("4");
  await page.clock.runFor(5000);
  await expect(page.locator(".workout-screen").getByRole("alert")).toBeVisible();
  expect((await stored(request, date)).revision).toBe(1);
  await page.reload();
  await expect(card.getByLabel("1세트 횟수", { exact: true })).toHaveValue("4");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("6");
  await page.unroute("**/api/workouts");
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request, date)).entries[0].sets[0].reps).toBe(6);
});

test("remote edits cause a recoverable conflict instead of silently overwriting either draft", async ({ page, request }) => {
  const date = "2026-02-17";
  const card = await open(page, date);
  await card.getByLabel("1세트 무게", { exact: true }).fill("100");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("3");
  const other = { ...newEntry(exerciseCatalog.find(e => e.name === name)!), sets: [{ weight: 110, reps: 2 }] };
  expect((await request.put("/api/workouts", { headers: auth(), data: { date, revision: 0, entries: [other], note: "다른 화면" } })).ok()).toBe(true);
  await page.clock.runFor(5000);
  await expect(page.getByRole("alert").filter({ hasText: "다른 화면" })).toBeVisible();
  await page.reload();
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("100");
  await page.clock.runFor(5000);
  await expect(page.getByRole("button", { name: "임시 입력 다운로드" })).toBeVisible();
  expect((await stored(request, date)).entries[0].sets[0].weight).toBe(110);
  await page.context().addCookies([{ name: "yc_session", value: token("other-user"), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.reload();
  await expect(page.getByRole("button", { name: "운동 추가", exact: false })).toBeEnabled();
  await expect(card).toHaveCount(0);
});

test("identical stale retries are idempotent and a stale tab cannot save into another account", async ({ request }) => {
  const date = "2026-02-18";
  const entry = { ...newEntry(exerciseCatalog.find(e => e.name === name)!), sets: [{ weight: null, reps: 12 }] };
  const data = { date, revision: 0, entries: [entry], note: "" };
  const first = await request.put("/api/workouts", { headers: auth(), data });
  expect(first.ok()).toBe(true);
  const retry = await request.put("/api/workouts", { headers: auth(), data });
  expect(retry.ok()).toBe(true);
  expect((await retry.json()).session.revision).toBe((await first.json()).session.revision);
  const wrongAccount = await request.put("/api/workouts", { headers: { ...auth("other-user"), "X-Workout-Owner": "qa-user" }, data });
  expect(wrongAccount.status()).toBe(403);
});

test("inputs are durably staged immediately, even before the first debounce completes", async ({ page, request }) => {
  const date = "2026-02-19";
  const card = await open(page, date);
  await card.getByLabel("1세트 무게", { exact: true }).fill("82.5");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("6");
  const recovery = await page.evaluate((date) => JSON.parse(localStorage.getItem("yooncoach:workout-draft:v1:qa-user:" + date)!), date);
  expect(recovery.session.entries[0].sets[0]).toEqual({ weight: 82.5, reps: 6, completed: false });
  await page.reload();
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("82.5");
  await expect(card.getByLabel("1세트 횟수", { exact: true })).toHaveValue("6");
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request, date)).entries[0].sets[0]).toEqual({ weight: 82.5, reps: 6, completed: false });
});

test("out-of-range inputs remain recoverable until corrected instead of silently disappearing", async ({ page, request }) => {
  const date = "2026-02-20";
  const card = await open(page, date);
  await card.getByLabel("1세트 무게", { exact: true }).fill("2001");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("8");
  await page.clock.runFor(5000);
  await expect(page.getByRole("alert").filter({ hasText: "입력 범위를 확인" })).toBeVisible();
  expect((await stored(request, date)).revision).toBe(0);
  await page.reload();
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("2001");
  await card.getByLabel("1세트 무게", { exact: true }).fill("20");
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request, date)).entries[0].sets[0].weight).toBe(20);
});

test("unavailable local storage is clearly reported without preventing server saves", async ({ page, request }) => {
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("yooncoach:workout-draft:")) throw new DOMException("Quota exceeded", "QuotaExceededError");
      setItem.call(this, key, value);
    };
  });
  const date = "2026-02-21";
  const card = await open(page, date);
  await card.getByLabel("1세트 무게", { exact: true }).fill("50");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("10");
  await expect(page.getByRole("alert").filter({ hasText: "임시 입력을 보관하지 못했습니다" })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request, date)).entries[0].sets[0]).toEqual({ weight: 50, reps: 10, completed: false });
});
