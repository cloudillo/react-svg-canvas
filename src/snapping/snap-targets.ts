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
import { getSnapPoints, getAABB } from './rotation-utils'

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
 * Default proximity threshold multiplier for geometric relevance.
 * Objects within this many snapThresholds on the perpendicular axis are considered relevant.
 * Set high to allow aligning objects that are far apart (common in presentations).
 */
const DEFAULT_PROXIMITY_MULTIPLIER = 200

/**
 * Check if an object is geometrically relevant for snapping on a specific axis.
 * For X-axis snapping (vertical lines), objects should overlap on the Y-axis.
 * For Y-axis snapping (horizontal lines), objects should overlap on the X-axis.
 */
function isGeometricallyRelevant(
	sourceBounds: Bounds,
	draggedBounds: RotatedBounds,
	axis: 'x' | 'y',
	proximityThreshold: number
): boolean {
	const draggedAABB = getSnapPoints(draggedBounds)

	if (axis === 'x') {
		// For X-axis (vertical alignment lines), check Y-range overlap
		const sourceTop = sourceBounds.y
		const sourceBottom = sourceBounds.y + sourceBounds.height
		const draggedTop = draggedAABB.top
		const draggedBottom = draggedAABB.bottom

		// Check if Y-ranges overlap
		const hasYOverlap = !(sourceBottom < draggedTop || sourceTop > draggedBottom)
		if (hasYOverlap) return true

		// Check proximity on Y-axis (for near misses)
		const yDistance = Math.min(
			Math.abs(sourceBottom - draggedTop),
			Math.abs(sourceTop - draggedBottom)
		)
		return yDistance <= proximityThreshold
	} else {
		// For Y-axis (horizontal alignment lines), check X-range overlap
		const sourceLeft = sourceBounds.x
		const sourceRight = sourceBounds.x + sourceBounds.width
		const draggedLeft = draggedAABB.left
		const draggedRight = draggedAABB.right

		// Check if X-ranges overlap
		const hasXOverlap = !(sourceRight < draggedLeft || sourceLeft > draggedRight)
		if (hasXOverlap) return true

		// Check proximity on X-axis (for near misses)
		const xDistance = Math.min(
			Math.abs(sourceRight - draggedLeft),
			Math.abs(sourceLeft - draggedRight)
		)
		return xDistance <= proximityThreshold
	}
}

/**
 * Generate X-axis snap targets (left, right, centerX, pivotX) from an object
 */
function generateXAxisTargets(object: SnapSpatialObject, snapPoints: ReturnType<typeof getSnapPoints>): SnapTarget[] {
	const targets: SnapTarget[] = []

	// Edge targets
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

	// Center target
	targets.push({
		type: 'center',
		axis: 'x',
		value: snapPoints.centerX,
		sourceObjectId: object.id,
		sourceEdge: 'centerX',
		priority: BASE_PRIORITIES.center
	})

	// Pivot target (if different from center)
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

	return targets
}

/**
 * Generate Y-axis snap targets (top, bottom, centerY, pivotY) from an object
 */
function generateYAxisTargets(object: SnapSpatialObject, snapPoints: ReturnType<typeof getSnapPoints>): SnapTarget[] {
	const targets: SnapTarget[] = []

	// Edge targets
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

	// Center target
	targets.push({
		type: 'center',
		axis: 'y',
		value: snapPoints.centerY,
		sourceObjectId: object.id,
		sourceEdge: 'centerY',
		priority: BASE_PRIORITIES.center
	})

	// Pivot target (if different from center)
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

	return targets
}

/**
 * Generate size targets from an object
 */
function generateSizeTargets(object: SnapSpatialObject, snapPoints: ReturnType<typeof getSnapPoints>): SnapTarget[] {
	const width = snapPoints.right - snapPoints.left
	const height = snapPoints.bottom - snapPoints.top

	return [
		{
			type: 'size',
			axis: 'x',
			value: width,
			sourceObjectId: object.id,
			priority: BASE_PRIORITIES.size
		},
		{
			type: 'size',
			axis: 'y',
			value: height,
			sourceObjectId: object.id,
			priority: BASE_PRIORITIES.size
		}
	]
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
 * Generate snap targets from all objects with geometric relevance filtering.
 * When draggedBounds is provided, only generates axis-specific targets from
 * objects that share perpendicular axis overlap with the dragged object.
 */
export function generateSnapTargets(
	objects: SnapSpatialObject[],
	excludeIds: Set<string>,
	config: SnapConfiguration,
	draggedBounds?: RotatedBounds
): SnapTarget[] {
	const targets: SnapTarget[] = []
	const proximityThreshold = config.snapThreshold * DEFAULT_PROXIMITY_MULTIPLIER

	for (const object of objects) {
		if (excludeIds.has(object.id)) {
			continue
		}

		// Get bounds and snap points for this object
		const bounds = getAABB(object)
		const rotatedBounds: RotatedBounds = {
			...object.bounds,
			rotation: object.rotation || 0,
			pivotX: object.pivotX,
			pivotY: object.pivotY
		}
		const snapPoints = getSnapPoints(rotatedBounds)

		if (config.snapToObjects) {
			// If no dragged bounds, include all targets (backwards compatibility)
			if (!draggedBounds) {
				targets.push(...generateXAxisTargets(object, snapPoints))
				targets.push(...generateYAxisTargets(object, snapPoints))
			} else {
				// Only generate X-axis targets if object overlaps on Y-axis
				if (isGeometricallyRelevant(bounds, draggedBounds, 'x', proximityThreshold)) {
					targets.push(...generateXAxisTargets(object, snapPoints))
				}
				// Only generate Y-axis targets if object overlaps on X-axis
				if (isGeometricallyRelevant(bounds, draggedBounds, 'y', proximityThreshold)) {
					targets.push(...generateYAxisTargets(object, snapPoints))
				}
			}
		}

		// NOTE: Size targets are NOT included here for drag operations.
		// Size snapping only makes sense during resize (handled by getSizeTargets() in computeResizeSnap)
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
 * Generate all snap targets based on configuration.
 * When draggedBounds is provided, geometric relevance filtering is applied
 * to reduce the number of targets from objects that don't share perpendicular axis overlap.
 */
export function generateAllSnapTargets(
	objects: SnapSpatialObject[],
	excludeIds: Set<string>,
	viewBounds: Bounds,
	config: SnapConfiguration,
	draggedBounds?: RotatedBounds
): SnapTarget[] {
	const targets: SnapTarget[] = []

	// Page boundary targets (included when snapping to objects is enabled)
	if (config.snapToObjects) {
		targets.push(...generatePageBoundaryTargets(viewBounds))
	}

	// Object-based targets (with geometric relevance filtering)
	if (config.snapToObjects || config.snapToSizes) {
		targets.push(...generateSnapTargets(objects, excludeIds, config, draggedBounds))
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

		// Use AABB for rotated objects - ensures size indicator lines
		// are drawn at the correct visual position
		const aabb = getAABB(object)

		// Store first occurrence of each unique size
		if (!widthMap.has(aabb.width)) {
			widthMap.set(aabb.width, {
				value: aabb.width,
				sourceId: object.id,
				sourceBounds: aabb
			})
		}
		if (!heightMap.has(aabb.height)) {
			heightMap.set(aabb.height, {
				value: aabb.height,
				sourceId: object.id,
				sourceBounds: aabb
			})
		}
	}

	return {
		widths: Array.from(widthMap.values()),
		heights: Array.from(heightMap.values())
	}
}

// vim: ts=4
