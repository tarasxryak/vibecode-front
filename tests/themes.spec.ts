import { expect, test, type Page } from "@playwright/test"

import { dateField, fullReport, historyBody, mockHistoryApi, mockReportApi, openPage, submitButton } from "./helpers"

const trigger = (page: Page) => page.getByRole("button", { name: /^Тема:/ })
const backdrop = (page: Page) => page.getByTestId("ascii-backdrop")
const html = (page: Page) => page.locator("html")

/** Opens the theme menu and picks a theme by its visible name. */
async function chooseTheme(page: Page, label: string) {
  await trigger(page).click()
  await expect(page.getByRole("menu")).toBeVisible()
  await page.getByRole("menuitemradio", { name: new RegExp(`^${label}`) }).click()
  await expect(page.getByRole("menu")).toBeHidden()
}

/** Background colour of the content panel as [r, g, b, a]. */
async function panelColor(page: Page) {
  return page.locator("main").evaluate((el) => {
    const ctx = document.createElement("canvas").getContext("2d")!
    ctx.fillStyle = getComputedStyle(el).backgroundColor
    ctx.fillRect(0, 0, 1, 1)
    return Array.from(ctx.getImageData(0, 0, 1, 1).data)
  })
}

const luminance = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

test.beforeEach(async ({ page }) => {
  await mockHistoryApi(page, { body: historyBody() })
})

// Still frames by default: a dozen pages animating full-screen canvases in parallel starve the CPU.
// The tests about motion itself opt back in below.
test.use({ reducedMotion: "reduce" })

test.describe("меню тем", () => {
  test("по клику раскрывается список из четырёх тем с описанием", async ({ page }) => {
    await openPage(page)
    await expect(trigger(page)).toHaveText("Без фона")
    await expect(page.getByRole("menu")).toHaveCount(0)

    await trigger(page).click()
    const items = page.getByRole("menuitemradio")
    await expect(items).toHaveCount(4)
    await expect(items.nth(0)).toContainText("Без фонаСветлая страница без анимации")
    await expect(items.nth(1)).toContainText("Пустыня")
    await expect(items.nth(2)).toContainText("Фудзи")
    await expect(items.nth(3)).toContainText("Гавань")
    await expect(items.nth(0)).toHaveAttribute("aria-checked", "true")
    await expect(backdrop(page)).toHaveCount(0)
  })

  test("работает с клавиатуры: Enter открывает, стрелки и Enter выбирают, Escape закрывает", async ({ page }) => {
    await openPage(page)
    await trigger(page).focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("menu")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toBeHidden()
    await expect(trigger(page)).toBeFocused()

    await page.keyboard.press("Enter")
    await expect(page.getByRole("menuitemradio").first()).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")
    await expect(html(page)).toHaveAttribute("data-bg", "fuji")
    await expect(trigger(page)).toHaveText("Фудзи")
  })
})

