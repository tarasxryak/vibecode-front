import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ISSUE_TYPES, METRICS, type Counts, type IssueType, type Metric, type Report } from "@/lib/report"
import { weekDays } from "@/lib/week"

const METRIC_LABELS: Record<Metric, string> = {
  opened: "Создано",
  closed: "Закрыто",
  open: "Ещё открыто",
  progress: "В работе",
}

const METRIC_DOTS: Record<Metric, string> = {
  opened: "bg-metric-opened",
  closed: "bg-metric-closed",
  open: "bg-metric-open",
  progress: "bg-metric-progress",
}

const TYPE_LABELS: Record<IssueType, { title: string; label?: string }> = {
  bug: { title: "Ошибка", label: "bug" },
  task: { title: "Задача", label: "task" },
  feature: { title: "Новая функция", label: "feature" },
  other: { title: "Без типа" },
}

function MetricHeads() {
  return METRICS.map((metric) => (
    <TableHead key={metric} scope="col" className="text-right whitespace-normal max-sm:h-auto max-sm:px-1.5 max-sm:py-2">
      <span className="inline-flex items-center gap-1.5 max-sm:flex-col max-sm:items-end max-sm:gap-1">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", METRIC_DOTS[metric])} />
        {METRIC_LABELS[metric]}
      </span>
    </TableHead>
  ))
}

function MetricCells({ counts }: { counts: Counts }) {
  return METRICS.map((metric) => (
    <TableCell
      key={metric}
      className={cn("text-right max-sm:px-1.5", counts[metric] === 0 && "text-muted-foreground")}
    >
      {counts[metric]}
    </TableCell>
  ))
}

function TableSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-lg font-semibold">
        {title}
      </h3>
      <div className="overflow-hidden rounded-lg border bg-card">{children}</div>
    </section>
  )
}

export function WeekStrip({ weekStart, picked }: { weekStart: string; picked?: string }) {
  const days = weekDays(weekStart)
  const highlighted = days.some((day) => day.iso === picked) ? picked : weekStart
  return (
    <ol aria-hidden className="grid grid-cols-7 gap-1">
      {days.map((day) => (
        <li
          key={day.iso}
          className={cn(
            "flex flex-col rounded-md border bg-card px-2 py-1.5 max-sm:items-center max-sm:px-1",
            day.iso === highlighted && "border-primary bg-primary text-primary-foreground"
          )}
        >
          <span className="text-xs opacity-80">{day.label}</span>
          <span className="text-lg font-semibold max-sm:text-base">{day.day}</span>
        </li>
      ))}
    </ol>
  )
}

export function ReportTables({ report }: { report: Report }) {
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-[70ch] text-sm text-muted-foreground">
        «Ещё открыто» и «В работе» считаются по задачам, созданным за эту неделю, на момент
        сохранения отчёта.
      </p>

      <TableSection id="by-type" title="По типу задачи">
        <Table aria-labelledby="by-type" className="max-sm:text-[0.8125rem]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Тип</TableHead>
              <MetricHeads />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ISSUE_TYPES.map((type) => (
              <TableRow key={type}>
                <TableHead scope="row" className="font-medium max-sm:whitespace-normal">
                  <span className="inline-flex items-center gap-2">
                    {TYPE_LABELS[type].title}
                    {TYPE_LABELS[type].label && (
                      <Badge variant="outline" translate="no" className="text-muted-foreground max-sm:hidden">
                        {TYPE_LABELS[type].label}
                      </Badge>
                    )}
                  </span>
                </TableHead>
                <MetricCells counts={report.byType[type]} />
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableHead scope="row" className="font-semibold">
                Всего
              </TableHead>
              <MetricCells counts={report.totals} />
            </TableRow>
          </TableFooter>
        </Table>
      </TableSection>

      <TableSection id="by-author" title="По автору">
        <Table aria-labelledby="by-author" className="max-sm:text-[0.8125rem]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Автор</TableHead>
              <MetricHeads />
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byAuthor.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-muted-foreground">
                  За неделю задач не было
                </TableCell>
              </TableRow>
            ) : (
              report.byAuthor.map(({ author, ...counts }) => (
                <TableRow key={author}>
                  <TableHead scope="row" className="font-medium">
                    <span title={author} translate="no" className="block max-w-48 truncate max-sm:max-w-20">
                      {author}
                    </span>
                  </TableHead>
                  <MetricCells counts={counts} />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableSection>
    </div>
  )
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-8" data-testid="report-skeleton">
      <Skeleton className="h-4 w-full max-w-xl" />
      {["by-type", "by-author"].map((key) => (
        <div key={key} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            {Array.from({ length: 4 }, (_, row) => (
              <Skeleton key={row} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
