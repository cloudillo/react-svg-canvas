/**
 * Core snapping algorithm with sophisticated scoring
 */

import type { Point, Bounds, ResizeHandle } from '../types'
import type {
	SnapTarget,
	SnapConfiguration,
	SnapSpatialObject,
	RotatedBounds,
	SnapPoints,
	SnapEdge,
	ScoreBreakdown,
	ScoredCandidate,
	ActiveSnap,
	DragSnapContext,
	ResizeSnapContext,
	SnapResult,
	ResizeSnapResult
} from './types'
import { getSnapPoints, getAABB } from './rotation-utils'
import { generateAllSnapTargets, getSizeTargets } from './snap-targets'

/**
 * Get grab proximity weight for a snap edge based on where user grabbed the object
 */
export function getGrabProximityWeight(grabPoint: Point, snapEdge: SnapEdge): number {
	const edgeWeights: Record<SnapEdge, number> = {
		left: 1 - grabPoint.x,
		right: grabPoint.x,
		top: 1 - grabPoint.y,
		bottom: grabPoint.y,
		centerX: 1 - Math.abs(grabPoint.x - 0.5) * 2,
		centerY: 1 - Math.abs(grabPoint.y - 0.5) * 2,
		// Pivot proximity similar to center (assumes pivot is roughly central)
		pivotX: 1 - Math.abs(grabPoint.x - 0.5) * 2,
		pivotY: 1 - Math.abs(grabPoint.y - 0.5) * 2
	}

	return edgeWeights[snapEdge]
}

/**
 * Get ancestor chain for hierarchy calculation
 */
function getAncestorChain(
	id: string,
	getParent: (id: string) => string | undefined
): string[] {
	const chain: string[] = []
	let current = getParent(id)

	while (current) {
		chain.push(current)
		current = getParent(current)
	}

	return chain
}

/**
 * Compute hierarchy weight between dragged object and snap target source
 */
export function getHierarchyWeight(
	draggedId: string,
	targetSourceId: string | undefined,
	getParent?: (id: string) => string | undefined
): number {
	// Grid targets have no source object
	if (!targetSourceId || !getParent) {
		return 0.5
	}

	const draggedAncestors = getAncestorChain(draggedId, getParent)
	const targetAncestors = getAncestorChain(targetSourceId, getParent)

	// Same object (shouldn't happen but handle it)
	if (draggedId === targetSourceId) {
		return 0
	}

	// Check immediate parent
	const draggedParent = draggedAncestors[0]
	const targetParent = targetAncestors[0]

	if (draggedParent && draggedParent === targetParent) {
		// Same immediate parent (same group)
		return 1.0
	}

	// Check if they share an ancestor
	for (let i = 0; i < draggedAncestors.length; i++) {
		const ancestor = draggedAncestors[i]
		const targetIndex = targetAncestors.indexOf(ancestor)

		if (targetIndex >= 0) {
			// Shared ancestor found - weight by depth
			const depth = Math.max(i, targetIndex)
			return Math.max(0.3, 1.0 - depth * 0.2)
		}
	}

	// Different hierarchy trees
	return 0.2
}

/**
 * Get direction weight based on movement direction and snap target position
 */
export function getDirectionWeight(
	movementDirection: Point,
	currentValue: number,
	targetValue: number,
	axis: 'x' | 'y'
): number {
	const movementComponent = axis === 'x' ? movementDirection.x : movementDirection.y
	const targetDirection = Math.sign(targetValue - currentValue)

	// If moving in the direction of the target, boost the score
	const dot = movementComponent * targetDirection

	return Math.max(0, 0.5 + dot * 0.5)
}

/**
 * Get velocity weight - slower movement = more snapping
 */
export function getVelocityWeight(velocity: number, maxVelocity: number = 20): number {
	return 1 - Math.min(velocity / maxVelocity, 1)
}

/**
 * Get type priority weight
 */
