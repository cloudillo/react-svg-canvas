/**
 * Snap target generation from objects and grid
 */

import type { Bounds } from '../types'
import type {
	SnapTarget,
	SnapConfiguration,
	SnapSpatialObject,
	RotatedBounds
} from './types'
import { getSnapPoints } from './rotation-utils'

/**
 * Base priorities for different snap types
 */
const BASE_PRIORITIES = {
	edge: 10,
	center: 8,
	grid: 5,
	size: 7
}

/**
 * Generate snap targets from a single object
 */
export function generateObjectSnapTargets(
	object: SnapSpatialObject,
	config: SnapConfiguration
): SnapTarget[] {
	const targets: SnapTarget[] = []

	const bounds: RotatedBounds = {
		...object.bounds,
		rotation: object.rotation || 0,
		pivotX: object.pivotX,
		pivotY: object.pivotY
	}

	const snapPoints = getSnapPoints(bounds)

	if (config.snapToObjects) {
		// Edge targets (X axis)
		targets.push({
			type: 'edge',
			axis: 'x',
			value: snapPoints.left,
			sourceObjectId: object.id,
			sourceEdge: 'left',
			priority: BASE_PRIORITIES.edge
		})
		targets.push({
			type: 'edge',
			axis: 'x',
			value: snapPoints.right,
			sourceObjectId: object.id,
			sourceEdge: 'right',
			priority: BASE_PRIORITIES.edge
		})

		// Edge targets (Y axis)
		targets.push({
			type: 'edge',
			axis: 'y',
			value: snapPoints.top,
			sourceObjectId: object.id,
			sourceEdge: 'top',
			priority: BASE_PRIORITIES.edge
		})
		targets.push({
			type: 'edge',
			axis: 'y',
			value: snapPoints.bottom,
			sourceObjectId: object.id,
			sourceEdge: 'bottom',
			priority: BASE_PRIORITIES.edge
		})

		// Center targets
		targets.push({
			type: 'center',
			axis: 'x',
			value: snapPoints.centerX,
			sourceObjectId: object.id,
			sourceEdge: 'centerX',
			priority: BASE_PRIORITIES.center
		})
		targets.push({
			type: 'center',
			axis: 'y',
			value: snapPoints.centerY,
			sourceObjectId: object.id,
			sourceEdge: 'centerY',
			priority: BASE_PRIORITIES.center
		})

		// Pivot targets (for pivot-to-pivot snapping)
		if (snapPoints.pivotX !== undefined && snapPoints.pivotX !== snapPoints.centerX) {
			targets.push({
				type: 'center',
				axis: 'x',
				value: snapPoints.pivotX,
				sourceObjectId: object.id,
				sourceEdge: 'pivotX',
				priority: BASE_PRIORITIES.center
			})
		}
		if (snapPoints.pivotY !== undefined && snapPoints.pivotY !== snapPoints.centerY) {
			targets.push({
				type: 'center',
				axis: 'y',
				value: snapPoints.pivotY,
				sourceObjectId: object.id,
				sourceEdge: 'pivotY',
				priority: BASE_PRIORITIES.center
			})
		}
	}

	if (config.snapToSizes) {
		// Size targets (width and height as potential snap values)
		const width = snapPoints.right - snapPoints.left
		const height = snapPoints.bottom - snapPoints.top

		targets.push({
			type: 'size',
			axis: 'x',
			value: width,
			sourceObjectId: object.id,
			priority: BASE_PRIORITIES.size
		})
		targets.push({
			type: 'size',
			axis: 'y',
			value: height,
			sourceObjectId: object.id,
			priority: BASE_PRIORITIES.size
		})
	}

	return targets
}

/**
 * Generate snap targets from all objects
 */
export function generateSnapTargets(
	objects: SnapSpatialObject[],
	excludeIds: Set<string>,
	config: SnapConfiguration
): SnapTarget[] {
	const targets: SnapTarget[] = []

	for (const object of objects) {
		if (excludeIds.has(object.id)) {
			continue
		}

		targets.push(...generateObjectSnapTargets(object, config))
	}

	return targets
}

/**
 * Generate grid snap targets within view bounds
 */
