import { expect, test } from "@playwright/test"

import { fullReport } from "./helpers"

// Server route contract. The mock webhook rejects requests without `Bearer test-token`,
// so every 200 here also proves N8N_WEBHOOK_TOKEN is forwarded.

test("отдаёт отчёт из n8n", async ({ request }) => {
  const response = await request.get("/api/report?weekStart=2026-11-16")
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual(fullReport)
})

test("отдаёт report: null, если строки нет", async ({ request }) => {
  const response = await request.get("/api/report?weekStart=2026-11-23")
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ report: null })
})

test("400 для даты, которая не понедельник или не дата", async ({ request }) => {
  for (const weekStart of ["2026-11-17", "2026-02-30", "16.11.2026", ""]) {
    const response = await request.get(`/api/report?weekStart=${weekStart}`)
    expect(response.status(), weekStart).toBe(400)
  }
})

test("502, если n8n упал или ответил не по контракту", async ({ request }) => {
  const failed = await request.get("/api/report?weekStart=2026-11-02")
  expect(failed.status()).toBe(502)
  expect(await failed.json()).toEqual({ error: "Сервис отчётов вернул ошибку 500" })

  const malformed = await request.get("/api/report?weekStart=2026-10-26")
  expect(malformed.status()).toBe(502)
})
