import { expect, test } from "@playwright/test"

import {
  dateField,
  errorAlert,
  expectRow,
  fullReport,
  historyBody,
  mockHistoryApi,
  mockReportApi,
  openPage,
  submitButton,
  typeDate,
  typeIntoDateField,
  zeroReport,
} from "./helpers"

// The clock is frozen at Wed 25 Nov 2026 (see NOW): current week 23–29 Nov, last finished 16–22 Nov.
test.beforeEach(async ({ page }) => {
  await mockHistoryApi(page, { body: historyBody() })
})

test.describe("форма и клавиатура", () => {
  test("показывает поле с подписью, подсказку и быстрый выбор", async ({ page }) => {
    await openPage(page)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Отчёт по задачам за неделю")
    await expect(dateField(page)).toHaveAttribute("type", "date")
    await expect(dateField(page)).toHaveAttribute("max", "2026-11-25")
    await expect(dateField(page)).toHaveAccessibleDescription(/с понедельника по воскресенье/)
    await expect(submitButton(page)).toHaveText("Показать отчёт")
    const quick = page.getByRole("group", { name: "Быстрый выбор" })
    await expect(quick.getByRole("button")).toHaveText(["Прошлая неделя", "Позапрошлая неделя"])
  })

  test("Tab: меню темы, поле, кнопка; фокус виден", async ({ page }) => {
    await openPage(page)
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: /^Тема:/ })).toBeFocused()
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

  test("любой день недели: подсказка называет неделю, запрос уходит за её понедельник", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await openPage(page)
    await typeDate(page, "2026-11-18")
    await expect(dateField(page)).toHaveAccessibleDescription("Покажем неделю 16–22 ноября 2026.")
    await page.keyboard.press("Enter")

    await expect(page.getByRole("heading", { name: "16–22 ноября 2026" })).toBeVisible()
    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    expect(api.requests).toEqual(["2026-11-16"])
    await expect(page).toHaveURL(/\?week=2026-11-16$/)
  })
})

test.describe("валидация", () => {
  test("пустая дата: ошибка у поля, запрос не уходит", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await openPage(page)
    await submitButton(page).click()

    await expect(page.getByText("Выберите дату.")).toBeVisible()
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true")
    await expect(dateField(page)).toHaveAccessibleDescription(/Выберите дату\./)
    await expect(dateField(page)).toBeFocused()
    expect(api.requests).toEqual([])
  })

  test("неполная дата: просим дописать", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await openPage(page)
    await typeIntoDateField(page, "1611")
    await page.keyboard.press("Enter")

    await expect(page.getByText("Дата введена не полностью. Формат: ДД.ММ.ГГГГ.")).toBeVisible()
    expect(api.requests).toEqual([])
  })

  test("будущая дата: ошибка, запрос не уходит", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await openPage(page)
    await dateField(page).fill("2026-12-02")
    await submitButton(page).click()

    await expect(
      page.getByText("Эта дата ещё не наступила. Выберите сегодняшний день или раньше.")
    ).toBeVisible()
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true")
    expect(api.requests).toEqual([])
  })

  test("ошибка исчезает, когда дату исправили", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await openPage(page)
    await dateField(page).fill("2026-12-02")
    await submitButton(page).click()
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true")

    await dateField(page).fill("2026-11-20")
    await expect(dateField(page)).not.toHaveAttribute("aria-invalid")
    await submitButton(page).click()
    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    expect(api.requests).toEqual(["2026-11-16"])
  })
})

