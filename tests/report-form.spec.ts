import { expect, test } from "@playwright/test"

import {
  dateField,
  errorAlert,
  expectRow,
  fullReport,
  mockReportApi,
  submitButton,
  typeDate,
  typeIntoDateField,
  zeroReport,
} from "./helpers"

test.beforeEach(async ({ page }) => {
  await page.goto("/")
})

test.describe("форма и клавиатура", () => {
  test("показывает подписанное поле даты и кнопку", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Отчёт по задачам за неделю")
    await expect(dateField(page)).toHaveAttribute("type", "date")
    await expect(dateField(page)).toHaveAccessibleDescription(/с понедельника по воскресенье/)
    await expect(submitButton(page)).toHaveText("Показать отчёт")
  })

  test("Tab ведёт к полю и кнопке, фокус виден", async ({ page }) => {
    await page.keyboard.press("Tab")
    await expect(dateField(page)).toBeFocused()
    // The date field has several internal stops (segments, picker); the next element after it
    // must be the submit button.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab")
      if (!(await dateField(page).evaluate((el) => el === document.activeElement))) break
    }
    await expect(submitButton(page)).toBeFocused()
    const ring = await submitButton(page).evaluate((el) => getComputedStyle(el).boxShadow)
    expect(ring).not.toBe("none")
  })

  test("дату можно ввести с клавиатуры и отправить Enter", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await typeDate(page, "2026-11-16")
    await expect(dateField(page)).toHaveValue("2026-11-16")
    await page.keyboard.press("Enter")

    await expect(page.getByRole("heading", { name: "16–22 ноября 2026" })).toBeVisible()
    expect(api.requests).toEqual(["2026-11-16"])
  })
})

test.describe("валидация", () => {
  test("пустая дата: ошибка у поля, запрос не уходит", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await submitButton(page).click()

    await expect(page.getByText("Выберите понедельник недели")).toBeVisible()
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true")
    await expect(dateField(page)).toHaveAccessibleDescription(/Выберите понедельник недели/)
    await expect(dateField(page)).toBeFocused()
    expect(api.requests).toEqual([])
  })

  test("не понедельник: ошибка с подсказкой ближайшего понедельника", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await typeDate(page, "2026-11-17")
    await page.keyboard.press("Enter")

    await expect(
      page.getByText("17 ноября 2026 — вторник. Выберите понедельник, например 16 ноября.")
    ).toBeVisible()
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true")
    expect(api.requests).toEqual([])
  })

  test("неполная дата: просим дописать", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await typeIntoDateField(page, "1611")
    await page.keyboard.press("Enter")

    await expect(page.getByText("Дата введена не полностью. Формат: ДД.ММ.ГГГГ")).toBeVisible()
    expect(api.requests).toEqual([])
  })

  test("ошибка исчезает, когда дату исправили", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await typeDate(page, "2026-11-17")
    await page.keyboard.press("Enter")
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true")

    await dateField(page).fill("2026-11-16")
    await expect(dateField(page)).not.toHaveAttribute("aria-invalid")
    await submitButton(page).click()
    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    expect(api.requests).toEqual(["2026-11-16"])
  })
})

test.describe("состояния ответа", () => {
  test("загрузка видна, повторная отправка не создаёт второй запрос", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    api.hold()
    await dateField(page).fill("2026-11-16")
    await submitButton(page).click()

    await expect(submitButton(page)).toHaveText("Загружаем отчёт…")
    await expect(submitButton(page)).toBeDisabled()
    await expect(page.getByTestId("report-skeleton")).toBeVisible()
    await expect(page.getByRole("status")).toHaveText("Загружаем отчёт")

    // Every way a user could re-submit while the request is pending.
    await submitButton(page).click({ force: true })
    await submitButton(page).dblclick({ force: true })
    await dateField(page).press("Enter")
    await dateField(page).press("Enter")
    await page.evaluate(() => document.querySelector("form")?.requestSubmit())

    expect(api.requests).toEqual(["2026-11-16"])
    api.release()

    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    await expect(submitButton(page)).toHaveText("Показать отчёт")
    await expect(submitButton(page)).toBeEnabled()
    expect(api.requests).toEqual(["2026-11-16"])
  })

  test("отчёта нет: пустое состояние без таблиц", async ({ page }) => {
    await mockReportApi(page, { body: { report: null } })
    await dateField(page).fill("2026-11-23")
    await submitButton(page).click()

    await expect(page.getByRole("heading", { name: "За эту неделю отчёта нет" })).toBeVisible()
    await expect(page.getByText("Неделя 23–29 ноября 2026 не сохранена.")).toBeVisible()
    await expect(page.getByRole("table")).toHaveCount(0)
  })

  test("отчёт с нулями всё равно показывает обе таблицы", async ({ page }) => {
    await mockReportApi(page, { body: zeroReport })
    await dateField(page).fill("2026-11-09")
    await submitButton(page).click()

    await expect(page.getByRole("table")).toHaveCount(2)
    await expectRow(page, "По типу задачи", "Всего", [0, 0, 0, 0])
    await expect(
      page.getByRole("table", { name: "По автору" }).getByText("За неделю задач не было")
    ).toBeVisible()
    await expect(page.getByText("За эту неделю отчёта нет")).toHaveCount(0)
  })

  test("ошибка сервера: дата сохраняется, повтор загружает отчёт", async ({ page }) => {
    const api = await mockReportApi(
      page,
      { status: 502, body: { error: "Сервис отчётов не ответил" } },
      { body: fullReport }
    )
    await dateField(page).fill("2026-11-16")
    await submitButton(page).click()

    const alert = errorAlert(page)
    await expect(alert).toContainText("Сервис отчётов не ответил")
    await expect(dateField(page)).toHaveValue("2026-11-16")
    await expect(page.getByRole("table")).toHaveCount(0)

    await alert.getByRole("button", { name: "Повторить" }).click()

    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    await expect(alert).toHaveCount(0)
    expect(api.requests).toEqual(["2026-11-16", "2026-11-16"])
  })

  test("нет сети: понятная ошибка и повтор с клавиатуры", async ({ page }) => {
    const api = await mockReportApi(page, "abort", { body: fullReport })
    await dateField(page).fill("2026-11-16")
    await dateField(page).press("Enter")

    const retry = page.getByRole("button", { name: "Повторить" })
    await expect(errorAlert(page)).toContainText("Нет связи с сервером.")
    await retry.focus()
    await page.keyboard.press("Enter")

    await expect(page.getByRole("table", { name: "По автору" })).toBeVisible()
    expect(api.requests).toHaveLength(2)
  })

  test("ссылка с ?week= сразу открывает отчёт, а отправка формы обновляет её", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport }, { body: { report: null } })
    await page.goto("/?week=2026-11-16")

    await expect(dateField(page)).toHaveValue("2026-11-16")
    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()

    await dateField(page).fill("2026-11-23")
    await submitButton(page).click()
    await expect(page.getByRole("heading", { name: "За эту неделю отчёта нет" })).toBeVisible()
    await expect(page).toHaveURL(/\?week=2026-11-23$/)
    expect(api.requests).toEqual(["2026-11-16", "2026-11-23"])
  })

  test("ответ в неверном формате показывается как ошибка", async ({ page }) => {
    await mockReportApi(page, { body: { report: { weekStart: "2026-11-16" } } })
    await dateField(page).fill("2026-11-16")
    await submitButton(page).click()

    await expect(errorAlert(page)).toContainText("Сервис отчётов вернул данные")
    await expect(page.getByRole("table")).toHaveCount(0)
  })
})
