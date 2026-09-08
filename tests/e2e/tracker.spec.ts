import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

function token(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return payload + "." + createHmac("sha256", "local-e2e-secret-only").update(payload).digest("base64url");
}
async function login(context: BrowserContext, userId = "qa-user") {
  await context.addCookies([{ name: "yc_session", value: token(userId), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
}
async function ready(page: Page, url = "/weights") {
  await login(page.context());
  await page.clock.install({ time: new Date("2026-09-08T03:00:00Z") });
  await page.goto(url);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "주 메뉴" }).getByRole("link", { name, exact: true });

test("three tabs switch without server navigation and keep input on back/forward", async ({ page }) => {
  await ready(page);
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(3);
  await expect(page.getByLabel("체중 (kg)", { exact: true })).toBeEnabled();
  await page.getByLabel("체중 (kg)", { exact: true }).fill("72.4");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/api/workout-parts?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  const start = Date.now();
  await nav(page, "부위").click();
  await expect(page.getByRole("heading", { name: "운동 부위", exact: true })).toBeVisible({ timeout: 1000 });
  expect(Date.now() - start).toBeLessThan(1000);
  await nav(page, "설정").click();
  await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
  await nav(page, "체중").click();
  await expect(page.getByLabel("체중 (kg)", { exact: true })).toHaveValue("72.4");
  await page.goBack();
  await expect(nav(page, "설정")).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(nav(page, "체중")).toHaveAttribute("aria-current", "page");
  expect(requests.filter((url) => url.includes("_rsc") || url.endsWith("/api/dashboard/today"))).toHaveLength(0);
  expect(requests.filter((url) => url.endsWith("/api/weighins"))).toHaveLength(0);
  await noOverflow(page);
});

test("legacy arm records survive selecting biceps and triceps, save, and reload", async ({ page }) => {
  await ready(page, "/body-parts");
  await expect(page.getByRole("checkbox", { name: "이두", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "2026-09-06 팔 (기존)", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "팔 (기존)", exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: "이두", exact: true }).check();
  await page.getByRole("checkbox", { name: "삼두", exact: true }).check();
  await expect(page.getByRole("checkbox", { name: "팔 (기존)", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "2026-09-06 기록을 저장했습니다." })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "2026-09-06 이두, 삼두, 팔 (기존)", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "이두", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "삼두", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "팔 (기존)", exact: true })).toBeChecked();
  const other = await page.context().request.get("/api/workout-parts?month=2026-09&today=2026-09-08", { headers: { cookie: "yc_session=" + token("other-user") } });
  expect((await other.json()).logs.map((row: { body_part: string }) => row.body_part)).toEqual(["arms"]);
  await noOverflow(page);
});

test("saved edits survive tabs; failed writes keep the draft; clearing a day is persistent", async ({ page }) => {
  await ready(page, "/body-parts");
  await expect(page.getByRole("checkbox", { name: "이두", exact: true })).toBeEnabled();
  await page.getByRole("checkbox", { name: "이두", exact: true }).check();
  await page.route("**/api/workout-parts?**", (route) => route.request().method() === "PUT" ? route.fulfill({ status: 500, body: "{}" }) : route.continue());
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "요청을 처리하지 못했습니다." })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "이두", exact: true })).toBeChecked();
  await page.unroute("**/api/workout-parts?**");
  await nav(page, "체중").click();
  await nav(page, "부위").click();
  await expect(page.getByRole("checkbox", { name: "이두", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "기록을 저장했습니다." })).toBeVisible();
  await page.getByRole("button", { name: "모두 해제", exact: true }).click();
  await page.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "기록을 지웠습니다." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "이두", exact: true })).not.toBeChecked();
});

