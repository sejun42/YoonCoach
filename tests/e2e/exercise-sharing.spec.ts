import { test, expect, type APIRequestContext } from "@playwright/test";
import { createHmac } from "node:crypto";
import { nextExercisePublication } from "../../src/lib/exercise-sharing";
import { newEntry } from "../../src/lib/workouts";
import type { Exercise } from "../../src/lib/exercise-catalog";

function token(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return payload + "." + createHmac("sha256", "local-e2e-secret-only").update(payload).digest("base64url");
}
const auth = (userId = "share-owner") => ({ cookie: "yc_session=" + token(userId) });
const library = async (request: APIRequestContext, userId: string) => (await request.get("/api/workouts/library", { headers: auth(userId) })).json();
async function create(request: APIRequestContext, name: string, userId = "share-owner"): Promise<Exercise> {
  const result = await request.post("/api/workouts/exercises", { headers: auth(userId), data: { name, tags: ["back"], equipment: "machine" } });
  expect(result.status(), await result.text()).toBe(201);
  return (await result.json()).exercise;
}

test("release schedule uses Monday 09:00 Korea across week and year boundaries", () => {
  for (const [now, expected] of [
    ["2026-10-25T23:59:59.999Z", "2026-10-26T00:00:00.000Z"],
    ["2026-10-26T00:00:00.000Z", "2026-11-02T00:00:00.000Z"],
    ["2026-10-28T14:00:00.000Z", "2026-11-02T00:00:00.000Z"],
    ["2026-12-31T15:00:00.000Z", "2027-01-04T00:00:00.000Z"]
  ]) expect(nextExercisePublication(new Date(now)).toISOString()).toBe(expected);
});

test("server releases only due metadata; private and future identities cannot be used by others", async ({ request }) => {
  for (const method of ["get", "patch", "post"] as const) expect((await request[method]("/api/workouts/sharing")).status()).toBe(401);
  expect((await request.patch("/api/workouts/sharing", { headers: auth(), data: { enabled: true, userId: "share-private" } })).status()).toBe(400);
  const visible = await library(request, "share-owner");
  expect(visible.exercises.find((e: Exercise) => e.id === "released-machine")).toEqual({ id: "released-machine", name: "공개 시각 지난 머신", tags: ["back"], equipment: "machine", shared: true });
  for (const id of ["existing-private", "future-machine"]) {
    expect(visible.exercises.some((e: Exercise) => e.id === id)).toBe(false);
    const foreign = await request.put("/api/workouts", { headers: auth(), data: { date: "2026-01-01", revision: 0, note: "", entries: [newEntry({ id, name: "forged", tags: ["back"], equipment: "machine" })] } });
    expect(foreign.status()).toBe(400);
  }
  const own = await library(request, "share-private");
  expect(own.exercises.find((e: Exercise) => e.id === "future-machine").custom).toBe(true);
});

