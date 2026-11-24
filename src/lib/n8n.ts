import "server-only"

const UPSTREAM_TIMEOUT_MS = 10_000

/** A failure the UI can show as is. Messages are complete sentences. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } })
}

export function jsonResponse(body: unknown) {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } })
}

/** URL of the history webhook: N8N_HISTORY_WEBHOOK_URL, or the report URL with its last segment swapped. */
function historyUrl(reportUrl: string) {
  return process.env.N8N_HISTORY_WEBHOOK_URL || new URL("lab8-weekly-history", reportUrl).toString()
}

export async function callWebhook(
  kind: "report" | "history",
  params: Record<string, string>
): Promise<unknown> {
  const reportUrl = process.env.N8N_WEBHOOK_URL
  if (!reportUrl) {
    console.error("N8N_WEBHOOK_URL is not set")
    throw new UpstreamError("Сервис отчётов не настроен.", 500)
  }

  const url = new URL(kind === "report" ? reportUrl : historyUrl(reportUrl))
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
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
    console.error(`n8n ${kind} webhook request failed`, cause)
    throw new UpstreamError("Сервис отчётов не ответил.", 502)
  }

  if (!upstream.ok) {
    console.error(`n8n ${kind} webhook responded with ${upstream.status}`)
    throw new UpstreamError(`Сервис отчётов вернул ошибку ${upstream.status}.`, 502)
  }

  try {
    return await upstream.json()
  } catch (cause) {
    console.error(`n8n ${kind} webhook returned non-JSON`, cause)
    throw new UpstreamError("Сервис отчётов вернул данные в неожиданном формате.", 502)
  }
}
