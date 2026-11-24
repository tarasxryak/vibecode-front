import { useSyncExternalStore } from "react"

import { moscowToday } from "@/lib/week"

const subscribe = () => () => {}

/** Today's date in Moscow as `YYYY-MM-DD`; null during server render and hydration. */
export function useMoscowToday(): string | null {
  return useSyncExternalStore(subscribe, () => moscowToday(), () => null)
}
