import { expect, test } from "@playwright/test"

import { dateField, errorAlert, expectRow, submitButton, typeDate } from "./helpers"

// No page.route here: the browser calls the real /api/report route,
// which calls tests/mock-n8n.mjs in place of the published n8n webhook.

test("основной сценарий: дата → обе таблицы заполнены @mobile", async ({ page }) => {
  await page.goto("/")
  await typeDate(page, "2026-11-16")
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

test("неделя без отчёта через настоящий маршрут", async ({ page }) => {
  await page.goto("/")
  await dateField(page).fill("2026-11-23")
  await submitButton(page).click()
  await expect(page.getByRole("heading", { name: "За эту неделю отчёта нет" })).toBeVisible()
})

test("сбой n8n превращается в ошибку с повтором", async ({ page }) => {
  await page.goto("/")
  await dateField(page).fill("2026-11-02")
  await submitButton(page).click()
  await expect(errorAlert(page)).toContainText("Сервис отчётов вернул ошибку 500")
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible()
})