export function getTypePriorityWeight(
	target: SnapTarget,
	config: SnapConfiguration
): number {
	const { weights } = config

	switch (target.type) {
		case 'edge':
			return weights.edgePriority
		case 'center':
			return weights.centerPriority
		case 'grid':
			return weights.gridPriority
		case 'size':
			return weights.sizePriority
		default:
			return 1.0
	}
}

/**
 * Map drag snap edge to target source edge for grab proximity calculation
 */
function getDragSnapEdgeForTarget(target: SnapTarget, axis: 'x' | 'y'): SnapEdge {
	if (target.sourceEdge) {
		return target.sourceEdge
	}

	// For grid targets, use the axis
	return axis === 'x' ? 'left' : 'top'
}

/**
 * Compute score for a single snap candidate
 */
export function computeScore(
	target: SnapTarget,
	distance: number,
	dragSnapEdge: SnapEdge,
	context: DragSnapContext,
	config: SnapConfiguration,
	getParent?: (id: string) => string | undefined
): { score: number; breakdown: ScoreBreakdown } {
	const { weights, snapThreshold } = config

	// Distance score: closer = higher (inverse relationship)
	// Using axis-separated distance
	const distanceScore = Math.max(0, (snapThreshold - distance) / snapThreshold)

	// Grab proximity score
	const grabProximityScore = getGrabProximityWeight(context.grabPoint, dragSnapEdge)

	// Hierarchy score
	const hierarchyScore = getHierarchyWeight(
		context.draggedId,
		target.sourceObjectId,
		getParent
	)

	// Direction score
	const currentValue = target.axis === 'x'
		? context.draggedBounds.x + context.draggedBounds.width / 2
		: context.draggedBounds.y + context.draggedBounds.height / 2
	const directionScore = getDirectionWeight(
		context.movementDirection,
		currentValue,
		target.value,
		target.axis
	)

	// Velocity score
	const velocityScore = getVelocityWeight(context.velocity)

	// Type priority
	const typePriorityScore = getTypePriorityWeight(target, config)

	// Combine scores
	const breakdown: ScoreBreakdown = {
		distance: distanceScore,
		grabProximity: grabProximityScore,
		hierarchy: hierarchyScore,
		direction: directionScore,
		velocity: velocityScore,
		typePriority: typePriorityScore
	}

	// Weighted combination
	const score =
		distanceScore * weights.distance +
		grabProximityScore * weights.grabProximity +
		hierarchyScore * weights.hierarchy +
		directionScore * weights.direction +
		velocityScore * weights.velocity +
		typePriorityScore * target.priority

	return { score, breakdown }
}

/**
 * Create guide line endpoints for a snap
 * For object-based snaps, line spans from dragged object to source object
 * For grid snaps, line extends across the view
 */
function createGuideEndpoints(
	target: SnapTarget,
	draggedSnapPoints: SnapPoints,
	viewBounds: Bounds,
	sourceBounds?: Bounds
): { guideStart: Point; guideEnd: Point } {
	if (target.axis === 'x') {
		// Vertical guide line
		if (sourceBounds && target.sourceObjectId) {
			// Object-based snap: line spans between dragged and source objects
			const draggedTop = draggedSnapPoints.top
			const draggedBottom = draggedSnapPoints.bottom
			const sourceTop = sourceBounds.y
			const sourceBottom = sourceBounds.y + sourceBounds.height

			// Span from the closest edges of both objects
			const minY = Math.min(draggedTop, sourceTop)
			const maxY = Math.max(draggedBottom, sourceBottom)

			return {
				guideStart: { x: target.value, y: minY },
				guideEnd: { x: target.value, y: maxY }
			}
		} else {
			// Grid snap: extend across view
			return {
				guideStart: { x: target.value, y: viewBounds.y },
				guideEnd: { x: target.value, y: viewBounds.y + viewBounds.height }
			}
		}
	} else {
		// Horizontal guide line
		if (sourceBounds && target.sourceObjectId) {
			// Object-based snap: line spans between dragged and source objects
			const draggedLeft = draggedSnapPoints.left
			const draggedRight = draggedSnapPoints.right
			const sourceLeft = sourceBounds.x
			const sourceRight = sourceBounds.x + sourceBounds.width

			// Span from the closest edges of both objects
			const minX = Math.min(draggedLeft, sourceLeft)
			const maxX = Math.max(draggedRight, sourceRight)

			return {
				guideStart: { x: minX, y: target.value },
				guideEnd: { x: maxX, y: target.value }
			}
		} else {
			// Grid snap: extend across view
			return {
				guideStart: { x: viewBounds.x, y: target.value },
				guideEnd: { x: viewBounds.x + viewBounds.width, y: target.value }
			}
		}
	}
}

