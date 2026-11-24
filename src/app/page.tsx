import { ReportViewer } from "@/components/report-viewer"

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[920px] flex-col gap-8 px-4 pt-10 pb-16 sm:pt-14">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          GitHub Issues · <span translate="no">tarasxryak/cs-math</span>
        </p>
        <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] leading-tight font-bold tracking-tight text-balance">
          Отчёт по задачам за неделю
        </h1>
        <p className="max-w-[60ch] text-muted-foreground">
          Выберите любой день — покажем всю его неделю: сколько задач создали, закрыли и сколько
          ещё в работе.
        </p>
      </header>
      <ReportViewer />
    </main>
  )
}
