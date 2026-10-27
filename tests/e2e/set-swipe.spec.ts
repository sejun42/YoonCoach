import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import { exerciseCatalog } from "../../src/lib/exercise-catalog";
import { newEntry } from "../../src/lib/workouts";

const name = "바벨 플랫 벤치프레스";
const payload = Buffer.from(JSON.stringify({ userId: "qa-user", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
const token = payload + "." + createHmac("sha256", "local-e2e-secret-only").update(payload).digest("base64url");
const auth = { cookie: "yc_session=" + token };
test.use({ hasTouch: true });
async function open(page: Page, date: string) {
  const entry = newEntry(exerciseCatalog.find((item) => item.name === name)!);
  entry.sets = [{ weight: 60, reps: 8 }, { weight: 55, reps: 10, type: "drop" }, { weight: 50, reps: 12 }];
  expect((await page.request.put("/api/workouts", { headers: auth, data: { date, revision: 0, entries: [entry], note: "스와이프 검증" } })).ok()).toBe(true);
  await page.context().addCookies([{ name: "yc_session", value: token, domain: "127.0.0.1", path: "/" }]);
  await page.goto("/workouts/" + date);
  const card = page.getByRole("article", { name, exact: true });
  await expect(card.locator(".set-row")).toHaveCount(3);
  await card.scrollIntoViewIfNeeded();
  return card;
}
async function touchSwipe(page: Page, number: number, dx: number, dy = 0) {
  const row = page.locator(".set-row").nth(number - 1);
  await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  const x = box.x + box.width * .6, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test("touch swipe reveals red action, cancels safely, deletes only on tap and autosaves the correct set", async ({ page }) => {
  const date = "2026-03-01";
  const card = await open(page, date);
  await expect(card.locator(".swipe-set-delete").first()).toBeHidden();
  await touchSwipe(page, 2, -90);
  const row = card.locator(".swipe-set").nth(1);
  await expect(row).toHaveAttribute("data-open", "true");
  await expect(card.locator(".set-row")).toHaveCount(3);
  const remove = row.getByRole("button", { name: "2세트 삭제", exact: true });
  await expect(remove).toBeVisible();
  expect(await remove.evaluate((button) => getComputedStyle(button).backgroundColor)).toBe("rgb(222, 51, 69)");
  await page.screenshot({ path: "test-results/set-swipe-reveal.png" });
  await touchSwipe(page, 2, 90);
  await expect(row).toHaveAttribute("data-open", "false");
  await expect(row.locator(".swipe-set-delete")).toBeHidden();
  await touchSwipe(page, 2, -90);
  await remove.click();
  await expect(card.locator(".set-row")).toHaveCount(2);
  await expect(card.getByLabel("1세트 무게", { exact: true })).toHaveValue("60");
  await expect(card.getByLabel("2세트 무게", { exact: true })).toHaveValue("50");
  await expect(page.getByRole("status")).toContainText("자동 저장했습니다", { timeout: 10000 });
  await page.reload();
  await expect(card.locator(".set-row")).toHaveCount(2);
  await expect(card.getByLabel("2세트 횟수", { exact: true })).toHaveValue("12");
});

test("vertical scrolling, short drags and typing do not reveal or delete; keyboard and single-row guard work", async ({ page }) => {
  const card = await open(page, "2026-03-02");
  await touchSwipe(page, 2, -15);
  await expect(card.locator('[data-open="true"]')).toHaveCount(0);
  await touchSwipe(page, 2, -4, -70);
  await expect(card.locator('[data-open="true"]')).toHaveCount(0);
  await expect(card.locator(".set-row")).toHaveCount(3);
  const weight = card.getByLabel("2세트 무게", { exact: true });
  await weight.tap(); await weight.fill("57.5");
  await expect(weight).toHaveValue("57.5");
  await card.getByRole("button", { name: "2세트 유형: 드랍세트", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "2세트 유형" })).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await card.getByRole("button", { name: "2세트 복사해 아래에 추가" }).click();
  await expect(card.locator(".set-row")).toHaveCount(4);
  await expect(card.getByLabel("3세트 무게", { exact: true })).toHaveValue("57.5");
  await expect(card.getByLabel("4세트 무게", { exact: true })).toHaveValue("50");
  const row = card.locator(".swipe-set").nth(1);
  await row.focus(); await page.keyboard.press("ArrowLeft");
  await expect(row).toHaveAttribute("data-open", "true");
  await page.keyboard.press("Tab");
  await expect(row.getByRole("button", { name: "2세트 삭제" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(row).toHaveAttribute("data-open", "false");
  for (let count = 4; count > 1; count--) {
    const first = card.locator(".swipe-set").first();
    await first.focus(); await page.keyboard.press("ArrowLeft");
    await first.getByRole("button", { name: "1세트 삭제" }).click();
    await expect(card.locator(".set-row")).toHaveCount(count - 1);
  }
  await touchSwipe(page, 1, -90);
  await expect(card.locator('[data-open="true"]')).toHaveCount(0);
  await expect(card.locator(".set-row")).toHaveCount(1);
});

test("compact rows align at mobile widths and the selected logo reaches header, favicon and install icons", async ({ page }) => {
  const card = await open(page, "2026-03-03");
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await card.locator(".set-row").evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
    expect(sizes).toEqual([40, 40, 40]);
    await expect(card.getByRole("button", { name: "1세트 유형: 일반" })).toHaveText("1");
    await expect(card.getByRole("button", { name: "2세트 유형: 드랍세트" })).toHaveText("2드랍");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.locator('.brand img')).toHaveAttribute('src', '/icon-lift.svg');
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toBe('/icon-lift.svg');
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/apple-touch-icon-lift.png');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
});