/**
 * Get the relevant snap values from dragged bounds for a target axis
 */
function getDragSnapValuesForAxis(
	snapPoints: SnapPoints,
	axis: 'x' | 'y'
): { value: number; edge: SnapEdge }[] {
	if (axis === 'x') {
		const values = [
			{ value: snapPoints.left, edge: 'left' as SnapEdge },
			{ value: snapPoints.right, edge: 'right' as SnapEdge },
			{ value: snapPoints.centerX, edge: 'centerX' as SnapEdge }
		]
		// Add pivot if different from center
		if (snapPoints.pivotX !== undefined && snapPoints.pivotX !== snapPoints.centerX) {
			values.push({ value: snapPoints.pivotX, edge: 'pivotX' as SnapEdge })
		}
		return values
	} else {
		const values = [
			{ value: snapPoints.top, edge: 'top' as SnapEdge },
			{ value: snapPoints.bottom, edge: 'bottom' as SnapEdge },
			{ value: snapPoints.centerY, edge: 'centerY' as SnapEdge }
		]
		// Add pivot if different from center
		if (snapPoints.pivotY !== undefined && snapPoints.pivotY !== snapPoints.centerY) {
			values.push({ value: snapPoints.pivotY, edge: 'pivotY' as SnapEdge })
		}
		return values
	}
}

/**
 * Main snap computation for drag operations
 */
