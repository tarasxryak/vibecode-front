import { useSyncExternalStore } from "react"

import { isBackgroundId, STORAGE_KEY, type BackgroundId } from "@/lib/backgrounds"

const EVENT = "report-background-change"

/** Keep in sync with the .theme-transition duration in globals.css. */
export const THEME_FADE_MS = 400
let transitionTimer = 0

function read(): BackgroundId {
  const value = document.documentElement.dataset.bg
  return isBackgroundId(value) ? value : "plain"
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

/** The page background stored on <html data-bg>; "plain" during server render. */
export function useBackground(): [BackgroundId, (next: BackgroundId) => void] {
  const value = useSyncExternalStore(subscribe, read, () => "plain" as const)
  const set = (next: BackgroundId) => {
    const root = document.documentElement
    // Fade colours for the switch only; a permanent global transition would slow every hover.
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("theme-transition")
      window.clearTimeout(transitionTimer)
      transitionTimer = window.setTimeout(() => root.classList.remove("theme-transition"), THEME_FADE_MS + 50)
    }
    if (next === "plain") delete root.dataset.bg
    else root.dataset.bg = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the choice just won't survive a reload.
    }
    window.dispatchEvent(new Event(EVENT))
  }
  return [value, set]
}
