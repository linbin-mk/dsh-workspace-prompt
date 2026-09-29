/**
 * Test-time stand-in for `@deepseek-ai/dsh-client-ui-primitives`.
 *
 * The plugin's browser half resolves the real library from the page's shared
 * module table, which does not exist in the unit suite; the vitest config
 * aliases the package here. Only the three symbols the workspace-prompt chip
 * renders are needed: the tooltip passes its child through, and both icons are
 * inert glyphs whose shape no test asserts on.
 */

import { createElement } from 'react'
import type { ReactElement, ReactNode } from 'react'

/** Renders its anchor unchanged (the real tooltip only decorates after a gesture). */
export function Tooltip({ children }: { children: ReactNode }): ReactNode {
  return children
}

/** Inert glyph stand-in; the chip only varies which icon it picks. */
function glyph(name: string): () => ReactElement {
  // Sized like the real icons: an unsized SVG stretches to its container and
  // would make every chip-layout assertion meaningless.
  return () => createElement('svg', { 'data-glyph': name, width: 16, height: 16, viewBox: '0 0 16 16' })
}

/** Pencil glyph shown while the workspace prompt is unarmed. */
export const IconEditOutlineRegular = glyph('edit')

/** Sparkle glyph shown while the workspace prompt is armed. */
export const IconSparkleRegular = glyph('sparkle')
