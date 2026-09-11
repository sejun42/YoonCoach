import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { nutritionSchema, nutritionSeries, parseNutritionLine } from "../../src/lib/nutrition";

const line = "식단마감|날짜=2026-09-09|칼로리=2870|탄수=428|단백질=177|지방=50.5|목표칼로리=2620|목표탄수=350|목표단백질=170|목표지방=60";
function cookie(userId = "qa-user") {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return payload + "." + createHmac("sha256", "local-e2e-secret-only").update(payload).digest("base64url");
}
async function openNutrition(page: Page) {
  await page.context().addCookies([{ name: "yc_session", value: cookie(), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.clock.install({ time: new Date("2026-09-11T03:00:00Z") });
  await page.goto("/weights");
  await page.getByRole("tab", { name: "칼로리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "칼로리 기록", exact: true })).toBeVisible();
  await expect(page.locator("#nutrition-panel .loading-state")).toHaveCount(0);
}

test("closing-line parser preserves decimals, zeros, and unknown values without inferring targets", () => {
  expect(parseNutritionLine(line)).toEqual({ date: "2026-09-09", calories: 2870, carbs: 428, protein: 177, fat: 50.5, targetCalories: 2620, targetCarbs: 350, targetProtein: 170, targetFat: 60 });
  const unknown = parseNutritionLine(line.replace("칼로리=2870", "칼로리=미상").replace("지방=50.5", "지방=0").replace("목표칼로리=2620", "목표칼로리=미상"));
  expect(unknown.calories).toBeNull();
  expect(unknown.targetCalories).toBeNull();
  expect(unknown.fat).toBe(0);
  expect(parseNutritionLine("  " + line.replaceAll("|", " | ") + "  ").protein).toBe(177);
  for (const invalid of [line + "|탄수=200", line.replace("|지방=50.5", ""), line.replace("칼로리=2870", "칼로리=2,870"),
    line.replace("지방=50.5", "지방=-1"), line.replace("탄수=428", "탄수=428g"), line.replace("단백질=177", "단백질=1e3"),
    line.replace("2026-09-09", "2026-02-30"), line.replace("2026-09-09", "2026-13-01"), line + "\n" + line,
    line.replace("지방=50.5", "지방="), line.replace("지방=50.5", "지방=100001"), line.replace("목표지방", "목표비방")]) {
    expect(() => parseNutritionLine(invalid)).toThrow();
  }
});

test("nutrition averages use recorded days, distinguish zero from missing, and retain historical targets", () => {
  const base = parseNutritionLine(line);
  const records = [
    { ...base, date: "2026-09-01", calories: 9999 },
    { ...base, date: "2026-09-08", calories: 2570 }, base,
    { ...base, date: "2026-09-10", calories: null, targetCalories: null },
    { ...base, date: "2026-09-12", calories: 9999 }
  ];
  const rows = nutritionSeries(records, "2026-09-11", 4, "calories");
  expect(rows.map((row) => row.intake)).toEqual([2570, 2870, null, null]);
  expect(rows.map((row) => row.target)).toEqual([2620, 2620, null, null]);
  expect(rows.at(-1)?.average).toBe(2720);
  expect(rows.at(-1)?.recordedDays).toBe(2);
  expect(nutritionSeries([...records, { ...base, date: "2026-09-11", calories: 0, targetCalories: 2800 }], "2026-09-11", 1, "calories")[0]).toMatchObject({ intake: 0, target: 2800, average: 5440 / 3, recordedDays: 3 });
});

test("paste, preview, retry, tab retention, confirmed replacement, editing, and deletion", async ({ page }) => {
  await openNutrition(page);
  const input = page.getByLabel("마감 기록", { exact: true });
  await input.fill(line);
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  await expect(page.getByLabel("지방 섭취", { exact: true })).toHaveValue("50.5");
  await expect(page.getByLabel("칼로리 목표", { exact: true })).toHaveValue("2620");
  expect((await (await page.request.get("/api/nutrition")).json()).records.some((row: { date: string }) => row.date === "2026-09-09")).toBe(false);
  await page.route("**/api/nutrition", (route) => route.request().method() === "PUT" ? route.fulfill({ status: 500, json: {} }) : route.continue());
  await page.getByRole("button", { name: "마감 저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "저장하지 못했습니다" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "주 메뉴" });
  await nav.getByRole("link", { name: "부위", exact: true }).click();
  await nav.getByRole("link", { name: "체중", exact: true }).click();
  await expect(input).toHaveValue(line);
  await expect(page.getByLabel("지방 섭취", { exact: true })).toHaveValue("50.5");
  await page.unroute("**/api/nutrition");
  await page.getByRole("button", { name: "마감 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "2026-09-09 마감 기록을 저장했습니다." })).toBeVisible();
  await expect(page.locator(".nutrition-summary")).toContainText("2,870");
  await input.fill(line.replace("칼로리=2870", "칼로리=2900"));
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "마감 수정 저장", exact: true }).click();
  await expect(page.getByLabel("칼로리 섭취", { exact: true })).toHaveValue("2900");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "마감 수정 저장", exact: true }).click();
  await expect(page.locator(".nutrition-editor")).toHaveCount(0);
  const saved = (await (await page.request.get("/api/nutrition")).json()).records.filter((row: { date: string }) => row.date === "2026-09-09");
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ calories: 2900, fat: 50.5, targetCalories: 2620 });
  await page.getByRole("button", { name: "2026-09-09 마감 수정", exact: true }).click();
  await page.getByLabel("단백질 섭취", { exact: true }).fill("177.5");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "마감 수정 저장", exact: true }).click();
  await expect(page.locator(".nutrition-editor")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "칼로리", exact: true }).click();
  await page.locator(".nutrition-history > li").filter({ hasText: "2026.09.09" }).getByText("섭취 · 목표", { exact: true }).click();
  await expect(page.locator(".nutrition-table").first()).toContainText("177.5");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "2026-09-09 마감 삭제", exact: true }).click();
  await expect(page.getByRole("button", { name: "2026-09-09 마감 수정", exact: true })).toHaveCount(0);
  expect((await (await page.request.get("/api/nutrition")).json()).records.some((row: { date: string }) => row.date === "2026-09-09")).toBe(false);
});

