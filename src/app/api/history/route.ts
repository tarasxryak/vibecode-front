import type { NextRequest } from "next/server"

import { callWebhook, errorResponse, jsonResponse, UpstreamError } from "@/lib/n8n"
import { parseHistoryReports, type HistoryResponse } from "@/lib/report"
import { addWeeks, isMonday } from "@/lib/week"

const MAX_WEEKS = 26

/**
 * `GET /api/history?until=YYYY-MM-DD&weeks=8` — the `weeks` calendar weeks ending with the
 * week of `until`, newest first. Weeks without a saved report come back with `totals: null`.
 * The client passes `until` (its last finished week), so the server clock never matters.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const until = params.get("until") ?? ""
  const weeks = Number(params.get("weeks") ?? "8")
  if (!isMonday(until)) {
    return errorResponse(400, "until должен быть понедельником в формате YYYY-MM-DD.")
  }
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) {
    return errorResponse(400, `weeks должен быть целым числом от 1 до ${MAX_WEEKS}.`)
  }

  try {
    const saved = new Map(
      parseHistoryReports(await callWebhook("history", {})).map((r) => [r.weekStart, r.totals])
    )
    const body: HistoryResponse = {
      weeks: Array.from({ length: weeks }, (_, index) => {
        const weekStart = addWeeks(until, -index)
        return { weekStart, totals: saved.get(weekStart) ?? null }
      }),
    }
    return jsonResponse(body)
  } catch (cause) {
    if (cause instanceof UpstreamError) return errorResponse(cause.status, cause.message)
    console.error("n8n history webhook returned an unexpected payload", cause)
    return errorResponse(502, "Сервис отчётов вернул данные в неожиданном формате.")
  }
}
