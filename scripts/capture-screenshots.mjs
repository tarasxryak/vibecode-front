// Captures every UI state of the prototype and of the running app for the README.
// Usage: npm run build && npx next start -p 3210 &  node scripts/capture-screenshots.mjs
import { readFileSync } from "node:fs"
import { chromium } from "@playwright/test"

const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3210"
const report = JSON.parse(
  readFileSync(new URL("../tests/fixtures/report-2026-11-16.json", import.meta.url), "utf8")
)
const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
}

const browser = await chromium.launch()

for (const [device, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({
    viewport,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  for (const state of ["form", "invalid", "loading", "success", "empty", "error"]) {
    await page.goto(new URL(`../prototype/index.html#${state}`, import.meta.url).href)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `prototype/screenshots/${device}-${state}.png`, fullPage: true })
  }

  const app = async (state, reply, date) => {
    await page.unroute("**/api/report?*")
    await page.route("**/api/report?*", (route) =>
      reply === "hang" ? undefined : route.fulfill(reply)
    )
    await page.goto(appUrl)
    if (date) await page.getByLabel("Понедельник недели").fill(date)
    if (state !== "form") await page.getByRole("button", { name: "Показать отчёт" }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `docs/screenshots/${device}-${state}.png`, fullPage: true })
  }

  await app("form", { json: report })
  await app("invalid", { json: report }, "2026-11-17")
  await app("loading", "hang", "2026-11-16")
  await app("success", { json: report }, "2026-11-16")
  await app("empty", { json: { report: null } }, "2026-11-23")
  await app("error", { status: 502, json: { error: "Сервис отчётов не ответил." } }, "2026-11-16")
  await context.close()
}

await browser.close()
console.log("screenshots saved to prototype/screenshots and docs/screenshots")
