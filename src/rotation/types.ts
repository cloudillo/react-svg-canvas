/**
 * Types for rotation and pivot handling
 */

import type { Bounds, Point } from '../types'

// ============================================================================
// Rotation State Types
// ============================================================================

/**
 * State during an active rotation operation
 */
export interface RotationState {
	/** Whether rotation is currently active */
	isRotating: boolean
	/** The angle (in degrees) when rotation started */
	startAngle: number
	/** The current angle (in degrees) during rotation */
	currentAngle: number
	/** Center of rotation X coordinate (canvas space) */
	centerX: number
	/** Center of rotation Y coordinate (canvas space) */
	centerY: number
	/** Whether the pointer is in the snap zone (inner 75% of arc) */
	isInSnapZone: boolean
}

/**
 * Initial/empty rotation state
 */
export const INITIAL_ROTATION_STATE: RotationState = {
	isRotating: false,
	startAngle: 0,
	currentAngle: 0,
	centerX: 0,
	centerY: 0,
	isInSnapZone: false
}

// ============================================================================
// Pivot State Types
// ============================================================================

/**
 * State during pivot point drag operation (single object)
 */
export interface PivotState {
	/** Whether pivot is currently being dragged */
	isDragging: boolean
	/** Current pivot X (0-1 normalized within object bounds) */
	pivotX: number
	/** Current pivot Y (0-1 normalized within object bounds) */
	pivotY: number
	/** If snapped, the snapped point coordinates (normalized) */
	snappedPoint: Point | null
	/** Initial pivot at drag start (for rendering rotated position) */
	initialPivot: Point | null
}

/**
 * Initial/empty pivot state
 */
export const INITIAL_PIVOT_STATE: PivotState = {
	isDragging: false,
	pivotX: 0.5,
	pivotY: 0.5,
	snappedPoint: null,
	initialPivot: null
}

/**
 * Default snap points for pivot (9 points: center, corners, edge midpoints)
 */
export const DEFAULT_PIVOT_SNAP_POINTS: Point[] = [
	{ x: 0.5, y: 0.5 },   // center
	{ x: 0, y: 0 },       // top-left
	{ x: 1, y: 0 },       // top-right
	{ x: 0, y: 1 },       // bottom-left
	{ x: 1, y: 1 },       // bottom-right
	{ x: 0.5, y: 0 },     // top-center
	{ x: 0.5, y: 1 },     // bottom-center
	{ x: 0, y: 0.5 },     // left-center
	{ x: 1, y: 0.5 }      // right-center
]

// ============================================================================
// Group Pivot State Types (for multi-select)
// ============================================================================

/**
 * State during group pivot drag operation (multi-select)
 */
export interface GroupPivotState {
	/** Whether group pivot is currently being dragged */
	isDragging: boolean
	/** Group pivot X coordinate (canvas space, not normalized) */
	pivotX: number
	/** Group pivot Y coordinate (canvas space, not normalized) */
	pivotY: number
	/** Whether user has explicitly moved the pivot from default center */
	isPivotCustom: boolean
}

/**
 * Initial/empty group pivot state
 */
export const INITIAL_GROUP_PIVOT_STATE: GroupPivotState = {
	isDragging: false,
	pivotX: 0,
	pivotY: 0,
	isPivotCustom: false
}

// ============================================================================
// Hook Options Types
// ============================================================================

/**
 * Options for useRotatable hook
 */
export interface RotatableOptions {
	/** Bounding box of the object(s) being rotated (canvas coordinates) */
	bounds: Bounds
	/** Current rotation in degrees */
	rotation: number
	/**
	 * Override the arc radius in screen pixels.
	 * When screenSpaceSnapZone is true, this value is used directly for snap detection
	 * instead of converting from canvas coordinates.
	 * This ensures the snap zone matches the visual RotationHandle exactly.
	 */
	screenArcRadius?: number
	/** Pivot X (0-1 normalized), default 0.5 */
	pivotX?: number
	/** Pivot Y (0-1 normalized), default 0.5 */
	pivotY?: number
	/** Custom snap angles in degrees, default: 15° intervals */
	snapAngles?: number[]
	/** Snap zone ratio (0-1), portion of arc radius where snapping activates, default 0.75 */
	snapZoneRatio?: number
	/**
	 * Coordinate transform function (screen → canvas).
	 * If provided, this will be used instead of getScreenCTM().
	 * Pass this from SvgCanvas context: `(x, y) => ctx.translateTo(x, y)`
	 */
	translateTo?: (screenX: number, screenY: number) => [number, number]
	/**
	 * Coordinate transform function (canvas → screen).
	 * Required when screenSpaceSnapZone is true.
	 * Pass this from SvgCanvas context: `(x, y) => ctx.translateFrom(x, y)`
	 */
	translateFrom?: (canvasX: number, canvasY: number) => [number, number]
	/**
	 * When true, calculate snap zone in screen space instead of canvas space.
	 * This provides consistent UX at all zoom levels since the visual RotationHandle
	 * renders in the fixed layer (screen space).
	 */
	screenSpaceSnapZone?: boolean
	/**
	 * Optional getter for fresh rotation value at drag start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * If provided, this is called at drag start and its return value is used
	 * instead of the `rotation` prop.
	 */
	getRotation?: () => number
	/**
	 * Optional getter for fresh bounds at drag start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * If provided, this is called at drag start and its return value is used
	 * instead of the `bounds` prop.
	 */
	getBounds?: () => Bounds
	/**
	 * Optional getter for fresh pivot at drag start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * Returns { x: pivotX, y: pivotY } in normalized coordinates (0-1).
	 */
	getPivot?: () => Point
	/** Called when rotation starts */
	onRotateStart?: (angle: number) => void
	/** Called during rotation with current angle and snap state */
	onRotate?: (angle: number, isSnapped: boolean) => void
	/** Called when rotation ends with final angle */
	onRotateEnd?: (angle: number) => void
	/** Disable rotation interaction */
	disabled?: boolean
}

