import { AsciiBackdrop } from "@/components/ascii-backdrop"
import { BackgroundPicker } from "@/components/background-picker"
import { ReportViewer } from "@/components/report-viewer"

export default function Home() {
  return (
    <>
      <AsciiBackdrop />
      <div className="app-frame relative z-10">
        <main className="app-shell mx-auto flex w-full max-w-[920px] flex-col gap-8">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <p className="text-sm text-muted-foreground">
                GitHub Issues · <span translate="no">tarasxryak/cs-math</span>
              </p>
              <BackgroundPicker />
            </div>
            <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] leading-tight font-bold tracking-tight text-balance">
              Отчёт по задачам за неделю
            </h1>
            <p className="max-w-[60ch] text-muted-foreground">
              Выберите любой день — покажем всю его неделю: сколько задач создали, закрыли и сколько
              ещё в работе.
            </p>
          </header>
          <ReportViewer />
          <footer className="app-credit text-xs text-muted-foreground">
            Фон — анимации «Desert Buttes Road», «Fuji Dawn Lake» и «Neon Harbour Ferry» из{" "}
            <a
              href="https://github.com/kailashsr38/ascii-magic-art"
              className="underline underline-offset-2 hover:text-foreground"
            >
              ascii-magic-art
            </a>{" "}
            © 2026 ASCII Magic, лицензия MIT.
          </footer>
        </main>
      </div>
    </>
  )
}
