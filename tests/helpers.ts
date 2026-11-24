import { expect, type Page, type Route } from "@playwright/test"

import fullReport from "./fixtures/report-2026-11-16.json"
import zeroReport from "./fixtures/report-zero-2026-11-09.json"

export { fullReport, zeroReport }

type Reply = { status?: number; body: unknown } | "abort"

/** Wednesday 25 Nov 2026, 12:00 MSK: the current week starts 23 Nov, the last finished one 16 Nov. */
export const NOW = new Date("2026-11-25T12:00:00+03:00")

/** Freezes the browser clock at NOW and opens `path`. */
export async function openPage(page: Page, path = "/") {
  await page.clock.setFixedTime(NOW)
  await page.goto(path)
}

/**
 * Mocks a GET API route and records each request's query. `replies` are used in order;
 * the last one repeats. `hold()` keeps responses pending until `release()`.
 */
async function mockApi(page: Page, pattern: string, replies: Reply[]) {
  const requests: URLSearchParams[] = []
  let release: (() => void) | null = null
  let gate: Promise<void> | null = null

  await page.route(pattern, async (route: Route) => {
    requests.push(new URL(route.request().url()).searchParams)
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

/** Mocks `GET /api/report`; `requests` lists the requested weekStart values. */
export async function mockReportApi(page: Page, ...replies: Reply[]) {
  const api = await mockApi(page, "**/api/report?*", replies)
  return {
    ...api,
    get requests() {
      return api.requests.map((q) => q.get("weekStart") ?? "")
    },
  }
}

/** Mocks `GET /api/history`; `requests` lists `until|weeks` for each call. */
export async function mockHistoryApi(page: Page, ...replies: Reply[]) {
  const api = await mockApi(page, "**/api/history?*", replies)
  return {
    ...api,
    get requests() {
      return api.requests.map((q) => `${q.get("until")}|${q.get("weeks")}`)
    },
  }
}

const zero = { opened: 0, closed: 0, open: 0, progress: 0 }

/** `/api/history` body: `count` weeks ending 16 Nov 2026; 16 Nov and 26 Oct have reports, 9 Nov is all zeros. */
export function historyBody(count = 8) {
  const saved: Record<string, typeof zero> = {
    "2026-11-16": fullReport.report.totals,
    "2026-11-09": zero,
    "2026-10-26": { opened: 3, closed: 4, open: 1, progress: 0 },
  }
  const start = Date.UTC(2026, 10, 16)
  return {
    weeks: Array.from({ length: count }, (_, index) => {
      const weekStart = new Date(start - index * 7 * 86_400_000).toISOString().slice(0, 10)
      return { weekStart, totals: saved[weekStart] ?? null }
    }),
  }
}

export function dateField(page: Page) {
  return page.getByLabel("Любой день нужной недели")
}

/** The report error. Next.js also renders an empty role="alert" route announcer, so filter by text. */
export function errorAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: "Не удалось загрузить отчёт" })
}

export function submitButton(page: Page) {
  return page.getByRole("button", { name: /Показать отчёт|Загружаем…/ })
}

// The native date field's segment order follows the browser build, not only `locale`:
// Chromium on macOS shows ДД.ММ.ГГГГ for ru-RU, while the Linux CI build keeps ММ/ДД/ГГГГ.
const SEGMENT_ORDERS = [
  ["day", "month", "year"],
  ["month", "day", "year"],
  ["year", "month", "day"],
] as const

/**
 * Types an ISO date into the date field with real keystrokes, the way a keyboard user does.
 * Tries each segment order until the field holds exactly `iso`.
 */
export async function typeDate(page: Page, iso: string) {
  const [year, month, day] = iso.split("-")
  const parts = { year, month, day }
  const field = dateField(page)
  for (const order of SEGMENT_ORDERS) {
    await field.fill("")
    await field.blur()
    await field.focus()
    await page.keyboard.type(order.map((part) => parts[part]).join(""))
    if ((await field.inputValue()) === iso) return
  }
  throw new Error(`The date field did not accept ${iso} typed from the keyboard`)
}

/** Types raw keys into the first segment, for incomplete input. */
export async function typeIntoDateField(page: Page, keys: string) {
  await dateField(page).focus()
  await page.keyboard.type(keys)
}

export async function expectRow(page: Page, table: string, row: string, cells: number[]) {
  const tableLocator = page.getByRole("table", { name: table })
  const rowLocator = tableLocator.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: row, exact: false }),
  })
  await expect(rowLocator.getByRole("cell")).toHaveText(cells.map(String))
}
