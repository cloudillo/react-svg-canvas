/**
 * Rotation module - provides rotation and pivot handling for SVG canvas
 */

// Types
export * from './types'

// Hooks
export { useRotatable } from './useRotatable'
export type { UseRotatableReturn } from './useRotatable'

export { usePivotDrag } from './usePivotDrag'
export type { UsePivotDragReturn } from './usePivotDrag'

export { useGroupPivot } from './useGroupPivot'
export type { UseGroupPivotReturn } from './useGroupPivot'

// Utilities
export {
	// Constants
	DEFAULT_SNAP_ANGLES,
	DEFAULT_SNAP_ZONE_RATIO,
	DEFAULT_PIVOT_SNAP_THRESHOLD,
	// Angle utilities
	getAngleFromCenter,
	snapAngle,
	findClosestSnapAngle,
	// Pivot utilities
	calculatePivotCompensation,
	getPivotPosition,
	canvasToPivot,
	clampPivot,
	snapPivot,
	// Rotation utilities
	rotatePointAroundCenter,
	rotateObjectAroundPivot,
	// Arc geometry
	getMaxDistanceFromPivot,
	isInSnapZone,
	getPointOnArc
} from './rotation-utils'

// vim: ts=4
