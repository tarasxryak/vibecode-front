import type { NextRequest } from "next/server"

import { parseReportResponse, ReportFormatError } from "@/lib/report"
import { isMonday } from "@/lib/week"

const UPSTREAM_TIMEOUT_MS = 10_000

function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } })
}

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart") ?? ""
  if (!isMonday(weekStart)) {
    return error(400, "weekStart должен быть понедельником в формате YYYY-MM-DD")
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (!webhookUrl) {
    console.error("N8N_WEBHOOK_URL is not set")
    return error(500, "Сервис отчётов не настроен")
  }

  const url = new URL(webhookUrl)
  url.searchParams.set("weekStart", weekStart)
  const headers: HeadersInit = { Accept: "application/json" }
  const token = process.env.N8N_WEBHOOK_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  let upstream: Response
  try {
    upstream = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (cause) {
    console.error("n8n webhook request failed", cause)
    return error(502, "Сервис отчётов не ответил")
  }

  if (!upstream.ok) {
    console.error(`n8n webhook responded with ${upstream.status}`)
    return error(502, `Сервис отчётов вернул ошибку ${upstream.status}`)
  }

  try {
    const body = parseReportResponse(await upstream.json())
    if (body.report && body.report.weekStart !== weekStart) {
      throw new ReportFormatError(`Пришёл отчёт за ${body.report.weekStart}, а не за ${weekStart}`)
    }
    return Response.json(body, { headers: { "Cache-Control": "no-store" } })
  } catch (cause) {
    console.error("n8n webhook returned an unexpected payload", cause)
    return error(502, "Сервис отчётов вернул данные в неожиданном формате")
  }
}
