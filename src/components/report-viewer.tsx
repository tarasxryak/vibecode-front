"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { CalendarSearchIcon, ChevronLeftIcon, ChevronRightIcon, HourglassIcon, RotateCcwIcon } from "lucide-react"

import { describeFailure, readJson } from "@/components/fetch-json"
import { ReportSkeleton, ReportTables, WeekStrip } from "@/components/report-tables"
import { WeekTrend } from "@/components/week-trend"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useMoscowToday } from "@/hooks/use-moscow-today"
import { cn } from "@/lib/utils"
import { parseReportResponse, type Report } from "@/lib/report"
import { addWeeks, formatDayMonth, formatWeekRange, mondayOf, parseIsoDate } from "@/lib/week"

/** What the result area shows once a request settles. */
type Settled =
  | { status: "success"; weekStart: string; picked: string; report: Report }
  | { status: "empty"; weekStart: string; picked: string }
  | { status: "error"; weekStart: string; picked: string; message: string }

function validate(value: string, input: HTMLInputElement | null, today: string | null): string | null {
  if (input?.validity.badInput) return "Дата введена не полностью. Формат: ДД.ММ.ГГГГ."
  if (!value) return "Выберите дату."
  if (parseIsoDate(value) === null) return "Такой даты нет. Формат: ДД.ММ.ГГГГ."
  if (today && value > today) return "Эта дата ещё не наступила. Выберите сегодняшний день или раньше."
  return null
}

async function fetchReport(weekStart: string) {
  return parseReportResponse(await readJson(`/api/report?weekStart=${encodeURIComponent(weekStart)}`)).report
}

