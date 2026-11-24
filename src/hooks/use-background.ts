import { useSyncExternalStore } from "react"

import { isBackgroundId, STORAGE_KEY, type BackgroundId } from "@/lib/backgrounds"

const EVENT = "report-background-change"

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
    if (next === "plain") delete document.documentElement.dataset.bg
    else document.documentElement.dataset.bg = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the choice just won't survive a reload.
    }
    window.dispatchEvent(new Event(EVENT))
  }
  return [value, set]
}
