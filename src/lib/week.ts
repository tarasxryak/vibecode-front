const DAY_MS = 24 * 60 * 60 * 1000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Parses `YYYY-MM-DD` as a UTC midnight timestamp, or returns null for impossible dates. */
export function parseIsoDate(value: string): number | null {
  if (!ISO_DATE.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const time = Date.UTC(year, month - 1, day)
  const date = new Date(time)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return time
}

export function isMonday(value: string): boolean {
  const time = parseIsoDate(value)
  return time !== null && new Date(time).getUTCDay() === 1
}

function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

/** Monday of the Mon–Sun week that contains `value`. */
export function mondayOf(value: string): string | null {
  const time = parseIsoDate(value)
  if (time === null) return null
  const offset = (new Date(time).getUTCDay() + 6) % 7
  return toIso(time - offset * DAY_MS)
}

export function addWeeks(monday: string, weeks: number): string {
  const time = parseIsoDate(monday)
  return time === null ? monday : toIso(time + weeks * 7 * DAY_MS)
}

// Lab 7.2 counts weeks in Moscow time, which has no DST (UTC+3).
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000

export function moscowToday(now: number = Date.now()): string {
  return toIso(now + MOSCOW_OFFSET_MS)
}

/** Monday of the latest week that has fully ended in Moscow — the newest week Lab 7.2 can save. */
export function lastFinishedMonday(now: number = Date.now()): string {
  return addWeeks(mondayOf(moscowToday(now))!, -1)
}

const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" })
const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" })
const dayMonthYear = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})
const shortWeekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" })

/** «17 ноября 2026» without the trailing «г.» that Intl adds. */
export function formatLongDate(value: string): string {
  const time = parseIsoDate(value)
  if (time === null) return value
  return dayMonthYear.format(time).replace(/\s*г\.$/, "")
}

export function formatDayMonth(value: string): string {
  const time = parseIsoDate(value)
  return time === null ? value : dayMonth.format(time)
}

export function weekdayName(value: string): string {
  const time = parseIsoDate(value)
  return time === null ? "" : weekday.format(time)
}

/** «16–22 ноября 2026» or «30 ноября — 6 декабря 2026». */
export function formatWeekRange(weekStart: string): string {
  const start = parseIsoDate(weekStart)
  if (start === null) return weekStart
  const end = start + 6 * DAY_MS
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
    return `${formatLongDate(weekStart)} — ${formatLongDate(toIso(end))}`
  }
  if (startDate.getUTCMonth() !== endDate.getUTCMonth()) {
    return `${dayMonth.format(start)} — ${formatLongDate(toIso(end))}`
  }
  return `${startDate.getUTCDate()}–${formatLongDate(toIso(end))}`
}

export function weekDays(weekStart: string): { iso: string; day: number; label: string }[] {
  const start = parseIsoDate(weekStart)
  if (start === null) return []
  return Array.from({ length: 7 }, (_, index) => {
    const time = start + index * DAY_MS
    return {
      iso: toIso(time),
      day: new Date(time).getUTCDate(),
      label: shortWeekday.format(time),
    }
  })
}
