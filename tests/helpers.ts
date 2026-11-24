import { expect, type Page, type Route } from "@playwright/test"

import fullReport from "./fixtures/report-2026-11-16.json"
import zeroReport from "./fixtures/report-zero-2026-11-09.json"

export { fullReport, zeroReport }

type Reply = { status?: number; body: unknown } | "abort"

/**
 * Mocks `GET /api/report` and records each request's weekStart.
 * `replies` are used in order; the last one repeats.
 */
export async function mockReportApi(page: Page, ...replies: Reply[]) {
  const requests: string[] = []
  let release: (() => void) | null = null
  let gate: Promise<void> | null = null

  await page.route("**/api/report?*", async (route: Route) => {
    requests.push(new URL(route.request().url()).searchParams.get("weekStart") ?? "")
    if (gate) await gate
    const reply = replies[Math.min(requests.length - 1, replies.length - 1)]
    if (reply === "abort") {
      await route.abort("connectionfailed")
      return
    }
    await route.fulfill({ status: reply.status ?? 200, json: reply.body })
  })

  return {
    requests,
    /** Holds every response until `release()` is called. */
    hold() {
      gate = new Promise((resolve) => {
        release = () => {
          gate = null
          resolve()
        }
      })
    },
    release() {
      release?.()
    },
  }
}

export function dateField(page: Page) {
  return page.getByLabel("Понедельник недели")
}

/** The report error. Next.js also renders an empty role="alert" route announcer, so filter by text. */
export function errorAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: "Не удалось загрузить отчёт" })
}

export function submitButton(page: Page) {
  return page.getByRole("button", { name: /Показать отчёт|Загружаем отчёт/ })
}

/** Types a date segment by segment, the way a keyboard user fills a ru-RU date field. */
export async function typeDate(page: Page, ddmmyyyy: string) {
  const field = dateField(page)
  await field.focus()
  await page.keyboard.type(ddmmyyyy)
}

export async function expectRow(page: Page, table: string, row: string, cells: number[]) {
  const tableLocator = page.getByRole("table", { name: table })
  const rowLocator = tableLocator.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: row, exact: false }),
  })
  await expect(rowLocator.getByRole("cell")).toHaveText(cells.map(String))
}
