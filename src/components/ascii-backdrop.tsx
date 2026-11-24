"use client"

import { useEffect, useRef, useState } from "react"
import type { play } from "ascii-magic-art/runtime/player.js"

import { useBackground } from "@/hooks/use-background"
import { BACKGROUNDS } from "@/lib/backgrounds"
import { cn } from "@/lib/utils"

// Every scene is a 192 x 108 grid of square cells; the player sizes a cell as 0.602 × font size.
const COLS = 192
const ROWS = 108
const CELL_W = 0.602
/** Crossfade length; matches the duration-500 class below. */
const FADE_MS = 500

type Piece = Parameters<typeof play>[1]
type Scene = Extract<(typeof BACKGROUNDS)[number], { piece: string }>

// Static import() calls so the bundler splits each scene into its own chunk, loaded on demand.
const loaders: Record<string, () => Promise<Piece>> = {
  "desert-buttes-road": () => import("ascii-magic-art/pieces/desert-buttes-road.js"),
  "fuji-dawn-lake": () => import("ascii-magic-art/pieces/fuji-dawn-lake.js"),
  "harbour-neon-skyline": () => import("ascii-magic-art/pieces/harbour-neon-skyline.js"),
}

/** Font size that makes the art cover the viewport, like `background-size: cover`. */
function coverFontSize() {
  const cell = Math.max(window.innerWidth / COLS, window.innerHeight / ROWS)
  return `${(cell / CELL_W).toFixed(2)}px`
}

/** One scene, playing on its own canvas. Fades in once its first frame is drawn. */
function SceneLayer({ scene, leaving }: { scene: Scene; leaving: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let stop: (() => void) | null = null
    let cancelled = false
    const pre = document.createElement("pre")
    pre.style.cssText = "margin:0;color:#e4e4e7"
    pre.style.fontSize = coverFontSize()
    host.append(pre)
    const onResize = () => {
      pre.style.fontSize = coverFontSize()
    }
    window.addEventListener("resize", onResize)

    Promise.all([import("ascii-magic-art/runtime/player.js"), loaders[scene.piece]()]).then(([player, mod]) => {
      if (cancelled) return
      stop = player.play(pre, mod, { look: { look: "lines" } })
      const canvas = pre.nextElementSibling as HTMLCanvasElement | null
      if (canvas) canvas.style.maxWidth = "none"
      // play() draws the first frame synchronously; reveal on the next frame so the fade runs.
      requestAnimationFrame(() => !cancelled && setReady(true))
    })

    return () => {
      cancelled = true
      stop?.()
      window.removeEventListener("resize", onResize)
      host.replaceChildren()
    }
  }, [scene.piece])

  return (
    <div
      data-piece={scene.piece}
      data-state={leaving ? "leaving" : ready ? "shown" : "loading"}
      className={cn(
        "absolute inset-0 grid place-items-center overflow-hidden transition-opacity duration-500 ease-out motion-reduce:transition-none",
        ready && !leaving ? "opacity-100" : "opacity-0"
      )}
      style={{ backgroundColor: scene.base }}
    >
      <div ref={hostRef} />
    </div>
  )
}

/**
 * The animated ASCII scene behind the page. Decorative: hidden from assistive tech.
 * Switching scenes crossfades: the new layer fades in over the old one, which then unmounts.
 */
export function AsciiBackdrop() {
  const [background] = useBackground()
  const found = BACKGROUNDS.find((bg) => bg.id === background)
  const current = found && "piece" in found ? found : null
  const [layers, setLayers] = useState<{ scene: Scene; leaving: boolean }[]>([])
  const [prevCurrent, setPrevCurrent] = useState<Scene | null>(null)

  // Derive layer changes during render when the theme changes (React's "adjust state on prop
  // change" pattern), so there is no extra effect pass and no flash of the wrong scene.
  if (current !== prevCurrent) {
    setPrevCurrent(current)
    setLayers((old) => [
      ...old.filter((l) => l.scene !== current).map((l) => ({ ...l, leaving: true })),
      ...(current ? [{ scene: current, leaving: false }] : []),
    ])
  }

  const hasLeaving = layers.some((l) => l.leaving)
  useEffect(() => {
    if (!hasLeaving) return
    const timer = window.setTimeout(() => setLayers((old) => old.filter((l) => !l.leaving)), FADE_MS + 50)
    return () => window.clearTimeout(timer)
  }, [hasLeaving, layers.length])

  if (layers.length === 0) return null
  return (
    <div
      aria-hidden
      data-testid="ascii-backdrop"
      data-piece={current?.piece ?? ""}
      className="pointer-events-none fixed inset-0 z-0"
    >
      {layers.map((layer) => (
        <SceneLayer key={layer.scene.piece} scene={layer.scene} leaving={layer.leaving} />
      ))}
    </div>
  )
}
