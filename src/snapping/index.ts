/**
 * Snapping module - exports all snapping functionality
 */

// Types
export * from './types'

// Geometry utilities
export * from './rotation-utils'

// Target generation
export * from './snap-targets'

// Distribution detection
export * from './distribution-detection'

// Core algorithm
export * from './snap-engine'

// React hook
export * from './useSnapping'

// Visual components
export { SnapGuides } from './SnapGuides'
export type { SnapGuidesProps } from './SnapGuides'

export { SnapDebugOverlay } from './SnapDebugOverlay'
export type { SnapDebugOverlayProps } from './SnapDebugOverlay'

// vim: ts=4
