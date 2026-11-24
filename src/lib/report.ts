export const METRICS = ["opened", "closed", "open", "progress"] as const
export const ISSUE_TYPES = ["bug", "task", "feature", "other"] as const

export type Metric = (typeof METRICS)[number]
export type IssueType = (typeof ISSUE_TYPES)[number]
export type Counts = Record<Metric, number>
export type AuthorCounts = Counts & { author: string }

export type Report = {
  repository: string
  weekStart: string
  totals: Counts
  byType: Record<IssueType, Counts>
  byAuthor: AuthorCounts[]
}

/** Shape returned by both the n8n webhook and `GET /api/report`. */
export type ReportResponse = { report: Report | null }

export class ReportFormatError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseCounts(value: unknown, where: string): Counts {
  if (!isRecord(value)) throw new ReportFormatError(`${where}: нет счётчиков`)
  const counts = {} as Counts
  for (const metric of METRICS) {
    const count = value[metric]
    if (!Number.isInteger(count) || (count as number) < 0) {
      throw new ReportFormatError(`${where}.${metric}: ожидалось целое число ≥ 0`)
    }
    counts[metric] = count as number
  }
  return counts
}

/** One calendar week in the trend; `totals` is null when no report was saved for it. */
export type HistoryWeek = { weekStart: string; totals: Counts | null }

/** Shape of `GET /api/history`: the requested weeks, newest first, gaps included. */
export type HistoryResponse = { weeks: HistoryWeek[] }

/** Validates the history webhook payload: `{ reports: [{ weekStart, totals }] }`. */
export function parseHistoryReports(value: unknown): { weekStart: string; totals: Counts }[] {
  if (!isRecord(value) || !Array.isArray(value.reports)) {
    throw new ReportFormatError("Ответ без массива reports")
  }
  return value.reports.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.weekStart !== "string") {
      throw new ReportFormatError(`reports[${index}]: нет weekStart`)
    }
    return { weekStart: entry.weekStart, totals: parseCounts(entry.totals, `reports[${index}].totals`) }
  })
}

export function parseHistoryResponse(value: unknown): HistoryResponse {
  if (!isRecord(value) || !Array.isArray(value.weeks)) {
    throw new ReportFormatError("Ответ без массива weeks")
  }
  return {
    weeks: value.weeks.map((entry, index) => {
      if (!isRecord(entry) || typeof entry.weekStart !== "string") {
        throw new ReportFormatError(`weeks[${index}]: нет weekStart`)
      }
      return {
        weekStart: entry.weekStart,
        totals: entry.totals === null ? null : parseCounts(entry.totals, `weeks[${index}].totals`),
      }
    }),
  }
}

/** Validates the webhook payload so the UI never renders half-broken tables. */
export function parseReportResponse(value: unknown): ReportResponse {
  if (!isRecord(value) || !("report" in value)) {
    throw new ReportFormatError("Ответ без поля report")
  }
  const raw = value.report
  if (raw === null) return { report: null }
  if (!isRecord(raw)) throw new ReportFormatError("report должен быть объектом или null")

  if (typeof raw.repository !== "string" || typeof raw.weekStart !== "string") {
    throw new ReportFormatError("report: нет repository или weekStart")
  }
  if (!isRecord(raw.byType)) throw new ReportFormatError("report.byType: ожидался объект")
  if (!Array.isArray(raw.byAuthor)) throw new ReportFormatError("report.byAuthor: ожидался массив")

  const byTypeRaw = raw.byType
  const byType = Object.fromEntries(
    ISSUE_TYPES.map((type) => [type, parseCounts(byTypeRaw[type], `byType.${type}`)])
  ) as Record<IssueType, Counts>

  const byAuthor = raw.byAuthor.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.author !== "string") {
      throw new ReportFormatError(`byAuthor[${index}]: нет author`)
    }
    return { author: entry.author, ...parseCounts(entry, `byAuthor[${index}]`) }
  })

  return {
    report: {
      repository: raw.repository,
      weekStart: raw.weekStart,
      totals: parseCounts(raw.totals, "totals"),
      byType,
      byAuthor,
    },
  }
}
