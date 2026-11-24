"use client"

import { useEffect, useState } from "react"
import { RotateCcwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { parseHistoryResponse, type HistoryWeek } from "@/lib/report"
import { addWeeks, formatWeekRange, mondayOf } from "@/lib/week"
import { useMoscowToday } from "@/hooks/use-moscow-today"
import { describeFailure, readJson } from "@/components/fetch-json"

const RANGES = ["4", "8", "12"] as const
type Range = (typeof RANGES)[number]

type Loaded =
  | { key: string; status: "success"; weeks: HistoryWeek[] }
  | { key: string; status: "error"; message: string }

async function fetchHistory(until: string, weeks: string) {
  const query = new URLSearchParams({ until, weeks })
  return parseHistoryResponse(await readJson(`/api/history?${query}`)).weeks
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  if (value === 0) return <span className="block h-2" />
  return (
    <span
      className={cn("block h-2 rounded-r-[4px]", className)}
      style={{ width: `${Math.max((value / max) * 100, 4)}%` }}
    />
  )
}

export function WeekTrend({
  selectedWeek,
  onSelect,
}: {
  selectedWeek: string | null
  onSelect: (weekStart: string) => void
}) {
  const [range, setRange] = useState<Range>("8")
  const [attempt, setAttempt] = useState(0)
  const today = useMoscowToday()
  const until = today ? addWeeks(mondayOf(today)!, -1) : null
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  // The newest finished week depends on the viewer's clock, so it is only known after hydration.
  // Loading is derived from `loaded.key`, so the effect never sets state synchronously.
  const key = until ? `${until}|${range}|${attempt}` : null

  useEffect(() => {
    if (!until || !key) return
    let current = true
    fetchHistory(until, range).then(
      (weeks) => current && setLoaded({ key, status: "success", weeks }),
      (cause) => current && setLoaded({ key, status: "error", message: describeFailure(cause) })
    )
    return () => {
      current = false
    }
  }, [until, range, key])

  const pending = loaded?.key !== key
  const weeks = loaded?.status === "success" ? loaded.weeks : []
  const max = Math.max(1, ...weeks.flatMap((week) => (week.totals ? [week.totals.opened, week.totals.closed] : [])))

  return (
    <section aria-labelledby="trend-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="trend-heading" className="text-xl font-semibold tracking-tight">
            Последние недели
          </h2>
          <p className="text-sm text-muted-foreground">
            Нажмите на неделю, чтобы открыть её отчёт.
          </p>
        </div>
        <ToggleGroup
          aria-label="Сколько недель показать"
          variant="outline"
          size="sm"
          spacing={0}
          value={[range]}
          onValueChange={(value) => {
            const next = value[0] as Range | undefined
            if (next) setRange(next)
          }}
        >
          {RANGES.map((item) => (
            <ToggleGroupItem key={item} value={item} className="px-3">
              {item} нед.
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {loaded?.status === "error" && !pending ? (
        <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex flex-col gap-1">
            <AlertTitle>Не удалось загрузить последние недели</AlertTitle>
            <AlertDescription>{loaded.message}</AlertDescription>
          </div>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            <RotateCcwIcon data-icon="inline-start" aria-hidden />
            Повторить
          </Button>
        </Alert>
      ) : (
        <div
          aria-busy={pending}
          className={cn(
            "overflow-hidden rounded-lg border bg-card transition-opacity",
            pending && weeks.length > 0 && "opacity-60"
          )}
        >
          <ul aria-label="Обозначения" className="flex gap-4 border-b px-3 py-2 text-xs text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-3 rounded-r-[2px] bg-metric-opened" />
              Создано
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-3 rounded-r-[2px] bg-metric-closed" />
              Закрыто
            </li>
          </ul>
          <Table aria-labelledby="trend-heading" className="max-sm:text-[0.8125rem]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Неделя</TableHead>
                <TableHead scope="col" className="text-right">Создано</TableHead>
                <TableHead scope="col" className="text-right">Закрыто</TableHead>
                <TableHead scope="col" className="w-2/5 max-sm:hidden">
                  <span className="sr-only">График</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeks.length === 0
                ? Array.from({ length: Number(range) > 4 ? 4 : Number(range) }, (_, row) => (
                    <TableRow key={row}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : weeks.map((week) => {
                    const selected = week.weekStart === selectedWeek
                    return (
                      <TableRow
                        key={week.weekStart}
                        aria-current={selected ? "true" : undefined}
                        className={cn(selected && "bg-primary/5 hover:bg-primary/10")}
                      >
                        <TableHead scope="row" className="py-1 font-medium">
                          {week.totals ? (
                            <>
                              <Button
                                variant="link"
                                className="h-auto px-0 py-1.5 text-[length:inherit] text-foreground"
                                onClick={() => onSelect(week.weekStart)}
                              >
                                {formatWeekRange(week.weekStart)}
                              </Button>
                              {/* On phones the bars sit under the week instead of in their own column. */}
                              <span className="flex flex-col gap-0.5 pb-1.5 sm:hidden" aria-hidden>
                                <Bar value={week.totals.opened} max={max} className="bg-metric-opened" />
                                <Bar value={week.totals.closed} max={max} className="bg-metric-closed" />
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{formatWeekRange(week.weekStart)}</span>
                          )}
                        </TableHead>
                        {week.totals ? (
                          <>
                            <TableCell className="text-right">{week.totals.opened}</TableCell>
                            <TableCell className="text-right">{week.totals.closed}</TableCell>
                            <TableCell className="max-sm:hidden">
                              <span className="flex flex-col gap-0.5" aria-hidden>
                                <Bar value={week.totals.opened} max={max} className="bg-metric-opened" />
                                <Bar value={week.totals.closed} max={max} className="bg-metric-closed" />
                              </span>
                            </TableCell>
                          </>
                        ) : (
                          <TableCell colSpan={3} className="text-muted-foreground">
                            нет отчёта
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
