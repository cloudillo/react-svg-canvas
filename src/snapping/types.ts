/**
 * Types for the snapping system
 */

import type { Point, Bounds, ResizeHandle } from '../types'

// Snap target types
export type SnapType = 'edge' | 'center' | 'grid' | 'size'
export type SnapAxis = 'x' | 'y'
export type SnapEdge = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' | 'pivotX' | 'pivotY'

/**
 * Represents a potential snap destination
 */
export interface SnapTarget {
	type: SnapType
	axis: SnapAxis
	value: number
	sourceObjectId?: string
	sourceEdge?: SnapEdge
	priority: number
}

/**
 * Active snap result with guide line info
 */
export interface ActiveSnap {
	target: SnapTarget
	distance: number
	score: number
	guideStart: Point
	guideEnd: Point
	/** Bounds of the source object (for object-based snaps) */
	sourceBounds?: Bounds
	/** For size snaps: the matched size value */
	matchedSize?: number
}

/**
 * Bounds with rotation for accurate snapping
 */
export interface RotatedBounds {
	x: number
	y: number
	width: number
	height: number
	rotation: number
	pivotX?: number  // 0-1, default 0.5 (center)
	pivotY?: number  // 0-1, default 0.5 (center)
}

/**
 * Snap points extracted from bounds
 */
export interface SnapPoints {
	left: number
	right: number
	top: number
	bottom: number
	centerX: number
	centerY: number
	pivotX?: number   // Pivot point X (for pivot-to-pivot snapping)
	pivotY?: number   // Pivot point Y (for pivot-to-pivot snapping)
	corners: Point[]
}

/**
 * Breakdown of individual scoring factors
 */
export interface ScoreBreakdown {
	distance: number
	grabProximity: number
	hierarchy: number
	direction: number
	velocity: number
	typePriority: number
}

/**
 * Scored candidate for snapping with full breakdown
 */
export interface ScoredCandidate {
	target: SnapTarget
	score: number
	breakdown: ScoreBreakdown
	distance: number
	guideStart: Point
	guideEnd: Point
	dragSnapEdge: SnapEdge
}

/**
 * Context for drag snapping
 */
export interface DragSnapContext {
	draggedBounds: RotatedBounds
	draggedId: string
	grabPoint: Point              // Normalized 0-1 position where user grabbed
	movementDirection: Point      // Normalized movement vector
	velocity: number              // Pixels per frame
	delta: Point                  // Current movement delta
}

/**
 * Context for resize snapping
 */
export interface ResizeSnapContext {
	originalBounds: RotatedBounds
	currentBounds: RotatedBounds
	objectId: string
	handle: ResizeHandle
	delta: Point
}

/**
 * Result from snap computation
 */
export interface SnapResult {
	snappedPosition: Point
	activeSnaps: ActiveSnap[]
	candidates: ScoredCandidate[]
}

/**
 * Result from resize snap computation
 */
export interface ResizeSnapResult {
	snappedBounds: Bounds
	activeSnaps: ActiveSnap[]
	candidates: ScoredCandidate[]
}

/**
 * Weight configuration for scoring
 */
export interface SnapWeights {
	distance: number
	direction: number
	velocity: number
	grabProximity: number
	hierarchy: number
	edgePriority: number
	centerPriority: number
	gridPriority: number
	sizePriority: number
}

/**
 * Guide visual configuration
 */
export interface SnapGuidesConfig {
	color: string
	strokeWidth: number
	showDistanceIndicators: boolean
}

/**
 * Debug configuration
 */
export interface SnapDebugConfig {
	enabled: boolean
	showTopN: number
	showScores: boolean
	showScoreBreakdown: boolean
}

/**
 * Full snap configuration
 */
export interface SnapConfiguration {
	enabled: boolean
	snapToGrid: boolean
	snapToObjects: boolean
	snapToSizes: boolean
	gridSize: number
	snapThreshold: number
	weights: SnapWeights
	guides: SnapGuidesConfig
	debug: SnapDebugConfig
}

/**
 * Extended spatial object with hierarchy info
 */
export interface SnapSpatialObject {
	id: string
	bounds: Bounds
	rotation?: number
	pivotX?: number   // 0-1, default 0.5 (center)
	pivotY?: number   // 0-1, default 0.5 (center)
	parentId?: string
}

/**
 * Default snap configuration
 */
export const DEFAULT_SNAP_CONFIG: SnapConfiguration = {
	enabled: true,
	snapToGrid: true,
	snapToObjects: true,
	snapToSizes: true,
	gridSize: 10,
	snapThreshold: 8,
	weights: {
		distance: 10,
		direction: 3,
		velocity: 2,
		grabProximity: 5,
		hierarchy: 4,
		edgePriority: 1.2,
		centerPriority: 1.0,
		gridPriority: 0.8,
		sizePriority: 0.9
	},
	guides: {
		color: '#ff3366',
		strokeWidth: 1,
		showDistanceIndicators: true
	},
	debug: {
		enabled: false,
		showTopN: 5,
		showScores: true,
		showScoreBreakdown: false
	}
}

// vim: ts=4