test("weekly opt-in schedules existing and future exercises, opt-out cancels pending releases, immediate sharing preserves histories", async ({ request }) => {
  const exercise = await create(request, "공유 시험 머신");
  const peerCopy = await create(request, "공유  시험 머신", "share-peer");
  const original = { ...newEntry(exercise), sets: [{ weight: 120, reps: 8 }], settings: [{ label: "안장 높이", value: "개인 세팅" }] };
  expect((await request.put("/api/workouts", { headers: auth(), data: { date: "2026-10-01", revision: 0, entries: [original], note: "개인 메모" } })).ok()).toBe(true);
  const before = await (await request.get("/api/workouts?date=2026-10-01", { headers: auth() })).json();
  const preferencesBefore = (await library(request, "share-owner")).preferences;
  const initial = await (await request.get("/api/workouts/sharing", { headers: auth() })).json();
  expect(initial.enabled).toBe(false);
  expect(initial.privateCount).toBe(1);
  let status = await (await request.patch("/api/workouts/sharing", { headers: auth(), data: { enabled: true } })).json();
  expect(status.scheduledCount).toBe(1);
  const future = await create(request, "다음 주 공유 머신");
  status = await (await request.get("/api/workouts/sharing", { headers: auth() })).json();
  expect(status.scheduledCount).toBe(2);
  expect((await library(request, "other-user")).exercises.some((e: Exercise) => e.id === future.id)).toBe(false);
  status = await (await request.patch("/api/workouts/sharing", { headers: auth(), data: { enabled: false } })).json();
  expect(status.privateCount).toBe(2); expect(status.scheduledCount).toBe(0);
  await request.patch("/api/workouts/sharing", { headers: auth(), data: { enabled: true } });
  status = await (await request.post("/api/workouts/sharing", { headers: auth() })).json();
  expect(status.publishedNow).toBe(2); expect(status.publishedCount).toBe(2); expect(status.scheduledCount).toBe(0);
  expect((await (await request.post("/api/workouts/sharing", { headers: auth() })).json()).publishedNow).toBe(0);
  const available = await library(request, "other-user");
  expect(available.exercises.find((e: Exercise) => e.id === exercise.id)).toEqual({ id: exercise.id, name: exercise.name, equipment: "machine", tags: ["back"], shared: true });
  expect(available.preferences[exercise.id]).toBeUndefined();
  expect(JSON.stringify(available)).not.toContain("개인 세팅");
  const privateHistory = await (await request.get("/api/workouts/history?exerciseId=" + exercise.id + "&through=2026-10-26", { headers: auth("other-user") })).json();
  expect(privateHistory.history).toEqual([]);
  const otherEntry = { ...newEntry(available.exercises.find((e: Exercise) => e.id === exercise.id)), sets: [{ weight: 30, reps: 12 }] };
  expect((await request.put("/api/workouts", { headers: auth("other-user"), data: { date: "2026-10-01", revision: 0, entries: [otherEntry], note: "" } })).ok()).toBe(true);
  expect(await (await request.get("/api/workouts?date=2026-10-01", { headers: auth() })).json()).toEqual(before);
  expect((await library(request, "share-owner")).preferences).toEqual(preferencesBefore);
  const peer = await library(request, "share-peer");
  expect(peer.exercises.some((e: Exercise) => e.id === peerCopy.id)).toBe(true);
  expect(peer.exercises.some((e: Exercise) => e.id === exercise.id)).toBe(false);
  await request.post("/api/workouts/sharing", { headers: auth("share-peer") });
  const deduplicated = (await library(request, "other-user")).exercises.filter((e: Exercise) => e.name.replace(/\s/g, "") === "공유시험머신");
  expect(deduplicated.map((e: Exercise) => e.id)).toEqual([exercise.id]);
  const duplicate = await request.post("/api/workouts/exercises", { headers: auth("other-user"), data: { name: "공유   시험 머신", equipment: "machine", tags: ["back"] } });
  expect(duplicate.status()).toBe(409);
  await request.patch("/api/workouts/sharing", { headers: auth(), data: { enabled: false } });
  expect((await library(request, "other-user")).exercises.some((e: Exercise) => e.id === exercise.id)).toBe(true);
  expect((await library(request, "share-private")).exercises.some((e: Exercise) => e.id === "existing-private" && e.custom && !e.shared)).toBe(true);
});

test("settings exposes weekly sharing, manual release and retained opt-in on reload", async ({ page, request }) => {
  await create(request, "화면 공유 머신", "share-peer");
  await page.context().addCookies([{ name: "yc_session", value: token("share-peer"), domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/settings");
  const panel = page.locator(".exercise-sharing-section");
  const toggle = panel.getByRole("switch", { name: "내 종목 매주 공유" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(panel).toContainText("다음 공유 대기 1개");
  await panel.getByRole("button", { name: "내 종목 지금 공유", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("1개 종목을 공용 목록에 반영했습니다");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(panel).toContainText("다음 공유 대기 0개");
  await expect(panel.getByRole("button", { name: "내 종목 지금 공유", exact: true })).toBeDisabled();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