export function generateGridTargets(
	viewBounds: Bounds,
	gridSize: number
): SnapTarget[] {
	const targets: SnapTarget[] = []

	// Calculate grid range with some margin
	const margin = gridSize * 2
	const startX = Math.floor((viewBounds.x - margin) / gridSize) * gridSize
	const endX = Math.ceil((viewBounds.x + viewBounds.width + margin) / gridSize) * gridSize
	const startY = Math.floor((viewBounds.y - margin) / gridSize) * gridSize
	const endY = Math.ceil((viewBounds.y + viewBounds.height + margin) / gridSize) * gridSize

	// Vertical grid lines (X axis snapping)
	for (let x = startX; x <= endX; x += gridSize) {
		targets.push({
			type: 'grid',
			axis: 'x',
			value: x,
			priority: BASE_PRIORITIES.grid
		})
	}

	// Horizontal grid lines (Y axis snapping)
	for (let y = startY; y <= endY; y += gridSize) {
		targets.push({
			type: 'grid',
			axis: 'y',
			value: y,
			priority: BASE_PRIORITIES.grid
		})
	}

	return targets
}

/**
 * Generate snap targets from page/view boundaries
 */
export function generatePageBoundaryTargets(viewBounds: Bounds): SnapTarget[] {
	const targets: SnapTarget[] = []
	const edgePriority = BASE_PRIORITIES.edge + 2 // Higher than object edges
	const centerPriority = BASE_PRIORITIES.center + 2

	// Left edge
	targets.push({
		type: 'edge',
		axis: 'x',
		value: viewBounds.x,
		sourceEdge: 'left',
		priority: edgePriority
	})

	// Right edge
	targets.push({
		type: 'edge',
		axis: 'x',
		value: viewBounds.x + viewBounds.width,
		sourceEdge: 'right',
		priority: edgePriority
	})

	// Top edge
	targets.push({
		type: 'edge',
		axis: 'y',
		value: viewBounds.y,
		sourceEdge: 'top',
		priority: edgePriority
	})

	// Bottom edge
	targets.push({
		type: 'edge',
		axis: 'y',
		value: viewBounds.y + viewBounds.height,
		sourceEdge: 'bottom',
		priority: edgePriority
	})

	// Horizontal center line
	targets.push({
		type: 'center',
		axis: 'x',
		value: viewBounds.x + viewBounds.width / 2,
		sourceEdge: 'centerX',
		priority: centerPriority
	})

	// Vertical center line
	targets.push({
		type: 'center',
		axis: 'y',
		value: viewBounds.y + viewBounds.height / 2,
		sourceEdge: 'centerY',
		priority: centerPriority
	})

	return targets
}

/**
 * Generate all snap targets based on configuration
 */
export function generateAllSnapTargets(
	objects: SnapSpatialObject[],
	excludeIds: Set<string>,
	viewBounds: Bounds,
	config: SnapConfiguration
): SnapTarget[] {
	const targets: SnapTarget[] = []

	// Page boundary targets (included when snapping to objects is enabled)
	if (config.snapToObjects) {
		targets.push(...generatePageBoundaryTargets(viewBounds))
	}

	// Object-based targets
	if (config.snapToObjects || config.snapToSizes) {
		targets.push(...generateSnapTargets(objects, excludeIds, config))
	}

	// Grid targets
	if (config.snapToGrid) {
		targets.push(...generateGridTargets(viewBounds, config.gridSize))
	}

	return targets
}

/**
 * Size target with source object info
 */
export interface SizeTarget {
	value: number
	sourceId: string
	sourceBounds: Bounds
}

/**
 * Get size targets for resize snapping (match other object dimensions)
 */
export function getSizeTargets(
	objects: SnapSpatialObject[],
	excludeIds: Set<string>
): { widths: SizeTarget[], heights: SizeTarget[] } {
	const widthMap = new Map<number, SizeTarget>()
	const heightMap = new Map<number, SizeTarget>()

	for (const object of objects) {
		if (excludeIds.has(object.id)) {
			continue
		}

		// Store first occurrence of each unique size
		if (!widthMap.has(object.bounds.width)) {
			widthMap.set(object.bounds.width, {
				value: object.bounds.width,
				sourceId: object.id,
				sourceBounds: object.bounds
			})
		}
		if (!heightMap.has(object.bounds.height)) {
			heightMap.set(object.bounds.height, {
				value: object.bounds.height,
				sourceId: object.id,
				sourceBounds: object.bounds
			})
		}
	}

	return {
		widths: Array.from(widthMap.values()),
		heights: Array.from(heightMap.values())
	}
}

// vim: ts=4
