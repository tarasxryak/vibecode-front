import { expect, test } from "@playwright/test"

import { dateField, errorAlert, expectRow, openPage, submitButton, typeDate } from "./helpers"

// No page.route here: the browser calls the real /api routes,
// which call tests/mock-n8n.mjs in place of the published n8n webhooks.

test("основной сценарий: любой день → обе таблицы заполнены @mobile", async ({ page }) => {
  await openPage(page)
  await typeDate(page, "2026-11-19")
  await submitButton(page).click()

  await expect(page.getByRole("heading", { name: "16–22 ноября 2026" })).toBeVisible()
  await expect(page.getByRole("status")).toHaveText("Отчёт за 16–22 ноября 2026 загружен")

  await expect(page.getByRole("table", { name: "По типу задачи" }).getByRole("columnheader")).toHaveText([
    "Тип",
    "Создано",
    "Закрыто",
    "Ещё открыто",
    "В работе",
  ])
  await expectRow(page, "По типу задачи", "Ошибка", [3, 2, 1, 1])
  await expectRow(page, "По типу задачи", "Задача", [4, 3, 2, 1])
  await expectRow(page, "По типу задачи", "Новая функция", [2, 1, 1, 0])
  await expectRow(page, "По типу задачи", "Без типа", [1, 0, 1, 0])
  await expectRow(page, "По типу задачи", "Всего", [10, 6, 5, 2])

  await expectRow(page, "По автору", "tarasxryak", [6, 4, 3, 2])
  await expectRow(page, "По автору", "mira-lebedeva", [3, 2, 1, 0])
  await expectRow(page, "По автору", "k-orlov", [1, 0, 1, 0])

  // Narrow screens: the page itself never scrolls sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test("последние недели из n8n: пропуски отмечены, клик открывает неделю @mobile", async ({ page }) => {
  await openPage(page)
  const trend = page.getByRole("table", { name: "Последние недели" })
  const rows = trend.locator("tbody tr")
  await expect(rows).toHaveCount(8)
  await expect(rows.nth(0)).toHaveText(/16–22 ноября 2026\s*10\s*6/)
  await expect(rows.nth(3)).toContainText("нет отчёта")
  await expect(rows.nth(4)).toHaveText(/19–25 октября 2026\s*4\s*5/)

  await trend.getByRole("button", { name: "9–15 ноября 2026" }).click()
  await expect(page.getByRole("heading", { name: "9–15 ноября 2026", level: 2 })).toBeVisible()
  await expectRow(page, "По типу задачи", "Всего", [0, 0, 0, 0])
})

test("неделя без отчёта через настоящий маршрут", async ({ page }) => {
  await openPage(page)
  await dateField(page).fill("2026-10-07")
  await submitButton(page).click()
  await expect(page.getByRole("heading", { name: "За эту неделю отчёта нет" })).toBeVisible()
})

test("сбой n8n превращается в ошибку с повтором", async ({ page }) => {
  await openPage(page)
  await dateField(page).fill("2026-11-02")
  await submitButton(page).click()
  await expect(errorAlert(page)).toContainText("Сервис отчётов вернул ошибку 500.")
  await expect(errorAlert(page).getByRole("button", { name: "Повторить" })).toBeVisible()
})
