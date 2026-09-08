import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:3100", timezoneId: "Asia/Seoul", viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  webServer: {
    command: "node tests/start-server.mjs",
    url: "http://127.0.0.1:3100/auth",
    reuseExistingServer: false,
    timeout: 60000
  }
});
