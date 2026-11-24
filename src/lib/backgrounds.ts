/**
 * Page themes. Art ones show a piece from ascii-magic-art (MIT) in the "lines" look behind the
 * panel; each theme also recolours the panel itself (tokens in globals.css under html[data-bg]).
 */
export const BACKGROUNDS = [
  { id: "plain", label: "Без фона", note: "Светлая страница без анимации" },
  {
    id: "desert",
    label: "Пустыня",
    note: "Дорога к красным скалам, песочная панель",
    piece: "desert-buttes-road",
    base: "#0b1220",
  },
  {
    id: "fuji",
    label: "Фудзи",
    note: "Рассвет над озером, сиреневая панель",
    piece: "fuji-dawn-lake",
    base: "#0d0f1f",
  },
  {
    id: "harbour",
    label: "Гавань",
    note: "Ночной неон над водой, тёмная панель",
    piece: "harbour-neon-skyline",
    base: "#07060f",
  },
] as const

export type BackgroundId = (typeof BACKGROUNDS)[number]["id"]

export const STORAGE_KEY = "report-background"

export function isBackgroundId(value: unknown): value is BackgroundId {
  return BACKGROUNDS.some((bg) => bg.id === value)
}

/**
 * Runs inline in <head> before first paint, so a saved theme is applied without a flash of the
 * plain page. Keep it tiny and dependency-free.
 */
export const applySavedBackgroundScript = `try{var b=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(${JSON.stringify(
  BACKGROUNDS.map((bg) => bg.id)
)}.indexOf(b)>0)document.documentElement.dataset.bg=b}catch(e){}`
