import { expect, test } from "@playwright/test"

import { fullReport } from "./helpers"

// Server route contracts. The mock webhook rejects requests without `Bearer test-token`,
// so every 200 here also proves N8N_WEBHOOK_TOKEN is forwarded.

test("report: отдаёт отчёт из n8n", async ({ request }) => {
  const response = await request.get("/api/report?weekStart=2026-11-16")
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual(fullReport)
})

test("report: отдаёт report: null, если строки нет", async ({ request }) => {
  const response = await request.get("/api/report?weekStart=2026-11-23")
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ report: null })
})

test("report: 400 для даты, которая не понедельник или не дата", async ({ request }) => {
  for (const weekStart of ["2026-11-17", "2026-02-30", "16.11.2026", ""]) {
    const response = await request.get(`/api/report?weekStart=${weekStart}`)
    expect(response.status(), weekStart).toBe(400)
  }
})

test("report: 502 с законченным предложением, если n8n упал или ответил не по контракту", async ({ request }) => {
  const failed = await request.get("/api/report?weekStart=2026-11-02")
  expect(failed.status()).toBe(502)
  expect(await failed.json()).toEqual({ error: "Сервис отчётов вернул ошибку 500." })

  const malformed = await request.get("/api/report?weekStart=2026-10-26")
  expect(malformed.status()).toBe(502)
})

test("history: календарные недели, новые сверху, пропуски — null", async ({ request }) => {
  const response = await request.get("/api/history?until=2026-11-16&weeks=6")
  expect(response.status()).toBe(200)
  const { weeks } = await response.json()
  expect(weeks.map((w: { weekStart: string }) => w.weekStart)).toEqual([
    "2026-11-16",
    "2026-11-09",
    "2026-11-02",
    "2026-10-26",
    "2026-10-19",
    "2026-10-12",
  ])
  expect(weeks[0].totals).toEqual(fullReport.report.totals)
  expect(weeks[1].totals).toEqual({ opened: 0, closed: 0, open: 0, progress: 0 })
  expect(weeks[2].totals).toBeNull()
  expect(weeks[4].totals).toEqual({ opened: 4, closed: 5, open: 1, progress: 1 })
})

test("history: 400 для неверных until и weeks", async ({ request }) => {
  for (const query of ["until=2026-11-17&weeks=8", "until=&weeks=8", "until=2026-11-16&weeks=0", "until=2026-11-16&weeks=27", "until=2026-11-16&weeks=abc"]) {
    const response = await request.get(`/api/history?${query}`)
    expect(response.status(), query).toBe(400)
  }
})
