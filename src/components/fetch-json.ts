import { ReportFormatError } from "@/lib/report"

const REQUEST_TIMEOUT_MS = 20_000

/** GETs JSON from our own API. Non-2xx responses throw with the server's `error` sentence. */
export async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `Сервер вернул ошибку ${response.status}.`
    throw new Error(message)
  }
  return body
}

/** A complete sentence for the UI, ending with a period. */
export function describeFailure(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === "TimeoutError") {
    return "Сервер не ответил за 20 секунд."
  }
  if (cause instanceof TypeError) return "Нет связи с сервером."
  if (cause instanceof ReportFormatError) {
    return "Сервис отчётов вернул данные в неожиданном формате."
  }
  if (cause instanceof Error && cause.message) {
    return /[.!?…]$/.test(cause.message) ? cause.message : `${cause.message}.`
  }
  return "Неизвестная ошибка."
}
