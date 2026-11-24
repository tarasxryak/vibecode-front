import type { NextRequest } from "next/server"

import { callWebhook, errorResponse, jsonResponse, UpstreamError } from "@/lib/n8n"
import { parseReportResponse, ReportFormatError } from "@/lib/report"
import { isMonday } from "@/lib/week"

export async function GET(request: NextRequest) {
  const weekStart = request.nextUrl.searchParams.get("weekStart") ?? ""
  if (!isMonday(weekStart)) {
    return errorResponse(400, "weekStart должен быть понедельником в формате YYYY-MM-DD.")
  }

  try {
    const body = parseReportResponse(await callWebhook("report", { weekStart }))
    if (body.report && body.report.weekStart !== weekStart) {
      throw new ReportFormatError(`Пришёл отчёт за ${body.report.weekStart}, а не за ${weekStart}`)
    }
    return jsonResponse(body)
  } catch (cause) {
    if (cause instanceof UpstreamError) return errorResponse(cause.status, cause.message)
    console.error("n8n report webhook returned an unexpected payload", cause)
    return errorResponse(502, "Сервис отчётов вернул данные в неожиданном формате.")
  }
}
