"use client"

import { useEffect, useRef } from "react"

import type { play } from "ascii-magic-art/runtime/player.js"

import { useBackground } from "@/hooks/use-background"
import { BACKGROUNDS } from "@/lib/backgrounds"

// Every scene is a 192 x 108 grid of square cells; the player sizes a cell as 0.602 × font size.
const COLS = 192
const ROWS = 108
const CELL_W = 0.602

/** Font size that makes the art cover the viewport, like `background-size: cover`. */
function coverFontSize() {
  const cell = Math.max(window.innerWidth / COLS, window.innerHeight / ROWS)
  return `${(cell / CELL_W).toFixed(2)}px`
}

type Piece = Parameters<typeof play>[1]

// Static import() calls so the bundler splits each scene into its own chunk, loaded on demand.
const loaders: Record<string, () => Promise<Piece>> = {
  "desert-buttes-road": () => import("ascii-magic-art/pieces/desert-buttes-road.js"),
  "fuji-dawn-lake": () => import("ascii-magic-art/pieces/fuji-dawn-lake.js"),
  "harbour-neon-skyline": () => import("ascii-magic-art/pieces/harbour-neon-skyline.js"),
}

/** The animated ASCII scene behind the page. Decorative: hidden from assistive tech. */
export function AsciiBackdrop() {
  const [background] = useBackground()
  const hostRef = useRef<HTMLDivElement>(null)
  const found = BACKGROUNDS.find((bg) => bg.id === background)
  const scene = found && "piece" in found ? found : null
  const piece = scene?.piece ?? null

  useEffect(() => {
    const host = hostRef.current
    if (!host || !piece) return
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

    Promise.all([import("ascii-magic-art/runtime/player.js"), loaders[piece]()]).then(([{ play }, mod]) => {
      if (cancelled) return
      stop = play(pre, mod, { look: { look: "lines" } })
      const canvas = pre.nextElementSibling as HTMLCanvasElement | null
      if (canvas) canvas.style.maxWidth = "none"
    })

    return () => {
      cancelled = true
      stop?.()
      window.removeEventListener("resize", onResize)
      host.replaceChildren()
    }
  }, [piece])

  if (!scene) return null
  return (
    <div
      aria-hidden
      data-testid="ascii-backdrop"
      data-piece={piece}
      className="pointer-events-none fixed inset-0 z-0 grid place-items-center overflow-hidden"
      style={{ backgroundColor: scene.base }}
    >
      <div ref={hostRef} />
    </div>
  )
}
