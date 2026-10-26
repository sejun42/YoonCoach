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

test("copy uses the immediately preceding set and autosave debounces the last input for five seconds", async ({ page, request }) => {
  const date = "2026-02-11";
  const card = await open(page, date);
  let writes = 0;
  page.on("request", (r) => { if (r.method() === "PUT" && r.url().endsWith("/api/workouts")) writes++; });
  await card.getByLabel("1세트 무게", { exact: true }).fill("65");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("8");
  await card.getByRole("button", { name: "세트 추가", exact: true }).click();
  await card.getByRole("button", { name: "2세트에 바로 위 세트 복사" }).click();
  await expect(card.getByLabel("2세트 무게", { exact: true })).toHaveValue("65");
  await expect(card.getByLabel("2세트 횟수", { exact: true })).toHaveValue("8");
  await card.getByLabel("2세트 무게", { exact: true }).fill("60");
  await card.getByLabel("2세트 횟수", { exact: true }).fill("12");
  await card.getByRole("button", { name: "세트 추가", exact: true }).click();
  await card.getByRole("button", { name: "3세트에 바로 위 세트 복사" }).click();
  await expect(card.getByLabel("3세트 무게", { exact: true })).toHaveValue("60");
  await expect(card.getByLabel("3세트 횟수", { exact: true })).toHaveValue("12");
  await card.getByLabel("3세트 무게", { exact: true }).fill("55");
  await expect(card.getByLabel("2세트 무게", { exact: true })).toHaveValue("60");
  await page.clock.runFor(4999); expect(writes).toBe(0);
  await card.getByLabel("3세트 횟수", { exact: true }).fill("10");
  await page.clock.runFor(4999); expect(writes).toBe(0);
  await page.clock.runFor(1);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect(writes).toBe(1);
  expect((await stored(request, date)).entries[0].sets).toEqual([{ weight: 65, reps: 8 }, { weight: 60, reps: 12 }, { weight: 55, reps: 10 }]);
  await page.reload();
  await expect(card.getByLabel("3세트 횟수", { exact: true })).toHaveValue("10");
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
  expect((await stored(request, date)).entries[0].sets).toEqual([{ weight: 70, reps: null }]);
  await expect(page.locator(".session-summary")).toContainText("0세트");
  await page.reload();
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("70");
  await expect(card.getByLabel("1세트 횟수", { exact: true })).toHaveValue("");
  await card.getByLabel("1세트 횟수", { exact: true }).fill("9");
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
  expect((await stored(request, date)).entries[0].sets[0]).toEqual({ weight: 72.5, reps: 7 });
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
  await expect.poll(async () => (await stored(request, date)).entries[0]?.sets[0]).toEqual({ weight: 0, reps: 15 });
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
  expect(recovery.session.entries[0].sets[0]).toEqual({ weight: 82.5, reps: 6 });
  await page.reload();
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("82.5");
  await expect(card.getByLabel("1세트 횟수", { exact: true })).toHaveValue("6");
  await page.clock.runFor(5000);
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다");
  expect((await stored(request, date)).entries[0].sets[0]).toEqual({ weight: 82.5, reps: 6 });
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
  expect((await stored(request, date)).entries[0].sets[0]).toEqual({ weight: 50, reps: 10 });
});
