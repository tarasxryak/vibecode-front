// ascii-magic-art ships plain ES modules without types; only what we use is declared.
declare module "ascii-magic-art/runtime/player.js" {
  type Piece = { meta: Record<string, unknown>; default: (...args: unknown[]) => unknown }
  export function play(
    pre: HTMLPreElement,
    mod: Piece,
    opts?: { look?: { look?: string }; still?: boolean; speed?: number; maxFps?: number; t0?: number }
  ): () => void
}

declare module "ascii-magic-art/pieces/*.js" {
  export const meta: Record<string, unknown>
  const create: (...args: unknown[]) => unknown
  export default create
}
