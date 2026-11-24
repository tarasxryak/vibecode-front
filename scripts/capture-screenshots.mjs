// Captures every UI state of the prototype and of the running app for the README.
// Usage: npm run build && npx next start -p 3210 &  node scripts/capture-screenshots.mjs
// The app part mocks /api/report and /api/history, so no n8n is needed.
import { readFileSync } from "node:fs"
import { chromium } from "@playwright/test"

const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3210"
const report = JSON.parse(
  readFileSync(new URL("../tests/fixtures/report-2026-11-16.json", import.meta.url), "utf8")
)
// Same frozen clock as the tests: current week 23–29 Nov 2026, last finished 16–22 Nov.
const NOW = new Date("2026-11-25T12:00:00+03:00")
const zero = { opened: 0, closed: 0, open: 0, progress: 0 }
const saved = {
  "2026-11-16": report.report.totals,
  "2026-11-09": zero,
  "2026-10-26": { opened: 3, closed: 4, open: 1, progress: 0 },
  "2026-10-12": { opened: 6, closed: 2, open: 3, progress: 1 },
  "2026-10-05": { opened: 2, closed: 5, open: 0, progress: 0 },
}
const history = (count) => ({
  weeks: Array.from({ length: count }, (_, index) => {
    const weekStart = new Date(Date.UTC(2026, 10, 16) - index * 7 * 86_400_000).toISOString().slice(0, 10)
    return { weekStart, totals: saved[weekStart] ?? null }
  }),
})

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
    // A still frame of the animated backgrounds, so the screenshots are reproducible.
    reducedMotion: "reduce",
  })
  const page = await context.newPage()

  for (const state of ["form", "invalid", "loading", "success", "empty", "current", "error"]) {
    await page.goto(new URL(`../prototype/index.html#${state}`, import.meta.url).href)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `prototype/screenshots/${device}-${state}.png`, fullPage: true })
  }
  for (const bg of ["desert", "fuji", "harbour"]) {
    await page.goto(new URL(`../prototype/index.html?bg=${bg}#success`, import.meta.url).href)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `prototype/screenshots/${device}-bg-${bg}.png` })
  }

  await page.clock.setFixedTime(NOW)
  await page.route("**/api/history?*", (route) =>
    route.fulfill({ json: history(Number(new URL(route.request().url()).searchParams.get("weeks"))) })
  )
  const app = async (state, reply, date) => {
    await page.unroute("**/api/report?*")
    await page.route("**/api/report?*", (route) =>
      reply === "hang" ? undefined : route.fulfill(reply)
    )
    await page.goto(appUrl)
    await page.getByRole("table", { name: "Последние недели" }).locator("tbody tr").first().waitFor()
    if (date) await page.getByLabel("Любой день нужной недели").fill(date)
    if (state !== "form") await page.getByRole("button", { name: "Показать отчёт" }).click()
    await page.waitForTimeout(400)
    await page.mouse.move(0, 0)
    await page.screenshot({ path: `docs/screenshots/${device}-${state}.png`, fullPage: true })
  }

  await app("form", { json: report })
  await app("invalid", { json: report }, "2026-12-02")
  await app("loading", "hang", "2026-11-18")
  await app("success", { json: report }, "2026-11-18")
  await app("empty", { json: { report: null } }, "2026-11-04")
  await app("current-week", { json: { report: null } }, "2026-11-24")
  await app("error", { status: 502, json: { error: "Сервис отчётов не ответил." } }, "2026-11-18")

  // Art backgrounds: first viewport only, so the scene and the panel are both in frame.
  const labels = { desert: "Пустыня", fuji: "Фудзи", harbour: "Гавань" }
  for (const [bg, label] of Object.entries(labels)) {
    await page.unroute("**/api/report?*")
    await page.route("**/api/report?*", (route) => route.fulfill({ json: report }))
    await page.goto(`${appUrl}/?week=2026-11-18`)
    await page.getByRole("button", { name: label }).click()
    await page.getByRole("table", { name: "По автору" }).waitFor()
    await page.locator('[data-testid="ascii-backdrop"] canvas').waitFor()
    await page.waitForTimeout(400)
    await page.mouse.move(0, 0)
    await page.screenshot({ path: `docs/screenshots/${device}-bg-${bg}.png` })
  }
  await page.getByRole("button", { name: "Без фона" }).click()
  await context.close()
}

await browser.close()
console.log("screenshots saved to prototype/screenshots and docs/screenshots")