/**
 * Options for usePivotDrag hook (single object)
 */
export interface PivotDragOptions {
	/** Bounding box of the object (canvas coordinates) */
	bounds: Bounds
	/** Current rotation in degrees */
	rotation: number
	/** Current pivot X (0-1 normalized) */
	pivotX: number
	/** Current pivot Y (0-1 normalized) */
	pivotY: number
	/** Snap points (normalized coordinates), default: 9 standard points */
	snapPoints?: Point[]
	/** Snap threshold in normalized units, default: 0.08 */
	snapThreshold?: number
	/**
	 * Coordinate transform function (screen → canvas).
	 * If provided, this will be used instead of getScreenCTM().
	 * Pass this from SvgCanvas context: `(x, y) => ctx.translateTo(x, y)`
	 */
	translateTo?: (screenX: number, screenY: number) => [number, number]
	/**
	 * Optional getter for fresh bounds at drag start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * If provided, this is called at drag start and its return value is used
	 * instead of the `bounds` prop.
	 */
	getBounds?: () => Bounds
	/**
	 * Optional getter for fresh rotation at drag start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * If provided, this is called at drag start and its return value is used
	 * instead of the `rotation` prop.
	 */
	getRotation?: () => number
	/**
	 * Optional getter for fresh pivot at drag start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * Returns { x: pivotX, y: pivotY } in normalized coordinates (0-1).
	 */
	getPivot?: () => Point
	/**
	 * Called immediately on pointer down, before any movement is detected.
	 * Use this to set flags that prevent other handlers from running
	 * (e.g., preventing canvas click from clearing selection).
	 */
	onPointerDown?: () => void
	/** Called when pivot drag starts (after movement exceeds threshold) */
	onDragStart?: (pivot: Point) => void
	/** Called during pivot drag with current pivot and snap state */
	onDrag?: (pivot: Point, snappedPoint: Point | null, positionCompensation: Point) => void
	/** Called when pivot drag ends with final pivot */
	onDragEnd?: (pivot: Point, positionCompensation: Point) => void
	/** Disable pivot drag interaction */
	disabled?: boolean
}

/**
 * Object bounds with rotation for group pivot operations
 */
export interface RotatedObjectBounds {
	id: string
	bounds: Bounds
	rotation: number
	pivotX?: number
	pivotY?: number
}

/**
 * Transformed object after group rotation
 */
export interface TransformedObject {
	id: string
	x: number
	y: number
	rotation: number
}

/**
 * Options for useGroupPivot hook (multi-select)
 */
export interface GroupPivotOptions {
	/** Array of selected objects with their bounds and rotation */
	objects: RotatedObjectBounds[]
	/** Selection bounding box (union of all selected objects) */
	selectionBounds: Bounds
	/** Called when group pivot drag starts */
	onDragStart?: (pivot: Point) => void
	/** Called during group pivot drag */
	onDrag?: (pivot: Point) => void
	/** Called when group pivot drag ends */
	onDragEnd?: (pivot: Point) => void
	/** Called during group rotation with transformed objects */
	onRotate?: (angle: number, transformedObjects: TransformedObject[]) => void
	/** Disable interaction */
	disabled?: boolean
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Rotation event data
 */
export interface RotationEvent {
	/** Current angle in degrees */
	angle: number
	/** Delta from start angle */
	deltaAngle: number
	/** Whether currently snapped to a snap angle */
	isSnapped: boolean
	/** Center of rotation */
	center: Point
}

/**
 * Pivot drag event data
 */
export interface PivotDragEvent {
	/** Current pivot (normalized) */
	pivot: Point
	/** Snapped point if any */
	snappedPoint: Point | null
	/** Position compensation to keep object visually in place */
	positionCompensation: Point
}

// vim: ts=4