test.describe("состояния ответа", () => {
  test("загрузка видна, повторная отправка любым способом не создаёт второй запрос", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await openPage(page)
    api.hold()
    await dateField(page).fill("2026-11-16")
    await submitButton(page).click()

    await expect(submitButton(page)).toHaveText("Загружаем…")
    await expect(submitButton(page)).toBeDisabled()
    await expect(page.getByTestId("report-skeleton")).toBeVisible()
    await expect(page.getByRole("status")).toHaveText("Загружаем отчёт")

    // Every way a user could re-submit while the request is pending.
    await submitButton(page).click({ force: true })
    await submitButton(page).dblclick({ force: true })
    await dateField(page).press("Enter")
    await dateField(page).press("Enter")
    await page.evaluate(() => document.querySelector("form")?.requestSubmit())
    await page.getByRole("button", { name: "Прошлая неделя", exact: true }).click({ force: true })

    expect(api.requests).toEqual(["2026-11-16"])
    api.release()

    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    await expect(submitButton(page)).toHaveText("Показать отчёт")
    await expect(submitButton(page)).toBeEnabled()
    expect(api.requests).toEqual(["2026-11-16"])
  })

  test("кнопка не меняет ширину во время загрузки", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport })
    await openPage(page)
    const before = (await submitButton(page).boundingBox())!.width
    api.hold()
    await dateField(page).fill("2026-11-16")
    await submitButton(page).click()
    await expect(submitButton(page)).toHaveText("Загружаем…")
    const during = (await submitButton(page).boundingBox())!.width
    api.release()
    expect(Math.abs(during - before)).toBeLessThan(1)
  })

  test("прошедшая неделя без отчёта: пустое состояние без таблиц", async ({ page }) => {
    await mockReportApi(page, { body: { report: null } })
    await openPage(page)
    await dateField(page).fill("2026-11-04")
    await submitButton(page).click()

    await expect(page.getByRole("heading", { name: "2–8 ноября 2026" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "За эту неделю отчёта нет" })).toBeVisible()
    await expect(page.getByRole("table", { name: "По типу задачи" })).toHaveCount(0)
  })

  test("текущая неделя: объясняем, когда появится отчёт", async ({ page }) => {
    await mockReportApi(page, { body: { report: null } })
    await openPage(page)
    await dateField(page).fill("2026-11-24")
    await submitButton(page).click()

    await expect(page.getByRole("heading", { name: "Неделя ещё идёт" })).toBeVisible()
    await expect(page.getByText(/появится в понедельник, 30 ноября, после 09:00 по Москве/)).toBeVisible()

    await page.getByRole("button", { name: "Открыть прошлую неделю" }).click()
    await expect(page.getByRole("heading", { name: "16–22 ноября 2026" })).toBeVisible()
  })

  test("отчёт с нулями всё равно показывает обе таблицы", async ({ page }) => {
    await mockReportApi(page, { body: zeroReport })
    await openPage(page)
    await dateField(page).fill("2026-11-09")
    await submitButton(page).click()

    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    await expect(page.getByRole("table", { name: "По автору" })).toBeVisible()
    await expectRow(page, "По типу задачи", "Всего", [0, 0, 0, 0])
    await expect(
      page.getByRole("table", { name: "По автору" }).getByText("За неделю задач не было")
    ).toBeVisible()
  })

  test("ошибка сервера: два отдельных предложения, дата сохраняется, повтор загружает отчёт", async ({ page }) => {
    const api = await mockReportApi(
      page,
      // No trailing period on purpose: the UI must not glue the next sentence onto it.
      { status: 502, body: { error: "Сервис отчётов не ответил" } },
      { body: fullReport }
    )
    await openPage(page)
    await dateField(page).fill("2026-11-18")
    await submitButton(page).click()

    const alert = errorAlert(page)
    await expect(alert.locator("p")).toHaveText([
      "Сервис отчётов не ответил.",
      "Дата сохранена — можно повторить запрос.",
    ])
    await expect(dateField(page)).toHaveValue("2026-11-18")
    await expect(page.getByRole("table", { name: "По типу задачи" })).toHaveCount(0)

    await alert.getByRole("button", { name: "Повторить" }).click()

    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    await expect(alert).toHaveCount(0)
    expect(api.requests).toEqual(["2026-11-16", "2026-11-16"])
  })

  test("нет сети: понятная ошибка и повтор с клавиатуры", async ({ page }) => {
    const api = await mockReportApi(page, "abort", { body: fullReport })
    await openPage(page)
    await dateField(page).fill("2026-11-16")
    await dateField(page).press("Enter")

    await expect(errorAlert(page)).toContainText("Нет связи с сервером.")
    await errorAlert(page).getByRole("button", { name: "Повторить" }).focus()
    await page.keyboard.press("Enter")

    await expect(page.getByRole("table", { name: "По автору" })).toBeVisible()
    expect(api.requests).toHaveLength(2)
  })

  test("ответ в неверном формате показывается как ошибка", async ({ page }) => {
    await mockReportApi(page, { body: { report: { weekStart: "2026-11-16" } } })
    await openPage(page)
    await dateField(page).fill("2026-11-16")
    await submitButton(page).click()

    await expect(errorAlert(page)).toContainText("Сервис отчётов вернул данные в неожиданном формате.")
    await expect(page.getByRole("table", { name: "По типу задачи" })).toHaveCount(0)
  })
})

test.describe("переходы между неделями", () => {
  test("быстрый выбор открывает прошлую и позапрошлую недели", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport }, { body: zeroReport })
    await openPage(page)

    await page.getByRole("button", { name: "Прошлая неделя", exact: true }).click()
    await expect(page.getByRole("heading", { name: "16–22 ноября 2026" })).toBeVisible()
    await expect(dateField(page)).toHaveValue("2026-11-16")

    await page.getByRole("button", { name: "Позапрошлая неделя" }).click()
    await expect(page.getByRole("heading", { name: "9–15 ноября 2026" })).toBeVisible()
    expect(api.requests).toEqual(["2026-11-16", "2026-11-09"])
  })

  test("стрелки листают недели, прежний отчёт виден во время загрузки, будущее закрыто", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport }, { body: { report: null } })
    await openPage(page)
    await dateField(page).fill("2026-11-16")
    await submitButton(page).click()
    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()

    const next = page.getByRole("button", { name: "Следующая" })
    api.hold()
    await next.click()
    await expect(page.getByRole("heading", { name: "23–29 ноября 2026" })).toBeVisible()
    // Refetch keeps the previous report on screen instead of flashing a skeleton.
    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    await expect(page.getByTestId("report-skeleton")).toHaveCount(0)
    api.release()

    await expect(page.getByRole("heading", { name: "Неделя ещё идёт" })).toBeVisible()
    await expect(next).toBeDisabled()

    await page.getByRole("button", { name: "Предыдущая" }).click()
    await expect(page.getByRole("heading", { name: "16–22 ноября 2026" })).toBeVisible()
    expect(api.requests).toEqual(["2026-11-16", "2026-11-23", "2026-11-16"])
  })

  test("ссылка ?week= с любым днём открывает его неделю", async ({ page }) => {
    const api = await mockReportApi(page, { body: fullReport }, { body: { report: null } })
    await openPage(page, "/?week=2026-11-19")

    await expect(dateField(page)).toHaveValue("2026-11-19")
    await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
    await expect(page).toHaveURL(/\?week=2026-11-16$/)

    await dateField(page).fill("2026-11-04")
    await submitButton(page).click()
    await expect(page.getByRole("heading", { name: "За эту неделю отчёта нет" })).toBeVisible()
    await expect(page).toHaveURL(/\?week=2026-11-02$/)
    expect(api.requests).toEqual(["2026-11-16", "2026-11-02"])
  })
})