export function ReportViewer() {
  const today = useMoscowToday()
  const [date, setDate] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ weekStart: string; picked: string } | null>(null)
  const [settled, setSettled] = useState<Settled | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  // State updates are async, so a second Enter or click in the same tick would still see no
  // pending request. The ref flips synchronously and blocks every repeat until the request settles.
  const pendingRef = useRef(false)

  const currentMonday = today ? mondayOf(today) : null
  const lastFinished = currentMonday ? addWeeks(currentMonday, -1) : null

  async function loadWeek(picked: string, options: { reveal?: boolean } = {}) {
    if (pendingRef.current) return
    const weekStart = mondayOf(picked)
    if (!weekStart) return
    pendingRef.current = true
    setDate(picked)
    setFieldError(null)
    setPending({ weekStart, picked })
    // The week goes into the URL so a report can be shared or reopened by link.
    window.history.replaceState(null, "", `?week=${weekStart}`)
    if (options.reveal) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      resultHeadingRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
    }
    try {
      const report = await fetchReport(weekStart)
      setSettled(
        report
          ? { status: "success", weekStart, picked, report }
          : { status: "empty", weekStart, picked }
      )
    } catch (cause) {
      setSettled({ status: "error", weekStart, picked, message: describeFailure(cause) })
    } finally {
      pendingRef.current = false
      setPending(null)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current) return
    const error = validate(date, inputRef.current, today)
    setFieldError(error)
    if (error) {
      inputRef.current?.focus()
      return
    }
    void loadWeek(date)
  }

  const openLinkedWeek = useEffectEvent(() => {
    const week = new URLSearchParams(window.location.search).get("week")
    if (!week || parseIsoDate(week) === null || (today && week > today)) return
    void loadWeek(week)
  })

  useEffect(() => {
    // The URL is external state that exists only in the browser, so it is read once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openLinkedWeek()
  }, [])

  const loading = pending !== null
  const shownWeek = pending?.weekStart ?? settled?.weekStart ?? null
  const shownPicked = pending?.picked ?? settled?.picked
  const pickedWeek = !fieldError && parseIsoDate(date) !== null && !(today && date > today) ? mondayOf(date) : null
  const isCurrentWeek = (week: string) => week === currentMonday

  return (
    <div className="flex flex-col gap-10">
      <form noValidate onSubmit={handleSubmit} aria-label="Выбор недели" className="flex flex-col gap-4">
        <Field data-invalid={fieldError ? true : undefined} className="max-w-xl">
          <FieldLabel htmlFor="week-date">Любой день нужной недели</FieldLabel>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              ref={inputRef}
              id="week-date"
              name="date"
              type="date"
              autoComplete="off"
              required
              max={today ?? undefined}
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                if (fieldError) setFieldError(null)
              }}
              onClick={(event) => {
                // Open the calendar on any click, not only on the small icon.
                try {
                  event.currentTarget.showPicker()
                } catch {}
              }}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "week-date-error week-date-hint" : "week-date-hint"}
              className="h-10 cursor-pointer bg-card sm:w-60"
            />
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              focusableWhenDisabled
              className="h-10 px-4 aria-disabled:cursor-progress aria-disabled:opacity-70 sm:min-w-44"
            >
              {loading && <Spinner data-icon="inline-start" role="presentation" aria-hidden />}
              {loading ? "Загружаем…" : "Показать отчёт"}
            </Button>
          </div>
          {fieldError && <FieldError id="week-date-error">{fieldError}</FieldError>}
          <FieldDescription id="week-date-hint">
            {pickedWeek
              ? `Покажем неделю ${formatWeekRange(pickedWeek)}.`
              : "Покажем всю неделю с понедельника по воскресенье, время московское."}
          </FieldDescription>
        </Field>
        {lastFinished && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Быстрый выбор">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void loadWeek(lastFinished)}
            >
              Прошлая неделя
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void loadWeek(addWeeks(lastFinished, -1))}
            >
              Позапрошлая неделя
            </Button>
          </div>
        )}
      </form>

      <p role="status" className="sr-only">
        {loading && "Загружаем отчёт"}
        {!loading && settled?.status === "success" && `Отчёт за ${formatWeekRange(settled.weekStart)} загружен`}
        {!loading && settled?.status === "empty" && "За эту неделю отчёта нет"}
      </p>

      {shownWeek && (
        <section aria-labelledby="result-heading" className="flex scroll-mt-6 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="result-heading"
                ref={resultHeadingRef}
                className="scroll-mt-6 text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
              >
                {formatWeekRange(shownWeek)}
              </h2>
              <div className="flex gap-2" role="group" aria-label="Соседние недели">
                <Button
                  variant="outline"
                  disabled={loading}
                  onClick={() => void loadWeek(addWeeks(shownWeek, -1))}
                >
                  <ChevronLeftIcon data-icon="inline-start" aria-hidden />
                  Предыдущая
                </Button>
                <Button
                  variant="outline"
                  disabled={loading || !currentMonday || addWeeks(shownWeek, 1) > currentMonday}
                  onClick={() => void loadWeek(addWeeks(shownWeek, 1))}
                >
                  Следующая
                  <ChevronRightIcon data-icon="inline-end" aria-hidden />
                </Button>
              </div>
            </div>
            <WeekStrip weekStart={shownWeek} picked={shownPicked} />
          </div>

          <div
            aria-busy={loading}
            className={cn("transition-opacity", loading && settled && "pointer-events-none opacity-50")}
          >
            {loading && !settled && <ReportSkeleton />}
            {settled?.status === "success" && <ReportTables report={settled.report} />}
            {settled?.status === "empty" &&
              (isCurrentWeek(settled.weekStart) ? (
                <Empty className="border bg-card py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HourglassIcon aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">
                      <h3>Неделя ещё идёт</h3>
                    </EmptyTitle>
                    <EmptyDescription>
                      Отчёт за эту неделю появится в понедельник,{" "}
                      {formatDayMonth(addWeeks(settled.weekStart, 1))}, после 09:00 по Москве.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" onClick={() => void loadWeek(addWeeks(settled.weekStart, -1))}>
                      Открыть прошлую неделю
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <Empty className="border bg-card py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CalendarSearchIcon aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">
                      <h3>За эту неделю отчёта нет</h3>
                    </EmptyTitle>
                    <EmptyDescription>
                      Lab 7.2 не сохранил отчёт за эту неделю. Выберите другую неделю или
                      посмотрите список последних недель ниже.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ))}
            {settled?.status === "error" && (
              <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex flex-col gap-1">
                  <AlertTitle>Не удалось загрузить отчёт</AlertTitle>
                  <AlertDescription className="[&_p:not(:last-child)]:mb-0">
                    <p>{settled.message}</p>
                    <p>Дата сохранена — можно повторить запрос.</p>
                  </AlertDescription>
                </div>
                <Button variant="outline" onClick={() => void loadWeek(settled.picked)}>
                  <RotateCcwIcon data-icon="inline-start" aria-hidden />
                  Повторить
                </Button>
              </Alert>
            )}
          </div>
        </section>
      )}

      <WeekTrend
        selectedWeek={shownWeek}
        onSelect={(weekStart) => void loadWeek(weekStart, { reveal: true })}
      />
    </div>
  )
}