export function computeSnap(
	context: DragSnapContext,
	objects: SnapSpatialObject[],
	viewBounds: Bounds,
	config: SnapConfiguration,
	getParent?: (id: string) => string | undefined
): SnapResult {
	if (!config.enabled) {
		return {
			snappedPosition: { x: context.draggedBounds.x, y: context.draggedBounds.y },
			activeSnaps: [],
			candidates: []
		}
	}

	// Create lookup map for object AABB (axis-aligned bounding box) by ID
	// This takes rotation into account for proper bounding box highlighting
	const objectBoundsMap = new Map<string, Bounds>()
	for (const obj of objects) {
		objectBoundsMap.set(obj.id, getAABB(obj))
	}

	// Generate all snap targets
	const excludeIds = new Set([context.draggedId])
	const targets = generateAllSnapTargets(objects, excludeIds, viewBounds, config)

	// Get snap points from dragged bounds
	const draggedSnapPoints = getSnapPoints(context.draggedBounds)

	// Score all candidates
	const candidatesX: ScoredCandidate[] = []
	const candidatesY: ScoredCandidate[] = []

	for (const target of targets) {
		const dragSnapValues = getDragSnapValuesForAxis(draggedSnapPoints, target.axis)

		for (const { value: dragValue, edge: dragEdge } of dragSnapValues) {
			// Axis-separated distance
			const distance = Math.abs(dragValue - target.value)

			if (distance <= config.snapThreshold) {
				const { score, breakdown } = computeScore(
					target,
					distance,
					dragEdge,
					context,
					config,
					getParent
				)

				// Get source object bounds for guide endpoints
				const sourceBounds = target.sourceObjectId
					? objectBoundsMap.get(target.sourceObjectId)
					: undefined

				const { guideStart, guideEnd } = createGuideEndpoints(
					target,
					draggedSnapPoints,
					viewBounds,
					sourceBounds
				)

				const candidate: ScoredCandidate = {
					target,
					score,
					breakdown,
					distance,
					guideStart,
					guideEnd,
					dragSnapEdge: dragEdge
				}

				if (target.axis === 'x') {
					candidatesX.push(candidate)
				} else {
					candidatesY.push(candidate)
				}
			}
		}
	}

	// Sort by score (descending)
	candidatesX.sort((a, b) => b.score - a.score)
	candidatesY.sort((a, b) => b.score - a.score)

	// Select best snap for each axis
	const bestX = candidatesX[0]
	const bestY = candidatesY[0]

	// Compute snapped position
	let snappedX = context.draggedBounds.x
	let snappedY = context.draggedBounds.y

	const activeSnaps: ActiveSnap[] = []

	if (bestX) {
		// Calculate the offset needed to snap
		const dragSnapPoints = getSnapPoints(context.draggedBounds)
		const currentDragValue = getDragSnapValuesForAxis(dragSnapPoints, 'x')
			.find(v => v.edge === bestX.dragSnapEdge)?.value || dragSnapPoints.left

		const snapOffset = bestX.target.value - currentDragValue
		snappedX = context.draggedBounds.x + snapOffset

		// Get source bounds for the active snap
		const sourceBounds = bestX.target.sourceObjectId
			? objectBoundsMap.get(bestX.target.sourceObjectId)
			: undefined

		activeSnaps.push({
			target: bestX.target,
			distance: bestX.distance,
			score: bestX.score,
			guideStart: bestX.guideStart,
			guideEnd: bestX.guideEnd,
			sourceBounds
		})
	}

	if (bestY) {
		const dragSnapPoints = getSnapPoints(context.draggedBounds)
		const currentDragValue = getDragSnapValuesForAxis(dragSnapPoints, 'y')
			.find(v => v.edge === bestY.dragSnapEdge)?.value || dragSnapPoints.top

		const snapOffset = bestY.target.value - currentDragValue
		snappedY = context.draggedBounds.y + snapOffset

		// Get source bounds for the active snap
		const sourceBounds = bestY.target.sourceObjectId
			? objectBoundsMap.get(bestY.target.sourceObjectId)
			: undefined

		activeSnaps.push({
			target: bestY.target,
			distance: bestY.distance,
			score: bestY.score,
			guideStart: bestY.guideStart,
			guideEnd: bestY.guideEnd,
			sourceBounds
		})
	}

	// Combine all candidates for debug
	const allCandidates = [...candidatesX, ...candidatesY]
	allCandidates.sort((a, b) => b.score - a.score)

	return {
		snappedPosition: { x: snappedX, y: snappedY },
		activeSnaps,
		candidates: allCandidates
	}
}

/**
 * Compute snapping for resize operations
 */
