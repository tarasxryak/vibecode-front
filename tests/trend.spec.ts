import { expect, test } from "@playwright/test"

import { fullReport, historyBody, mockHistoryApi, mockReportApi, openPage } from "./helpers"

// Clock frozen at Wed 25 Nov 2026, so the newest finished week is 16–22 Nov.

function trendTable(page: import("@playwright/test").Page) {
  return page.getByRole("table", { name: "Последние недели" })
}

test("при открытии загружает 8 последних завершённых недель", async ({ page }) => {
  const history = await mockHistoryApi(page, { body: historyBody(8) })
  await openPage(page)

  const rows = trendTable(page).locator("tbody tr")
  await expect(rows).toHaveCount(8)
  expect(history.requests).toEqual(["2026-11-16|8"])

  await expect(rows.nth(0)).toHaveText(/16–22 ноября 2026\s*10\s*6/)
  await expect(rows.nth(1)).toHaveText(/9–15 ноября 2026\s*0\s*0/)
  await expect(rows.nth(2)).toContainText("нет отчёта")
  await expect(page.getByRole("list", { name: "Обозначения" })).toHaveText(/Создано\s*Закрыто/)
})

test("переключатель меняет число недель, прежний список виден во время загрузки", async ({ page }) => {
  const history = await mockHistoryApi(page, { body: historyBody(8) }, { body: historyBody(4) })
  await openPage(page)
  await expect(trendTable(page).locator("tbody tr")).toHaveCount(8)

  history.hold()
  await page.getByRole("button", { name: "4 нед." }).click()
  await expect(page.getByRole("button", { name: "4 нед." })).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator('section[aria-labelledby="trend-heading"] [aria-busy]')).toHaveAttribute("aria-busy", "true")
  await expect(trendTable(page).locator("tbody tr")).toHaveCount(8)
  history.release()

  await expect(trendTable(page).locator("tbody tr")).toHaveCount(4)
  expect(history.requests).toEqual(["2026-11-16|8", "2026-11-16|4"])
})

test("клик по неделе открывает её отчёт и отмечает строку", async ({ page }) => {
  await mockHistoryApi(page, { body: historyBody(8) })
  const report = await mockReportApi(page, { body: fullReport })
  await openPage(page)

  await trendTable(page).getByRole("button", { name: "16–22 ноября 2026" }).click()

  await expect(page.getByRole("heading", { name: "16–22 ноября 2026", level: 2 })).toBeVisible()
  await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
  await expect(trendTable(page).locator('tr[aria-current="true"]')).toContainText("16–22 ноября 2026")
  expect(report.requests).toEqual(["2026-11-16"])
})

test("недели без отчёта не кликаются", async ({ page }) => {
  await mockHistoryApi(page, { body: historyBody(8) })
  await openPage(page)
  const missing = trendTable(page).locator("tbody tr").nth(2)
  await expect(missing).toContainText("нет отчёта")
  await expect(missing.getByRole("button")).toHaveCount(0)
})

test("ошибка загрузки недель с повтором", async ({ page }) => {
  const history = await mockHistoryApi(
    page,
    { status: 502, body: { error: "Сервис отчётов не ответил." } },
    { body: historyBody(8) }
  )
  await openPage(page)

  const alert = page.getByRole("alert").filter({ hasText: "Не удалось загрузить последние недели" })
  await expect(alert).toContainText("Сервис отчётов не ответил.")
  await alert.getByRole("button", { name: "Повторить" }).click()

  await expect(trendTable(page).locator("tbody tr")).toHaveCount(8)
  expect(history.requests).toHaveLength(2)
})
