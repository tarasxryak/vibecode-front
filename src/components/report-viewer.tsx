"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { CalendarSearchIcon, RotateCcwIcon } from "lucide-react"

import { ReportResult, ReportSkeleton } from "@/components/report-tables"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { parseReportResponse, ReportFormatError, type Report } from "@/lib/report"
import {
  formatDayMonth,
  formatLongDate,
  formatWeekRange,
  isMonday,
  parseIsoDate,
  previousMonday,
  weekdayName,
} from "@/lib/week"

const REQUEST_TIMEOUT_MS = 20_000

type State =
  | { status: "idle" }
  | { status: "loading"; weekStart: string }
  | { status: "success"; report: Report }
  | { status: "empty"; weekStart: string }
  | { status: "error"; weekStart: string; message: string }

function validate(value: string, input: HTMLInputElement | null): string | null {
  if (input?.validity.badInput) return "Дата введена не полностью. Формат: ДД.ММ.ГГГГ"
  if (!value) return "Выберите понедельник недели"
  if (parseIsoDate(value) === null) return "Такой даты нет. Формат: ДД.ММ.ГГГГ"
  if (!isMonday(value)) {
    const monday = previousMonday(value)
    return `${formatLongDate(value)} — ${weekdayName(value)}. Выберите понедельник, например ${formatDayMonth(monday!)}.`
  }
  return null
}

function describeFailure(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === "TimeoutError") {
    return "Сервер не ответил за 20 секунд."
  }
  if (cause instanceof TypeError) return "Нет связи с сервером."
  if (cause instanceof ReportFormatError) {
    return "Сервис отчётов вернул данные в неожиданном формате."
  }
  if (cause instanceof Error && cause.message) return cause.message
  return "Неизвестная ошибка."
}

async function fetchReport(weekStart: string) {
  const response = await fetch(`/api/report?weekStart=${encodeURIComponent(weekStart)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `Сервер вернул ошибку ${response.status}.`
    throw new Error(message)
  }
  return parseReportResponse(body).report
}

export function ReportViewer() {
  const [weekStart, setWeekStart] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [state, setState] = useState<State>({ status: "idle" })
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  // State updates are async, so a second Enter or click in the same tick would still see
  // "idle". The ref flips synchronously and blocks every repeat until the request settles.
  const pendingRef = useRef(false)

  async function loadReport(week: string) {
    if (pendingRef.current) return
    pendingRef.current = true
    setState({ status: "loading", weekStart: week })
    // The week goes into the URL so a report can be shared or reopened by link.
    window.history.replaceState(null, "", `?week=${week}`)
    try {
      const report = await fetchReport(week)
      setState(report ? { status: "success", report } : { status: "empty", weekStart: week })
    } catch (cause) {
      setState({ status: "error", weekStart: week, message: describeFailure(cause) })
    } finally {
      pendingRef.current = false
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current) return

    const error = validate(weekStart, inputRef.current)
    setFieldError(error)
    if (error) {
      inputRef.current?.focus()
      return
    }
    void loadReport(weekStart)
  }

  const openLinkedWeek = useEffectEvent(() => {
    const week = new URLSearchParams(window.location.search).get("week")
    if (!week || !isMonday(week)) return
    setWeekStart(week)
    void loadReport(week)
  })

  useEffect(() => {
    // The URL is external state that exists only in the browser, so it is read once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openLinkedWeek()
  }, [])

  const loading = state.status === "loading"

  return (
    <div className="flex flex-col gap-10">
      <form ref={formRef} noValidate onSubmit={handleSubmit} aria-label="Выбор недели">
        <Field data-invalid={fieldError ? true : undefined} className="max-w-xl">
          <FieldLabel htmlFor="week-start">Понедельник недели</FieldLabel>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              ref={inputRef}
              id="week-start"
              name="weekStart"
              type="date"
              autoComplete="off"
              required
              value={weekStart}
              onChange={(event) => {
                setWeekStart(event.target.value)
                if (fieldError) setFieldError(null)
              }}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "week-start-error week-start-hint" : "week-start-hint"}
              className="h-10 bg-card sm:w-60"
            />
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              focusableWhenDisabled
              className="h-10 px-4 aria-disabled:cursor-progress aria-disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Spinner data-icon="inline-start" role="presentation" aria-hidden />
                  Загружаем отчёт…
                </>
              ) : (
                "Показать отчёт"
              )}
            </Button>
          </div>
          {fieldError && <FieldError id="week-start-error">{fieldError}</FieldError>}
          <FieldDescription id="week-start-hint">
            Неделя — с понедельника по воскресенье, время московское.
          </FieldDescription>
        </Field>
      </form>

      <p role="status" className="sr-only">
        {state.status === "loading" && "Загружаем отчёт"}
        {state.status === "success" && `Отчёт за ${formatWeekRange(state.report.weekStart)} загружен`}
        {state.status === "empty" && "За эту неделю отчёта нет"}
      </p>

      <div aria-busy={loading} aria-live="off">
        {state.status === "loading" && <ReportSkeleton />}
        {state.status === "success" && <ReportResult report={state.report} />}
        {state.status === "empty" && (
          <Empty className="border bg-card py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarSearchIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                <h2>За эту неделю отчёта нет</h2>
              </EmptyTitle>
              <EmptyDescription>
                Неделя {formatWeekRange(state.weekStart)} не сохранена. Отчёт появляется после
                запуска Lab 7.2 по понедельникам. Выберите другую неделю.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {state.status === "error" && (
          <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex flex-col gap-1">
              <AlertTitle>Не удалось загрузить отчёт</AlertTitle>
              <AlertDescription>
                {state.message} Дата сохранена — можно повторить запрос.
              </AlertDescription>
            </div>
            <Button variant="outline" onClick={() => formRef.current?.requestSubmit()}>
              <RotateCcwIcon data-icon="inline-start" aria-hidden />
              Повторить
            </Button>
          </Alert>
        )}
      </div>
    </div>
  )
}