test("two-decimal weights save, edit, refresh charts, and retain goal drafts", async ({ page }) => {
  await ready(page);
  await expect(page.getByLabel("체중 (kg)", { exact: true })).toBeEnabled();
  await expect(page.locator(".record-list li strong").first()).toHaveText(/\d+\.\d0 kg/);
  await page.getByLabel("체중 (kg)", { exact: true }).fill("72.34");
  await page.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "체중 기록을 수정했습니다." })).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("72.34kg");
  await expect(page.locator(".record-list li strong").first()).toHaveText("72.34 kg");
  await page.getByRole("button", { name: "2026-09-07 체중 수정", exact: true }).click();
  await page.getByLabel("2026-09-07 수정 체중", { exact: true }).fill("72.29");
  await page.locator(".row-edit").getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(page.locator(".row-edit")).toHaveCount(0);
  await expect(page.locator(".metric-value").nth(1)).toHaveText("+0.05kg");
  await expect(page.locator(".record-list")).toContainText("72.29 kg");
  await page.getByRole("button", { name: "1개월", exact: true }).click();
  await page.locator(".recharts-line-dot").last().hover();
  await expect(page.locator(".recharts-tooltip-wrapper")).toContainText("72.34 kg");
  await page.getByRole("button", { name: "주별", exact: true }).click();
  await page.locator(".recharts-line-dot").last().hover();
  await expect(page.locator(".recharts-tooltip-wrapper")).toContainText(((72.29 + 72.34) / 2).toFixed(2) + " kg");
  const rows = (await (await page.request.get("/api/weighins")).json()).weighIns as { date: string; weight_kg: number }[];
  const recent = rows.filter((row) => row.date >= "2026-09-02" && row.date <= "2026-09-08");
  await expect(page.locator(".metric-value").nth(2)).toHaveText((recent.reduce((sum, row) => sum + row.weight_kg, 0) / recent.length).toFixed(2) + "kg");
  expect(rows.find((row) => row.date === "2026-09-08")?.weight_kg).toBe(72.34);
  expect(rows.find((row) => row.date === "2026-09-07")?.weight_kg).toBe(72.29);
  await nav(page, "설정").click();
  await expect(page.getByLabel("목표 체중 (kg)", { exact: true })).toBeVisible();
  await page.getByLabel("목표 체중 (kg)", { exact: true }).fill("67.45");
  await nav(page, "체중").click();
  await nav(page, "설정").click();
  await expect(page.getByLabel("목표 체중 (kg)", { exact: true })).toHaveValue("67.45");
  await page.getByRole("button", { name: "목표 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "목표를 저장했습니다." })).toBeVisible();
  await nav(page, "체중").click();
  await expect(page.locator(".goal-line")).toContainText("67.45 kg");
  await page.reload();
  await expect(page.locator(".metric-value").first()).toHaveText("72.34kg");
  await expect(page.locator(".record-list")).toContainText("72.29 kg");
  await expect(page.locator(".goal-line")).toContainText("67.45 kg");
});

test("two-decimal metrics fit small screens across the supported weight range", async ({ page }) => {
  await page.route("**/api/weighins", (route) => route.fulfill({ json: { ok: true, weighIns: [
    { id: "range-low", date: "2026-09-07", weight_kg: 30 },
    { id: "range-high", date: "2026-09-08", weight_kg: 299.99 }
  ] } }));
  await ready(page);
  await expect(page.locator(".metric-value").first()).toHaveText("299.99kg");
  for (const width of [320, 361, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator(".metric-value").evaluateAll((elements) => elements.map((element) => ({ value: element.textContent, overflow: element.scrollWidth > element.clientWidth })).filter((metric) => metric.overflow)), "Metric overflow at " + width + "px").toEqual([]);
    await noOverflow(page);
  }
});

test("API validates dates, scopes records, excludes future recommendations, and exports legacy data", async ({ request }) => {
  const headers = { cookie: "yc_session=" + token("qa-user") };
  expect((await request.get("/api/workout-parts")).status()).toBe(401);
  expect((await request.put("/api/workout-parts", { headers, data: { date: "2026-02-30", body_parts: ["biceps"] } })).status()).toBe(400);
  expect((await request.get("/api/workout-parts?month=2026-13", { headers })).status()).toBe(400);
  const future = await request.put("/api/workout-parts?today=2026-09-08", { headers, data: { date: "2026-10-01", body_parts: ["triceps"] } });
  expect(future.ok()).toBe(true);
  const month = await request.get("/api/workout-parts?month=2026-08&today=2026-09-08", { headers });
  const data = await month.json();
  expect(data.logs.every((row: { date: string }) => row.date.startsWith("2026-08"))).toBe(true);
  expect(data.logs.some((row: { body_part: string }) => row.body_part === "legs")).toBe(true);
  expect(data.last_dates.every((row: { date: string }) => row.date <= "2026-09-08")).toBe(true);
  const csv = await request.get("/api/export/csv", { headers });
  const text = await csv.text();
  expect(text).toContain("# workout_body_parts");
  expect(text).toContain("2026-08-20,legs");
  expect(text).toContain("2026-09-06,arms");
  expect(text).toContain("2026-08-20,good");
  expect(text).toContain("manual_request");
});

test("responsive screenshots show all three screens without clipped controls", async ({ page }) => {
  await ready(page);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ["체중", "부위", "설정"]) {
      await nav(page, tab).click();
      await expect(page.locator(".loading-state:visible")).toHaveCount(0);
      await noOverflow(page);
      await page.screenshot({ path: "test-results/" + width + "-" + tab + ".png", fullPage: true });
    }
  }
});
