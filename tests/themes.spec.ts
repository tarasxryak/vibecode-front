import { expect, test, type Page } from "@playwright/test"

import { dateField, fullReport, historyBody, mockHistoryApi, mockReportApi, openPage, submitButton } from "./helpers"

const picker = (page: Page) => page.getByRole("group", { name: "Фон страницы" })
const backdrop = (page: Page) => page.getByTestId("ascii-backdrop")
const html = (page: Page) => page.locator("html")

/** Alpha of the content panel's background, 0..1. */
async function panelAlpha(page: Page) {
  return page.locator("main").evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor
    const alpha = bg.match(/[\d.]+(?=\)$)/)
    return bg.startsWith("rgba") || bg.includes("/") ? Number(alpha?.[0] ?? 1) : 1
  })
}

test.beforeEach(async ({ page }) => {
  await mockHistoryApi(page, { body: historyBody() })
})

test("по умолчанию — без фона, есть четыре варианта", async ({ page }) => {
  await openPage(page)
  await expect(picker(page).getByRole("button")).toHaveText(["Без фона", "Пустыня", "Фудзи", "Гавань"])
  await expect(picker(page).getByRole("button", { name: "Без фона" })).toHaveAttribute("aria-pressed", "true")
  await expect(backdrop(page)).toHaveCount(0)
  await expect(html(page)).not.toHaveAttribute("data-bg")
})

for (const [label, bg, piece] of [
  ["Пустыня", "desert", "desert-buttes-road"],
  ["Фудзи", "fuji", "fuji-dawn-lake"],
  ["Гавань", "harbour", "harbour-neon-skyline"],
] as const) {
  test(`«${label}»: анимация в стиле lines за непрозрачной панелью, текст читается @mobile`, async ({ page }) => {
    await openPage(page)
    await picker(page).getByRole("button", { name: label }).click()

    await expect(html(page)).toHaveAttribute("data-bg", bg)
    await expect(backdrop(page)).toHaveAttribute("data-piece", piece)
    await expect(backdrop(page)).toHaveAttribute("aria-hidden", "true")
    await expect(backdrop(page).locator("canvas")).toBeVisible()
    expect(await panelAlpha(page)).toBeGreaterThanOrEqual(0.95)
    await expect(page.getByText(/ascii-magic-art/)).toBeVisible()

    // The art covers the viewport but never makes the page scroll sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test("выбор сохраняется после перезагрузки и применяется до отрисовки", async ({ page }) => {
  await openPage(page)
  await picker(page).getByRole("button", { name: "Гавань" }).click()
  await expect(html(page)).toHaveAttribute("data-bg", "harbour")

  await page.reload()
  // The inline <head> script sets data-bg before React hydrates.
  const atParse = await page.evaluate(() => document.documentElement.dataset.bg)
  expect(atParse).toBe("harbour")
  await expect(picker(page).getByRole("button", { name: "Гавань" })).toHaveAttribute("aria-pressed", "true")
  await expect(backdrop(page).locator("canvas")).toBeVisible()
})

test("«Без фона» убирает анимацию и подпись", async ({ page }) => {
  await openPage(page)
  await picker(page).getByRole("button", { name: "Фудзи" }).click()
  await expect(backdrop(page).locator("canvas")).toBeVisible()

  await picker(page).getByRole("button", { name: "Без фона" }).click()
  await expect(backdrop(page)).toHaveCount(0)
  await expect(html(page)).not.toHaveAttribute("data-bg")
  await expect(page.getByText(/ascii-magic-art/)).toBeHidden()
  expect(await panelAlpha(page)).toBe(0)
})

test("с фоном отчёт работает как обычно", async ({ page }) => {
  await mockReportApi(page, { body: fullReport })
  await openPage(page)
  await picker(page).getByRole("button", { name: "Пустыня" }).click()
  await dateField(page).fill("2026-11-18")
  await submitButton(page).click()
  await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "16–22 ноября 2026" })).toBeVisible()
})

const frame = (page: Page) =>
  backdrop(page).locator("canvas").evaluate((c: HTMLCanvasElement) => c.toDataURL())

test("анимация идёт", async ({ page }) => {
  await openPage(page)
  await picker(page).getByRole("button", { name: "Гавань" }).click()
  await expect(backdrop(page).locator("canvas")).toBeVisible()
  const first = await frame(page)
  await expect.poll(() => frame(page), { timeout: 5000 }).not.toBe(first)
})

test.describe("prefers-reduced-motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("кадр стоит", async ({ page }) => {
    await openPage(page)
    await picker(page).getByRole("button", { name: "Гавань" }).click()
    await expect(backdrop(page).locator("canvas")).toBeVisible()
    const first = await frame(page)
    await page.waitForTimeout(1500)
    expect(await frame(page)).toBe(first)
  })
})