test("a concurrent save requires reviewing the latest record and retains the pasted draft", async ({ page }) => {
  await openNutrition(page);
  const input = page.getByLabel("마감 기록", { exact: true });
  const closing = line.replace("2026-09-09", "2026-09-05");
  await input.fill(closing.replace("지방=50.5", "지방=50.5g"));
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  await expect(page.locator("#nutrition-panel").getByRole("alert")).toContainText("단위나 쉼표 없는 숫자");
  await expect(page.locator(".nutrition-editor")).toHaveCount(0);
  await input.fill(closing);
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  expect((await page.request.put("/api/nutrition", { data: { record: { ...parseNutritionLine(closing), calories: 2800 }, sourceText: closing, expectedUpdatedAt: null } })).ok()).toBe(true);
  await page.getByRole("button", { name: "마감 저장", exact: true }).click();
  await expect(page.locator("#nutrition-panel").getByRole("alert")).toContainText("다른 곳에서 기록이 변경됐습니다");
  await expect(input).toHaveValue(closing);
  await expect(page.getByLabel("칼로리 섭취", { exact: true })).toHaveValue("2870");
  await expect(page.locator(".nutrition-editor")).toContainText("2,800 kcal");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "마감 수정 저장", exact: true }).click();
  await expect(page.locator(".nutrition-editor")).toHaveCount(0);
  const saved = (await (await page.request.get("/api/nutrition")).json()).records.filter((row: { date: string }) => row.date === "2026-09-05");
  expect(saved).toHaveLength(1);
  expect(saved[0].calories).toBe(2870);
  await page.getByRole("tab", { name: "칼로리", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "체중", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "체중 기록", exact: true })).toBeVisible();
});

