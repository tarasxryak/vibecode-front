import type { Metadata, Viewport } from "next"
import { Onest } from "next/font/google"

import { applySavedBackgroundScript } from "@/lib/backgrounds"
import "./globals.css"

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
})

export const metadata: Metadata = {
  title: "Отчёт по задачам за неделю",
  description: "Недельная статистика GitHub Issues репозитория tarasxryak/cs-math",
}

export const viewport: Viewport = {
  themeColor: "#f4f6f9",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-bg is set by the inline script before hydration, so React must not warn about it.
    <html lang="ru" className={`${onest.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedBackgroundScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
