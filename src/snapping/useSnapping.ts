/**
 * React hook for snapping functionality
 */

import * as React from 'react'
import type { Point, Bounds, ResizeHandle } from '../types'
import type {
	SnapConfiguration,
	SnapSpatialObject,
	RotatedBounds,
	ActiveSnap,
	ScoredCandidate,
	DEFAULT_SNAP_CONFIG
} from './types'
import { computeSnap, computeResizeSnap } from './snap-engine'
import { computeGrabPoint } from './rotation-utils'

export interface UseSnappingOptions {
	objects: SnapSpatialObject[]
	config: SnapConfiguration
	viewBounds: Bounds
	getParent?: (id: string) => string | undefined
}

export interface SnapDragParams {
	bounds: RotatedBounds
	objectId: string
	delta: Point
	grabPoint: Point
	excludeIds?: Set<string>
}

export interface SnapResizeParams {
	originalBounds: RotatedBounds
	currentBounds: RotatedBounds
	objectId: string
	handle: ResizeHandle
	delta: Point
	excludeIds?: Set<string>
}

export interface UseSnappingReturn {
	snapDrag: (params: SnapDragParams) => {
		position: Point
		activeSnaps: ActiveSnap[]
		candidates: ScoredCandidate[]
	}
	snapResize: (params: SnapResizeParams) => {
		bounds: Bounds
		activeSnaps: ActiveSnap[]
		candidates: ScoredCandidate[]
	}
	activeSnaps: ActiveSnap[]
	allCandidates: ScoredCandidate[]
	clearSnaps: () => void
}

/**
 * Calculate velocity from recent positions
 */
function calculateVelocity(positions: Point[], timeWindow: number = 100): number {
	if (positions.length < 2) return 0

	const recent = positions.slice(-5)
	if (recent.length < 2) return 0

	let totalDistance = 0
	for (let i = 1; i < recent.length; i++) {
		const dx = recent[i].x - recent[i - 1].x
		const dy = recent[i].y - recent[i - 1].y
		totalDistance += Math.sqrt(dx * dx + dy * dy)
	}

	return totalDistance / recent.length
}

/**
 * Calculate normalized movement direction from delta
 */
function normalizeDirection(delta: Point): Point {
	const length = Math.sqrt(delta.x * delta.x + delta.y * delta.y)
	if (length === 0) {
		return { x: 0, y: 0 }
	}
	return {
		x: delta.x / length,
		y: delta.y / length
	}
}

/**
 * Hook for snapping during drag and resize operations
 */
export function useSnapping(options: UseSnappingOptions): UseSnappingReturn {
	const { objects, config, viewBounds, getParent } = options

	// State for active snaps and candidates
	const [activeSnaps, setActiveSnaps] = React.useState<ActiveSnap[]>([])
	const [allCandidates, setAllCandidates] = React.useState<ScoredCandidate[]>([])

	// Track recent positions for velocity calculation
	const recentPositions = React.useRef<Point[]>([])

	// Memoize objects for stable comparison
	const objectsRef = React.useRef(objects)
	objectsRef.current = objects

	const snapDrag = React.useCallback((params: SnapDragParams) => {
		const { bounds, objectId, delta, grabPoint, excludeIds } = params

		// Update position history for velocity
		recentPositions.current.push({ x: bounds.x, y: bounds.y })
		if (recentPositions.current.length > 10) {
			recentPositions.current.shift()
		}

		const velocity = calculateVelocity(recentPositions.current)
		const movementDirection = normalizeDirection(delta)

		const context = {
			draggedBounds: bounds,
			draggedId: objectId,
			grabPoint,
			movementDirection,
			velocity,
			delta
		}

		const finalExcludeIds = excludeIds || new Set([objectId])

		const result = computeSnap(
			context,
			objectsRef.current,
			viewBounds,
			config,
			getParent
		)

		setActiveSnaps(result.activeSnaps)
		setAllCandidates(result.candidates)

		return {
			position: result.snappedPosition,
			activeSnaps: result.activeSnaps,
			candidates: result.candidates
		}
	}, [config, viewBounds, getParent])

	const snapResize = React.useCallback((params: SnapResizeParams) => {
		const {
			originalBounds,
			currentBounds,
			objectId,
			handle,
			delta,
			excludeIds
		} = params

		const context = {
			originalBounds,
			currentBounds,
			objectId,
			handle,
			delta
		}

		const result = computeResizeSnap(
			context,
			objectsRef.current,
			viewBounds,
			config,
			getParent
		)

		setActiveSnaps(result.activeSnaps)
		setAllCandidates(result.candidates)

		return {
			bounds: result.snappedBounds,
			activeSnaps: result.activeSnaps,
			candidates: result.candidates
		}
	}, [config, viewBounds, getParent])

	const clearSnaps = React.useCallback(() => {
		setActiveSnaps([])
		setAllCandidates([])
		recentPositions.current = []
	}, [])

	return {
		snapDrag,
		snapResize,
		activeSnaps,
		allCandidates,
		clearSnaps
	}
}

/**
 * Helper hook to compute grab point from mouse position
 */
export function useGrabPoint() {
	const grabPointRef = React.useRef<Point>({ x: 0.5, y: 0.5 })

	const setGrabPoint = React.useCallback((mousePos: Point, bounds: RotatedBounds) => {
		grabPointRef.current = computeGrabPoint(mousePos, bounds)
	}, [])

	const getGrabPoint = React.useCallback(() => {
		return grabPointRef.current
	}, [])

	return { setGrabPoint, getGrabPoint }
}

// vim: ts=4
