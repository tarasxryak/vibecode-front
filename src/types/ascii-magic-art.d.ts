// ascii-magic-art ships plain ES modules without types; only what we use is declared.
type AsciiFrame = string | { text: string; color: string; palette?: Record<string, string> }

declare module "ascii-magic-art/runtime/glyphs.js" {
  export function withLook(
    draw: (t: number) => AsciiFrame,
    palette: Record<string, string>,
    opts: Record<string, unknown>
  ): (t: number) => AsciiFrame
}

declare module "ascii-magic-art/runtime/canvas.js" {
  export class GlyphAtlas {}
  export function paint(
    ctx: CanvasRenderingContext2D,
    frame: AsciiFrame,
    palette: Record<string, string>,
    opts: Record<string, unknown> & { cw: number; ch: number; mode: string; atlas: GlyphAtlas; dpr: number }
  ): void
}

declare module "ascii-magic-art/pieces/*.js" {
  export const meta: {
    cols: number
    rows: number
    fps: number
    cell?: string
    palette: Record<string, string>
    dots?: Record<string, unknown>
  }
  const create: () => (t: number) => AsciiFrame
  export default create
}