export function computeResizeSnap(
	context: ResizeSnapContext,
	objects: SnapSpatialObject[],
	viewBounds: Bounds,
	config: SnapConfiguration,
	getParent?: (id: string) => string | undefined
): ResizeSnapResult {
	if (!config.enabled) {
		return {
			snappedBounds: context.currentBounds,
			activeSnaps: [],
			candidates: []
		}
	}

	// Create lookup map for object AABB (axis-aligned bounding box) by ID
	// This takes rotation into account for proper bounding box highlighting
	const objectBoundsMap = new Map<string, Bounds>()
	for (const obj of objects) {
		objectBoundsMap.set(obj.id, getAABB(obj))
	}

	const excludeIds = new Set([context.objectId])
	const targets = generateAllSnapTargets(objects, excludeIds, viewBounds, config)

	// For resize, we snap the edges being resized
	const currentSnapPoints = getSnapPoints(context.currentBounds)

	// Determine which edges are being resized based on handle
	const resizingEdges = getResizingEdges(context.handle)

	const candidates: ScoredCandidate[] = []
	const activeSnaps: ActiveSnap[] = []

	let snappedBounds: Bounds = {
		x: context.currentBounds.x,
		y: context.currentBounds.y,
		width: context.currentBounds.width,
		height: context.currentBounds.height
	}

	for (const edgeInfo of resizingEdges) {
		const { edge, axis } = edgeInfo
		const currentValue = currentSnapPoints[edge]

		// Skip if edge value is undefined (e.g., pivot edges during resize)
		if (currentValue === undefined) continue

		// Find matching targets
		const matchingTargets = targets.filter(t =>
			t.axis === axis &&
			Math.abs(t.value - currentValue) <= config.snapThreshold
		)

		if (matchingTargets.length > 0) {
			// Score and select best
			let bestTarget: SnapTarget | null = null
			let bestScore = -Infinity
			let bestDistance = Infinity

			for (const target of matchingTargets) {
				const distance = Math.abs(target.value - currentValue)
				// Simplified scoring for resize
				const score = (config.snapThreshold - distance) / config.snapThreshold *
					getTypePriorityWeight(target, config)

				if (score > bestScore) {
					bestScore = score
					bestTarget = target
					bestDistance = distance
				}
			}

			if (bestTarget) {
				const snapOffset = bestTarget.value - currentValue

				// Apply snap to bounds
				snappedBounds = applyEdgeSnap(snappedBounds, edge, snapOffset)

				// Get source object bounds
				const sourceBounds = bestTarget.sourceObjectId
					? objectBoundsMap.get(bestTarget.sourceObjectId)
					: undefined

				const { guideStart, guideEnd } = createGuideEndpoints(
					bestTarget,
					currentSnapPoints,
					viewBounds,
					sourceBounds
				)

				activeSnaps.push({
					target: bestTarget,
					distance: bestDistance,
					score: bestScore,
					guideStart,
					guideEnd,
					sourceBounds
				})
			}
		}
	}

	// Also snap to size targets if enabled
	if (config.snapToSizes) {
		const sizeTargets = getSizeTargets(objects, excludeIds)
		const currentWidth = snappedBounds.width
		const currentHeight = snappedBounds.height

		// Width snapping
		if (resizingEdges.some(e => e.edge === 'left' || e.edge === 'right')) {
			for (const sizeTarget of sizeTargets.widths) {
				if (Math.abs(currentWidth - sizeTarget.value) <= config.snapThreshold) {
					const widthDiff = sizeTarget.value - currentWidth

					// Adjust based on which edge is being resized
					if (resizingEdges.some(e => e.edge === 'right')) {
						snappedBounds.width = sizeTarget.value
					} else if (resizingEdges.some(e => e.edge === 'left')) {
						snappedBounds.x -= widthDiff
						snappedBounds.width = sizeTarget.value
					}

					// Calculate guide line on the source object (where size comes from)
					// Position indicator just above the source object
					const sourceIndicatorY = sizeTarget.sourceBounds.y - 15

					activeSnaps.push({
						target: {
							type: 'size',
							axis: 'x',
							value: sizeTarget.value,
							sourceObjectId: sizeTarget.sourceId,
							priority: 1
						},
						distance: Math.abs(currentWidth - sizeTarget.value),
						score: 1,
						// Line on source object showing the matched width
						guideStart: { x: sizeTarget.sourceBounds.x, y: sourceIndicatorY },
						guideEnd: { x: sizeTarget.sourceBounds.x + sizeTarget.value, y: sourceIndicatorY },
						sourceBounds: sizeTarget.sourceBounds,
						matchedSize: sizeTarget.value
					})

					// Also add indicator on the resized object
					activeSnaps.push({
						target: {
							type: 'size',
							axis: 'x',
							value: sizeTarget.value,
							priority: 1
						},
						distance: Math.abs(currentWidth - sizeTarget.value),
						score: 1,
						guideStart: { x: snappedBounds.x, y: snappedBounds.y - 15 },
						guideEnd: { x: snappedBounds.x + sizeTarget.value, y: snappedBounds.y - 15 },
						matchedSize: sizeTarget.value
					})
					break
				}
			}
		}

		// Height snapping
		if (resizingEdges.some(e => e.edge === 'top' || e.edge === 'bottom')) {
			for (const sizeTarget of sizeTargets.heights) {
				if (Math.abs(currentHeight - sizeTarget.value) <= config.snapThreshold) {
					const heightDiff = sizeTarget.value - currentHeight

					if (resizingEdges.some(e => e.edge === 'bottom')) {
						snappedBounds.height = sizeTarget.value
					} else if (resizingEdges.some(e => e.edge === 'top')) {
						snappedBounds.y -= heightDiff
						snappedBounds.height = sizeTarget.value
					}

					// Calculate guide line on the source object (where size comes from)
					// Position indicator just left of the source object
					const sourceIndicatorX = sizeTarget.sourceBounds.x - 15

					activeSnaps.push({
						target: {
							type: 'size',
							axis: 'y',
							value: sizeTarget.value,
							sourceObjectId: sizeTarget.sourceId,
							priority: 1
						},
						distance: Math.abs(currentHeight - sizeTarget.value),
						score: 1,
						// Line on source object showing the matched height
						guideStart: { x: sourceIndicatorX, y: sizeTarget.sourceBounds.y },
						guideEnd: { x: sourceIndicatorX, y: sizeTarget.sourceBounds.y + sizeTarget.value },
						sourceBounds: sizeTarget.sourceBounds,
						matchedSize: sizeTarget.value
					})

					// Also add indicator on the resized object
					activeSnaps.push({
						target: {
							type: 'size',
							axis: 'y',
							value: sizeTarget.value,
							priority: 1
						},
						distance: Math.abs(currentHeight - sizeTarget.value),
						score: 1,
						guideStart: { x: snappedBounds.x - 15, y: snappedBounds.y },
						guideEnd: { x: snappedBounds.x - 15, y: snappedBounds.y + sizeTarget.value },
						matchedSize: sizeTarget.value
					})
					break
				}
			}
		}
	}

	return {
		snappedBounds,
		activeSnaps,
		candidates
	}
}