test("nutrition API enforces auth, dates, revisions and user isolation; exports targets and preserves legacy check-ins", async ({ request }) => {
  const headers = { cookie: "yc_session=" + cookie() };
  const otherHeaders = { cookie: "yc_session=" + cookie("other-user") };
  const record = { ...parseNutritionLine(line), date: "2026-08-20" };
  const before = (await (await request.get("/api/nutrition", { headers })).json()).records.find((row: { date: string }) => row.date === record.date);
  const payload = { record, sourceText: line, expectedUpdatedAt: before.updatedAt };
  expect((await request.get("/api/nutrition")).status()).toBe(401);
  expect((await request.put("/api/nutrition", { data: payload })).status()).toBe(401);
  expect((await request.delete("/api/nutrition", { data: { date: record.date, expectedUpdatedAt: before.updatedAt } })).status()).toBe(401);
  expect((await request.put("/api/nutrition", { headers, data: { ...payload, record: { ...record, date: "2026-02-30" } } })).status()).toBe(400);
  expect((await request.put("/api/nutrition", { headers, data: { ...payload, record: { ...record, calories: -10 } } })).status()).toBe(400);
  expect((await request.put("/api/nutrition", { headers, data: { ...payload, userId: "other-user" } })).status()).toBe(400);
  expect((await request.put("/api/nutrition", { headers, data: { ...payload, sourceText: "=HYPERLINK(1)" } })).status()).toBe(400);
  expect((await request.put("/api/nutrition", { headers: otherHeaders, data: payload })).status()).toBe(409);
  expect((await request.delete("/api/nutrition", { headers: otherHeaders, data: { date: record.date, expectedUpdatedAt: before.updatedAt } })).status()).toBe(409);
  const saved = await request.put("/api/nutrition", { headers, data: payload });
  expect(saved.ok()).toBe(true);
  const result = (await saved.json()).record;
  expect(result.id).toBe(before.id);
  expect(result.fat).toBe(50.5);
  const checkins = (await (await request.get("/api/checkins", { headers })).json()).checkins;
  expect(checkins.find((row: { date: string }) => row.date === record.date).adherence_status).toBe("good");
  expect((await request.put("/api/nutrition", { headers, data: payload })).status()).toBe(409);
  const csv = await (await request.get("/api/export/csv", { headers })).text();
  expect(csv).toContain("target_calories,target_carbs_g,target_protein_g,target_fat_g,nutrition_source");
  expect(csv).toContain("50.5,2620,350,170,60");
  expect((await request.delete("/api/nutrition", { headers, data: { date: record.date, expectedUpdatedAt: result.updatedAt } })).ok()).toBe(true);
  const preserved = (await (await request.get("/api/checkins", { headers })).json()).checkins.find((row: { date: string }) => row.date === record.date);
  expect(preserved).toMatchObject({ id: before.id, adherence_status: "good", intake_calories: null });
  const deletedConflict = await request.put("/api/nutrition", { headers, data: { ...payload, expectedUpdatedAt: result.updatedAt } });
  expect(deletedConflict.status()).toBe(409);
  expect((await deletedConflict.json()).current).toBeNull();
  expect((await request.put("/api/nutrition", { headers, data: { ...payload, expectedUpdatedAt: null } })).ok()).toBe(true);
  const unknown = { ...parseNutritionLine(line), date: "2026-09-10", calories: null, targetCalories: null, fat: 0 };
  const savedUnknown = await request.put("/api/nutrition", { headers, data: { record: unknown, sourceText: null, expectedUpdatedAt: null } });
  expect(savedUnknown.ok()).toBe(true);
  expect((await savedUnknown.json()).record).toMatchObject({ calories: null, targetCalories: null, fat: 0 });
  const racePayload = { record: { ...record, date: "2026-09-07" }, sourceText: line, expectedUpdatedAt: null };
  const races = await Promise.all([request.put("/api/nutrition", { headers, data: racePayload }), request.put("/api/nutrition", { headers, data: racePayload })]);
  expect(races.map((response) => response.status()).sort()).toEqual([200, 409]);
});

test("nutrition mobile and desktop layouts render charts, previews and history without overflow", async ({ page }) => {
  await openNutrition(page);
  const rows = [7, 8, 9, 10, 11].map((day) => ({ id: "view-" + day, updatedAt: "2026-09-11T00:00:00.000Z", sourceText: line,
    ...parseNutritionLine(line), date: "2026-09-" + String(day).padStart(2, "0"), calories: 2600 + day * 10 }));
  await page.route("**/api/nutrition", (route) => route.fulfill({ json: { ok: true, records: rows } }));
  await page.getByRole("button", { name: "칼로리 새로고침", exact: true }).click();
  await expect(page.locator(".nutrition-history > li")).toHaveCount(5);
  await page.getByLabel("마감 기록", { exact: true }).fill(line);
  await page.getByRole("button", { name: "기록 확인", exact: true }).click();
  await page.locator(".nutrition-history > li").first().getByText("섭취 · 목표", { exact: true }).click();
  await page.locator(".nutrition-history > li").first().getByText("가져온 원문", { exact: true }).click();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator(".nutrition-chart .recharts-bar-rectangle")).not.toHaveCount(0);
    await page.screenshot({ path: "test-results/nutrition-" + width + ".png", fullPage: true });
  }
  await page.getByRole("group", { name: "영양소 선택" }).getByRole("button", { name: "지방", exact: true }).click();
  await expect(page.getByRole("img", { name: "지방 섭취 추이", exact: true })).toBeVisible();
  const first = nutritionSchema.strip().parse(rows[0]);
  expect(first.fat).toBe(50.5);
});
