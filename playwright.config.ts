import { defineConfig, devices } from "@playwright/test"

const APP_PORT = 3210
const MOCK_N8N_PORT = 3211

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    // ru-RU makes the native date field use ДД.ММ.ГГГГ segments, as real users see it.
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: "node tests/mock-n8n.mjs",
      url: `http://127.0.0.1:${MOCK_N8N_PORT}/webhook/lab8-weekly-report?weekStart=2026-11-16`,
      env: { MOCK_N8N_PORT: String(MOCK_N8N_PORT), MOCK_N8N_TOKEN: "test-token" },
      reuseExistingServer: !process.env.CI,
    },
    {
      // Production server, so the tests exercise what Vercel will run. Run `npm run build` first.
      command: `npx next start -p ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}`,
      env: {
        N8N_WEBHOOK_URL: `http://127.0.0.1:${MOCK_N8N_PORT}/webhook/lab8-weekly-report`,
        N8N_WEBHOOK_TOKEN: "test-token",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