/**
 * Get which edges are being resized based on handle
 */
function getResizingEdges(handle: ResizeHandle): { edge: SnapEdge; axis: 'x' | 'y' }[] {
	const edges: { edge: SnapEdge; axis: 'x' | 'y' }[] = []

	switch (handle) {
		case 'n':
			edges.push({ edge: 'top', axis: 'y' })
			break
		case 's':
			edges.push({ edge: 'bottom', axis: 'y' })
			break
		case 'e':
			edges.push({ edge: 'right', axis: 'x' })
			break
		case 'w':
			edges.push({ edge: 'left', axis: 'x' })
			break
		case 'nw':
			edges.push({ edge: 'top', axis: 'y' }, { edge: 'left', axis: 'x' })
			break
		case 'ne':
			edges.push({ edge: 'top', axis: 'y' }, { edge: 'right', axis: 'x' })
			break
		case 'sw':
			edges.push({ edge: 'bottom', axis: 'y' }, { edge: 'left', axis: 'x' })
			break
		case 'se':
			edges.push({ edge: 'bottom', axis: 'y' }, { edge: 'right', axis: 'x' })
			break
	}

	return edges
}

/**
 * Apply snap offset to a specific edge of bounds
 */
function applyEdgeSnap(bounds: Bounds, edge: SnapEdge, offset: number): Bounds {
	const result = { ...bounds }

	switch (edge) {
		case 'left':
			result.x += offset
			result.width -= offset
			break
		case 'right':
			result.width += offset
			break
		case 'top':
			result.y += offset
			result.height -= offset
			break
		case 'bottom':
			result.height += offset
			break
	}

	return result
}

// vim: ts=4
