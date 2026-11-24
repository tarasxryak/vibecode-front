"use client"

import { useEffect, useRef, useState } from "react"

import { useBackground } from "@/hooks/use-background"
import { BACKGROUNDS } from "@/lib/backgrounds"
import { cn } from "@/lib/utils"

/** Crossfade length; matches the duration-500 class below. */
const FADE_MS = 500
/**
 * The scene is a background behind a 96%-opaque panel, so it is drawn at 1× even on Retina
 * screens: a quarter of the pixels of the package player, which always draws at up to 2×.
 */
const DPR = 1

type Piece = typeof import("ascii-magic-art/pieces/fuji-dawn-lake.js")
type Scene = Extract<(typeof BACKGROUNDS)[number], { piece: string }>

// Static import() calls so the bundler splits each scene into its own chunk, loaded on demand.
const loaders: Record<string, () => Promise<Piece>> = {
  "desert-buttes-road": () => import("ascii-magic-art/pieces/desert-buttes-road.js"),
  "fuji-dawn-lake": () => import("ascii-magic-art/pieces/fuji-dawn-lake.js"),
  "harbour-neon-skyline": () => import("ascii-magic-art/pieces/harbour-neon-skyline.js"),
}

/**
 * Plays a piece on `canvas` in the "lines" look, sized like `background-size: cover`.
 * The same steps as the package's player (withLook + paint through a glyph atlas), with our
 * own pixel ratio. Returns a stop function.
 */
async function playScene(canvas: HTMLCanvasElement, piece: Piece, still: boolean) {
  const [{ withLook }, { paint, GlyphAtlas }] = await Promise.all([
    import("ascii-magic-art/runtime/glyphs.js"),
    import("ascii-magic-art/runtime/canvas.js"),
  ])
  const { meta } = piece
  // As the player does for square-cell pieces: true colours, plus the piece's own tone settings.
  const look: Record<string, unknown> = { look: "lines", ...meta.dots }
  if (meta.cell === "square") look.lift = false
  const draw = withLook(piece.default(), meta.palette, look)
  const ctx = canvas.getContext("2d")!
  const atlas = new GlyphAtlas()
  let cell = 0
  let width = 0
  let height = 0

  const resize = () => {
    cell = Math.max(window.innerWidth / meta.cols, window.innerHeight / meta.rows)
    width = Math.ceil(meta.cols * cell)
    height = Math.ceil(meta.rows * cell)
    canvas.width = Math.round(width * DPR)
    canvas.height = Math.round(height * DPR)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }
  const render = (t: number) => {
    const frame = draw(t)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const palette = typeof frame === "string" ? meta.palette : (frame.palette ?? meta.palette)
    paint(ctx, frame, palette, { ...look, cw: cell, ch: cell, mode: "text", ink: "#e4e4e7", atlas, dpr: DPR })
  }

  let elapsed = 0
  resize()
  render(elapsed)
  const onResize = () => {
    resize()
    render(elapsed)
  }
  window.addEventListener("resize", onResize)
  if (still) return () => window.removeEventListener("resize", onResize)

  // Advance scene time only while frames run (rAF pauses in background tabs), at the piece's fps.
  const step = 1000 / meta.fps
  let raf = 0
  let prev = 0
  let last = 0
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (prev) elapsed += (now - prev) / 1000
    prev = now
    if (now - last < step) return
    last = now - ((now - last) % step)
    render(elapsed)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener("resize", onResize)
  }
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
    const canvas = document.createElement("canvas")
    canvas.style.display = "block"
    host.append(canvas)
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    loaders[scene.piece]()
      .then((piece) => playScene(canvas, piece, still))
      .then((stopScene) => {
        if (cancelled) return stopScene()
        stop = stopScene
        // The first frame is drawn; reveal on the next frame so the fade runs.
        requestAnimationFrame(() => !cancelled && setReady(true))
      })

    return () => {
      cancelled = true
      stop?.()
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