for (const [label, bg, piece] of [
  ["Пустыня", "desert", "desert-buttes-road"],
  ["Фудзи", "fuji", "fuji-dawn-lake"],
  ["Гавань", "harbour", "harbour-neon-skyline"],
] as const) {
  test(`«${label}»: своя сцена в стиле lines, панель почти непрозрачна @mobile`, async ({ page }) => {
    await openPage(page)
    await chooseTheme(page, label)

    await expect(html(page)).toHaveAttribute("data-bg", bg)
    await expect(backdrop(page)).toHaveAttribute("data-piece", piece)
    await expect(backdrop(page)).toHaveAttribute("aria-hidden", "true")
    await expect(backdrop(page).locator(`[data-piece="${piece}"] canvas`)).toBeVisible()
    await expect(backdrop(page).locator(`[data-piece="${piece}"]`)).toHaveAttribute("data-state", "shown")
    expect((await panelColor(page))[3]).toBeGreaterThanOrEqual(240)
    await expect(page.getByText(/ascii-magic-art/)).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test("у каждой темы своя панель; у «Гавани» тёмная со светлым текстом", async ({ page }) => {
  await openPage(page)
  const colors: Record<string, number[]> = { plain: await panelColor(page) }
  for (const [label, id] of [["Пустыня", "desert"], ["Фудзи", "fuji"], ["Гавань", "harbour"]] as const) {
    await chooseTheme(page, label)
    // Wait for the colour fade to finish before sampling.
    await expect(html(page)).not.toHaveClass(/theme-transition/)
    colors[id] = await panelColor(page)
  }
  const unique = new Set(Object.values(colors).map((c) => c.slice(0, 3).join(",")))
  expect(unique.size).toBe(4)
  expect(luminance(colors.harbour)).toBeLessThan(0.2)
  expect(luminance(colors.desert)).toBeGreaterThan(0.8)
  const text = await page.locator("h1").evaluate((el) => getComputedStyle(el).color)
  expect(text).toBe("rgb(238, 236, 251)")
})

test("при смене темы содержимое не сдвигается и страница не прокручивается", async ({ page }) => {
  // A loaded report makes the page taller than the viewport, so any stray scroll would show.
  await mockReportApi(page, { body: fullReport })
  await openPage(page, "/?week=2026-11-18")
  await expect(page.getByRole("table", { name: "По автору" })).toBeVisible()
  const box = async () => {
    const [h1, field] = await Promise.all([page.locator("h1").boundingBox(), dateField(page).boundingBox()])
    return [h1!.x, h1!.y, field!.x, field!.y, field!.width].map(Math.round)
  }
  const plain = await box()

  // Regression: reopening the menu after Escape focused an item before the popup was positioned,
  // which scrolled the page to the bottom.
  // The menu mounts a frame after the click: wait for it, or Escape fires into nothing and the
  // late-opening menu is then toggled shut by the next trigger click.
  await trigger(page).click()
  await expect(page.getByRole("menu")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()
  for (const label of ["Пустыня", "Гавань", "Без фона"]) {
    await chooseTheme(page, label)
    expect(await page.evaluate(() => window.scrollY), label).toBe(0)
    expect(await box(), label).toEqual(plain)
  }
})

test("выбор сохраняется после перезагрузки и применяется до отрисовки", async ({ page }) => {
  await openPage(page)
  await chooseTheme(page, "Гавань")
  await page.reload()
  // The inline <head> script sets data-bg before React hydrates.
  expect(await page.evaluate(() => document.documentElement.dataset.bg)).toBe("harbour")
  await expect(trigger(page)).toHaveText("Гавань")
  await expect(backdrop(page).locator("canvas")).toBeVisible()
})

test("«Без фона» плавно убирает сцену и подпись", async ({ page }) => {
  await openPage(page)
  await chooseTheme(page, "Фудзи")
  await expect(backdrop(page).locator("canvas")).toBeVisible()

  await chooseTheme(page, "Без фона")
  await expect(html(page)).not.toHaveAttribute("data-bg")
  await expect(backdrop(page)).toHaveCount(0)
  await expect(page.getByText(/ascii-magic-art/)).toBeHidden()
})

test("с темой отчёт работает как обычно", async ({ page }) => {
  await mockReportApi(page, { body: fullReport })
  await openPage(page)
  await chooseTheme(page, "Гавань")
  await dateField(page).fill("2026-11-18")
  await submitButton(page).click()
  await expect(page.getByRole("table", { name: "По типу задачи" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "16–22 ноября 2026" })).toBeVisible()
})

const frame = (page: Page) =>
  backdrop(page).locator("canvas").evaluate((c: HTMLCanvasElement) => c.toDataURL())

test.describe("с анимацией", () => {
  test.use({ reducedMotion: "no-preference" })

  test("смена темы плавная: цвета перетекают, сцены сменяются наплывом", async ({ page }) => {
    await openPage(page)
    await chooseTheme(page, "Пустыня")
    await expect(backdrop(page).locator('[data-piece="desert-buttes-road"]')).toHaveAttribute("data-state", "shown")

    // The fade lasts about half a second, so record what happens instead of racing to observe it.
    await page.evaluate(() => {
      const log: string[] = ((window as unknown as { themeLog: string[] }).themeLog = [])
      new MutationObserver((records) => {
        for (const r of records) {
          const el = r.target as HTMLElement
          if (el === document.documentElement && r.attributeName === "class") {
            log.push(el.classList.contains("theme-transition") ? "fade:on" : "fade:off")
          } else if (el.dataset?.piece && el.dataset.state) {
            const layers = [...document.querySelectorAll("[data-testid=ascii-backdrop] [data-state]")]
            log.push(`${el.dataset.piece}:${el.dataset.state} (${layers.length} layers)`)
          }
        }
      }).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["class", "data-state"] })
    })

    await trigger(page).click()
    await page.getByRole("menuitemradio", { name: /^Фудзи/ }).click()

    await expect(backdrop(page).locator("[data-piece]")).toHaveCount(1)
    await expect(backdrop(page).locator('[data-piece="fuji-dawn-lake"]')).toHaveAttribute("data-state", "shown")
    await expect(html(page)).not.toHaveClass(/theme-transition/)

    const log = await page.evaluate(() => (window as unknown as { themeLog: string[] }).themeLog)
    // Colours faded for the switch, then the temporary transition class was removed.
    expect(log).toContain("fade:on")
    expect(log).toContain("fade:off")
    // The old scene started fading out while the new one was on screen: two layers at once.
    expect(log).toContain("desert-buttes-road:leaving (2 layers)")
    expect(log.some((entry) => entry.startsWith("fuji-dawn-lake:shown"))).toBe(true)

    const fade = await backdrop(page)
      .locator('[data-piece="fuji-dawn-lake"]')
      .evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(fade).toBe("0.5s")
  })

  test("анимация идёт", async ({ page }) => {
    await openPage(page)
    await chooseTheme(page, "Гавань")
    await expect(backdrop(page).locator("canvas")).toBeVisible()
    const first = await frame(page)
    await expect.poll(() => frame(page), { timeout: 5000 }).not.toBe(first)
  })
})

test.describe("prefers-reduced-motion", () => {

  test("кадр стоит, тема меняется без анимации", async ({ page }) => {
    await openPage(page)
    await chooseTheme(page, "Гавань")
    await expect(html(page)).not.toHaveClass(/theme-transition/)
    await expect(backdrop(page).locator("canvas")).toBeVisible()
    const first = await frame(page)
    await page.waitForTimeout(1500)
    expect(await frame(page)).toBe(first)
  })
})
