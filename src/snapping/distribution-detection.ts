/**
 * Distribution snap detection for equal-spacing patterns
 * Detects row, column, and staircase arrangements
 */

import type { Point, Bounds } from '../types'
import type {
	SnapSpatialObject,
	RotatedBounds,
	DistributionSnapInfo,
	DistributionGap,
	DistributionPattern,
	ActiveSnap,
	SnapTarget,
	SnapConfiguration
} from './types'
import { getSnapPoints, getAABB } from './rotation-utils'

/**
 * Candidate for distribution snapping
 */
export interface DistributionCandidate {
	/** Snapped position for the dragged object */
	position: Point
	/** Distribution pattern info */
	info: DistributionSnapInfo
	/** How far the object moved to snap */
	distance: number
	/** Score for prioritization */
	score: number
}

/**
 * Object with computed bounds for distribution detection
 */
interface ObjectWithBounds {
	id: string
	bounds: Bounds
	centerX: number
	centerY: number
	left: number
	right: number
	top: number
	bottom: number
}

/**
 * Convert SnapSpatialObject to ObjectWithBounds
 */
function toObjectWithBounds(obj: SnapSpatialObject): ObjectWithBounds {
	const aabb = getAABB(obj)
	return {
		id: obj.id,
		bounds: aabb,
		centerX: aabb.x + aabb.width / 2,
		centerY: aabb.y + aabb.height / 2,
		left: aabb.x,
		right: aabb.x + aabb.width,
		top: aabb.y,
		bottom: aabb.y + aabb.height
	}
}

/**
 * Convert RotatedBounds to ObjectWithBounds
 */
function draggedToBounds(bounds: RotatedBounds, id: string): ObjectWithBounds {
	const snapPoints = getSnapPoints(bounds)
	return {
		id,
		bounds: {
			x: snapPoints.left,
			y: snapPoints.top,
			width: snapPoints.right - snapPoints.left,
			height: snapPoints.bottom - snapPoints.top
		},
		centerX: snapPoints.centerX,
		centerY: snapPoints.centerY,
		left: snapPoints.left,
		right: snapPoints.right,
		top: snapPoints.top,
		bottom: snapPoints.bottom
	}
}

/**
 * Check if two ranges overlap
 */
function rangesOverlap(
	a1: number, a2: number,
	b1: number, b2: number,
	tolerance: number = 0
): boolean {
	return !(a2 + tolerance < b1 || b2 + tolerance < a1)
}

/**
 * Calculate gap between two objects on X axis
 */
function gapX(left: ObjectWithBounds, right: ObjectWithBounds): number {
	return right.left - left.right
}

/**
 * Calculate gap between two objects on Y axis
 */
function gapY(top: ObjectWithBounds, bottom: ObjectWithBounds): number {
	return bottom.top - top.bottom
}

/**
 * Check if all values in array are approximately equal
 */
function areValuesEqual(values: number[], tolerance: number): boolean {
	if (values.length < 2) return true
	const avg = values.reduce((a, b) => a + b, 0) / values.length
	return values.every(v => Math.abs(v - avg) <= tolerance)
}

/**
 * Find the most common gap value that appears at least twice.
 * Returns the gap value and indices of gaps that match it.
 */
function findEqualGaps(gaps: number[], tolerance: number): { value: number, indices: number[] } | null {
	if (gaps.length < 2) return null

	// Group gaps by similarity
	const groups: { value: number, indices: number[] }[] = []

	for (let i = 0; i < gaps.length; i++) {
		const gap = gaps[i]
		// Skip negative gaps (overlapping objects)
		if (gap < 0) continue

		// Find existing group this gap belongs to
		let foundGroup = false
		for (const group of groups) {
			if (Math.abs(gap - group.value) <= tolerance) {
				group.indices.push(i)
				// Update group value to average
				group.value = group.indices.reduce((sum, idx) => sum + gaps[idx], 0) / group.indices.length
				foundGroup = true
				break
			}
		}

		if (!foundGroup) {
			groups.push({ value: gap, indices: [i] })
		}
	}

	// Find largest group with at least 2 gaps
	const validGroups = groups.filter(g => g.indices.length >= 2)
	if (validGroups.length === 0) return null

	// Return the group with the most gaps (or first if tied)
	validGroups.sort((a, b) => b.indices.length - a.indices.length)
	return validGroups[0]
}

/**
 * Get average of values
 */
function average(values: number[]): number {
	if (values.length === 0) return 0
	return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Tolerance for gap equality check (handles rounding errors)
 */
const GAP_TOLERANCE = 1 // 1px tolerance for rounding errors

/**
 * Create gap indicators for row distribution
 * Only includes gaps that match the target spacing (within rounding tolerance)
 */
function createRowGaps(
	sortedObjects: ObjectWithBounds[],
	targetSpacing: number
): DistributionGap[] {
	const gaps: DistributionGap[] = []

	for (let i = 0; i < sortedObjects.length - 1; i++) {
		const left = sortedObjects[i]
		const right = sortedObjects[i + 1]

		// Compute ACTUAL gap distance for this pair
		const actualGap = right.left - left.right

		// Only include gaps that match target spacing (within rounding tolerance)
		if (Math.abs(actualGap - targetSpacing) > GAP_TOLERANCE) {
			continue
		}

		// Gap line at vertical center between the two objects
		const centerY = (left.centerY + right.centerY) / 2

		gaps.push({
			start: { x: left.right, y: centerY },
			end: { x: right.left, y: centerY },
			distance: actualGap,
			axis: 'x'
		})
	}

	return gaps
}

/**
 * Create gap indicators for column distribution
 * Only includes gaps that match the target spacing (within rounding tolerance)
 */
function createColumnGaps(
	sortedObjects: ObjectWithBounds[],
	targetSpacing: number
): DistributionGap[] {
	const gaps: DistributionGap[] = []

	for (let i = 0; i < sortedObjects.length - 1; i++) {
		const top = sortedObjects[i]
		const bottom = sortedObjects[i + 1]

		// Compute ACTUAL gap distance for this pair
		const actualGap = bottom.top - top.bottom

		// Only include gaps that match target spacing (within rounding tolerance)
		if (Math.abs(actualGap - targetSpacing) > GAP_TOLERANCE) {
			continue
		}

		// Gap line at horizontal center between the two objects
		const centerX = (top.centerX + bottom.centerX) / 2

		gaps.push({
			start: { x: centerX, y: top.bottom },
			end: { x: centerX, y: bottom.top },
			distance: actualGap,
			axis: 'y'
		})
	}

	return gaps
}

/**
 * Create gap indicators for staircase distribution
 */
function createStaircaseGaps(
	sortedObjects: ObjectWithBounds[],
	deltaX: number,
	deltaY: number
): DistributionGap[] {
	const gaps: DistributionGap[] = []

	for (let i = 0; i < sortedObjects.length - 1; i++) {
		const current = sortedObjects[i]
		const next = sortedObjects[i + 1]

		// For staircase, show both X and Y gaps
		// X gap (horizontal component)
		if (Math.abs(deltaX) > 1) {
			const midY = (current.centerY + next.centerY) / 2
			gaps.push({
				start: { x: current.right, y: midY },
				end: { x: next.left, y: midY },
				distance: Math.abs(next.left - current.right),
				axis: 'x'
			})
		}

		// Y gap (vertical component)
		if (Math.abs(deltaY) > 1) {
			const midX = (current.centerX + next.centerX) / 2
			gaps.push({
				start: { x: midX, y: current.bottom },
				end: { x: midX, y: next.top },
				distance: Math.abs(next.top - current.bottom),
				axis: 'y'
			})
		}
	}

	return gaps
}

/**
 * Detect row distribution pattern (horizontal equal spacing)
 */
export function detectRowDistribution(
	dragged: ObjectWithBounds,
	objects: ObjectWithBounds[],
	threshold: number,
	minObjects: number = 2
): DistributionCandidate | null {
	// Filter objects with overlapping Y-range
	const rowCandidates = objects.filter(obj =>
		rangesOverlap(dragged.top, dragged.bottom, obj.top, obj.bottom, threshold * 2)
	)

	if (rowCandidates.length < minObjects) return null

	// Sort by X position
	const sorted = [...rowCandidates].sort((a, b) => a.centerX - b.centerX)

	// Calculate gaps between consecutive objects
	const gaps: number[] = []
	for (let i = 0; i < sorted.length - 1; i++) {
		gaps.push(gapX(sorted[i], sorted[i + 1]))
	}

	// Need at least one gap for before/after checks, but between-objects works with any 2 objects
	if (gaps.length === 0 && sorted.length < 2) return null

	// Find groups of equal gaps (need at least 2 equal gaps for extending pattern)
	const equalGaps = findEqualGaps(gaps, threshold)

	// Check: between objects FIRST - this works even without existing equal gaps
	// It creates equal spacing between immediate neighbors
	const draggedWidth = dragged.right - dragged.left
	for (let i = 0; i < sorted.length - 1; i++) {
		const left = sorted[i]
		const right = sorted[i + 1]
		const currentGap = gapX(left, right)

		// Skip if gap can't fit the dragged object
		if (currentGap < draggedWidth) continue

		// Calculate what the equal gap would be if dragged is inserted here
		const insertionGap = (currentGap - draggedWidth) / 2

		// Skip if target gap would be negative or too small
		if (insertionGap < 0) continue

		// Calculate ideal position for the dragged object
		const newX = left.right + insertionGap
		const betweenDist = Math.abs(dragged.left - newX)

		if (betweenDist <= threshold) {
			// Only include the 3 objects involved in this insertion
			const threeObjects = [
				left,
				{ ...dragged, left: newX, right: newX + draggedWidth, centerX: newX + draggedWidth / 2 },
				right
			]

			return {
				position: { x: newX, y: dragged.bounds.y },
				info: {
					pattern: 'row',
					objectIds: threeObjects.map(o => o.id),
					spacing: insertionGap,
					gaps: createRowGaps(threeObjects, insertionGap)
				},
				distance: betweenDist,
				score: calculateDistributionScore(threeObjects.length, betweenDist, threshold)
			}
		}
	}

	// Check if the gap being created by dragged matches ANY existing gap
	// This works even without a pre-existing equal pattern
	const sortedWithDragged = [...sorted, dragged].sort((a, b) => a.centerX - b.centerX)
	const draggedIndex = sortedWithDragged.findIndex(o => o.id === dragged.id)

	// Get the current gaps adjacent to dragged
	const leftNeighbor = draggedIndex > 0 ? sortedWithDragged[draggedIndex - 1] : null
	const rightNeighbor = draggedIndex < sortedWithDragged.length - 1 ? sortedWithDragged[draggedIndex + 1] : null

	const currentLeftGap = leftNeighbor ? gapX(leftNeighbor, dragged) : null
	const currentRightGap = rightNeighbor ? gapX(dragged, rightNeighbor) : null

	// Check each existing gap (with its source objects) to see if dragged's gap nearly matches it
	for (let gapIndex = 0; gapIndex < gaps.length; gapIndex++) {
		const existingGap = gaps[gapIndex]
		if (existingGap < 0) continue // Skip negative gaps

		// The objects that form this existing gap
		const gapLeftObj = sorted[gapIndex]
		const gapRightObj = sorted[gapIndex + 1]

		// Check left gap - can we snap to match this existing gap?
		if (currentLeftGap !== null && leftNeighbor) {
			const gapDiff = Math.abs(currentLeftGap - existingGap)
			if (gapDiff <= threshold && gapDiff > 0) {
				// Snap to create exactly this gap
				const idealX = leftNeighbor.right + existingGap
				const snapDistance = Math.abs(dragged.left - idealX)

				const snappedDragged = {
					...dragged,
					left: idealX,
					right: idealX + draggedWidth,
					centerX: idealX + draggedWidth / 2
				}

				// Create gaps showing BOTH the new gap and the matching gap
				const allGaps: DistributionGap[] = []

				// The gap being created (dragged with its neighbor)
				const newGapCenterY = (leftNeighbor.centerY + snappedDragged.centerY) / 2
				allGaps.push({
					start: { x: leftNeighbor.right, y: newGapCenterY },
					end: { x: snappedDragged.left, y: newGapCenterY },
					distance: existingGap,
					axis: 'x'
				})

				// The existing gap it's matching (if different objects)
				if (gapLeftObj.id !== leftNeighbor.id || gapRightObj.id !== dragged.id) {
					const matchGapCenterY = (gapLeftObj.centerY + gapRightObj.centerY) / 2
					allGaps.push({
						start: { x: gapLeftObj.right, y: matchGapCenterY },
						end: { x: gapRightObj.left, y: matchGapCenterY },
						distance: existingGap,
						axis: 'x'
					})
				}

				return {
					position: { x: idealX, y: dragged.bounds.y },
					info: {
						pattern: 'row',
						objectIds: [leftNeighbor.id, dragged.id, gapLeftObj.id, gapRightObj.id],
						spacing: existingGap,
						gaps: allGaps
					},
					distance: snapDistance,
					score: calculateDistributionScore(2, snapDistance, threshold)
				}
			}
		}

		// Check right gap - can we snap to match this existing gap?
		if (currentRightGap !== null && rightNeighbor) {
			const gapDiff = Math.abs(currentRightGap - existingGap)
			if (gapDiff <= threshold && gapDiff > 0) {
				// Snap to create exactly this gap
				const idealX = rightNeighbor.left - existingGap - draggedWidth
				const snapDistance = Math.abs(dragged.left - idealX)

				const snappedDragged = {
					...dragged,
					left: idealX,
					right: idealX + draggedWidth,
					centerX: idealX + draggedWidth / 2
				}

				// Create gaps showing BOTH the new gap and the matching gap
				const allGaps: DistributionGap[] = []

				// The gap being created (dragged with its neighbor)
				const newGapCenterY = (snappedDragged.centerY + rightNeighbor.centerY) / 2
				allGaps.push({
					start: { x: snappedDragged.right, y: newGapCenterY },
					end: { x: rightNeighbor.left, y: newGapCenterY },
					distance: existingGap,
					axis: 'x'
				})

				// The existing gap it's matching (if different objects)
				if (gapLeftObj.id !== dragged.id || gapRightObj.id !== rightNeighbor.id) {
					const matchGapCenterY = (gapLeftObj.centerY + gapRightObj.centerY) / 2
					allGaps.push({
						start: { x: gapLeftObj.right, y: matchGapCenterY },
						end: { x: gapRightObj.left, y: matchGapCenterY },
						distance: existingGap,
						axis: 'x'
					})
				}

				return {
					position: { x: idealX, y: dragged.bounds.y },
					info: {
						pattern: 'row',
						objectIds: [dragged.id, rightNeighbor.id, gapLeftObj.id, gapRightObj.id],
						spacing: existingGap,
						gaps: allGaps
					},
					distance: snapDistance,
					score: calculateDistributionScore(2, snapDistance, threshold)
				}
			}
		}
	}

	return null
}

/**
 * Detect column distribution pattern (vertical equal spacing)
 */
export function detectColumnDistribution(
	dragged: ObjectWithBounds,
	objects: ObjectWithBounds[],
	threshold: number,
	minObjects: number = 2
): DistributionCandidate | null {
	// Filter objects with overlapping X-range
	const columnCandidates = objects.filter(obj =>
		rangesOverlap(dragged.left, dragged.right, obj.left, obj.right, threshold * 2)
	)

	if (columnCandidates.length < minObjects) return null

	// Sort by Y position
	const sorted = [...columnCandidates].sort((a, b) => a.centerY - b.centerY)

	// Calculate gaps between consecutive objects
	const gaps: number[] = []
	for (let i = 0; i < sorted.length - 1; i++) {
		gaps.push(gapY(sorted[i], sorted[i + 1]))
	}

	// Need at least one gap for before/after checks, but between-objects works with any 2 objects
	if (gaps.length === 0 && sorted.length < 2) return null

	// Find groups of equal gaps (need at least 2 equal gaps for extending pattern)
	const equalGaps = findEqualGaps(gaps, threshold)

	// Check: between objects FIRST - this works even without existing equal gaps
	// It creates equal spacing between immediate neighbors
	const draggedHeight = dragged.bottom - dragged.top
	for (let i = 0; i < sorted.length - 1; i++) {
		const top = sorted[i]
		const bottom = sorted[i + 1]
		const currentGap = gapY(top, bottom)

		// Skip if gap can't fit the dragged object
		if (currentGap < draggedHeight) continue

		// Calculate what the equal gap would be if dragged is inserted here
		const insertionGap = (currentGap - draggedHeight) / 2

		// Skip if target gap would be negative or too small
		if (insertionGap < 0) continue

		// Calculate ideal position for the dragged object
		const newY = top.bottom + insertionGap
		const betweenDist = Math.abs(dragged.top - newY)

		if (betweenDist <= threshold) {
			// Only include the 3 objects involved in this insertion
			const threeObjects = [
				top,
				{ ...dragged, top: newY, bottom: newY + draggedHeight, centerY: newY + draggedHeight / 2 },
				bottom
			]

			return {
				position: { x: dragged.bounds.x, y: newY },
				info: {
					pattern: 'column',
					objectIds: threeObjects.map(o => o.id),
					spacing: insertionGap,
					gaps: createColumnGaps(threeObjects, insertionGap)
				},
				distance: betweenDist,
				score: calculateDistributionScore(threeObjects.length, betweenDist, threshold)
			}
		}
	}

	// Check if the gap being created by dragged matches ANY existing gap
	// This works even without a pre-existing equal pattern
	const sortedWithDragged = [...sorted, dragged].sort((a, b) => a.centerY - b.centerY)
	const draggedIndex = sortedWithDragged.findIndex(o => o.id === dragged.id)

	// Get the current gaps adjacent to dragged
	const topNeighbor = draggedIndex > 0 ? sortedWithDragged[draggedIndex - 1] : null
	const bottomNeighbor = draggedIndex < sortedWithDragged.length - 1 ? sortedWithDragged[draggedIndex + 1] : null

	const currentTopGap = topNeighbor ? gapY(topNeighbor, dragged) : null
	const currentBottomGap = bottomNeighbor ? gapY(dragged, bottomNeighbor) : null

	// Check each existing gap (with its source objects) to see if dragged's gap nearly matches it
	for (let gapIndex = 0; gapIndex < gaps.length; gapIndex++) {
		const existingGap = gaps[gapIndex]
		if (existingGap < 0) continue // Skip negative gaps

		// The objects that form this existing gap
		const gapTopObj = sorted[gapIndex]
		const gapBottomObj = sorted[gapIndex + 1]

		// Check top gap - can we snap to match this existing gap?
		if (currentTopGap !== null && topNeighbor) {
			const gapDiff = Math.abs(currentTopGap - existingGap)
			if (gapDiff <= threshold && gapDiff > 0) {
				// Snap to create exactly this gap
				const idealY = topNeighbor.bottom + existingGap
				const snapDistance = Math.abs(dragged.top - idealY)

				const snappedDragged = {
					...dragged,
					top: idealY,
					bottom: idealY + draggedHeight,
					centerY: idealY + draggedHeight / 2
				}

				// Create gaps showing BOTH the new gap and the matching gap
				const allGaps: DistributionGap[] = []

				// The gap being created (dragged with its neighbor)
				const newGapCenterX = (topNeighbor.centerX + snappedDragged.centerX) / 2
				allGaps.push({
					start: { x: newGapCenterX, y: topNeighbor.bottom },
					end: { x: newGapCenterX, y: snappedDragged.top },
					distance: existingGap,
					axis: 'y'
				})

				// The existing gap it's matching (if different objects)
				if (gapTopObj.id !== topNeighbor.id || gapBottomObj.id !== dragged.id) {
					const matchGapCenterX = (gapTopObj.centerX + gapBottomObj.centerX) / 2
					allGaps.push({
						start: { x: matchGapCenterX, y: gapTopObj.bottom },
						end: { x: matchGapCenterX, y: gapBottomObj.top },
						distance: existingGap,
						axis: 'y'
					})
				}

				return {
					position: { x: dragged.bounds.x, y: idealY },
					info: {
						pattern: 'column',
						objectIds: [topNeighbor.id, dragged.id, gapTopObj.id, gapBottomObj.id],
						spacing: existingGap,
						gaps: allGaps
					},
					distance: snapDistance,
					score: calculateDistributionScore(2, snapDistance, threshold)
				}
			}
		}

		// Check bottom gap - can we snap to match this existing gap?
		if (currentBottomGap !== null && bottomNeighbor) {
			const gapDiff = Math.abs(currentBottomGap - existingGap)
			if (gapDiff <= threshold && gapDiff > 0) {
				// Snap to create exactly this gap
				const idealY = bottomNeighbor.top - existingGap - draggedHeight
				const snapDistance = Math.abs(dragged.top - idealY)

				const snappedDragged = {
					...dragged,
					top: idealY,
					bottom: idealY + draggedHeight,
					centerY: idealY + draggedHeight / 2
				}

				// Create gaps showing BOTH the new gap and the matching gap
				const allGaps: DistributionGap[] = []

				// The gap being created (dragged with its neighbor)
				const newGapCenterX = (snappedDragged.centerX + bottomNeighbor.centerX) / 2
				allGaps.push({
					start: { x: newGapCenterX, y: snappedDragged.bottom },
					end: { x: newGapCenterX, y: bottomNeighbor.top },
					distance: existingGap,
					axis: 'y'
				})

				// The existing gap it's matching (if different objects)
				if (gapTopObj.id !== dragged.id || gapBottomObj.id !== bottomNeighbor.id) {
					const matchGapCenterX = (gapTopObj.centerX + gapBottomObj.centerX) / 2
					allGaps.push({
						start: { x: matchGapCenterX, y: gapTopObj.bottom },
						end: { x: matchGapCenterX, y: gapBottomObj.top },
						distance: existingGap,
						axis: 'y'
					})
				}

				return {
					position: { x: dragged.bounds.x, y: idealY },
					info: {
						pattern: 'column',
						objectIds: [dragged.id, bottomNeighbor.id, gapTopObj.id, gapBottomObj.id],
						spacing: existingGap,
						gaps: allGaps
					},
					distance: snapDistance,
					score: calculateDistributionScore(2, snapDistance, threshold)
				}
			}
		}
	}

	return null
}

/**
 * Detect staircase distribution pattern (diagonal equal spacing)
 */
export function detectStaircaseDistribution(
	dragged: ObjectWithBounds,
	objects: ObjectWithBounds[],
	threshold: number,
	minObjects: number = 2
): DistributionCandidate | null {
	if (objects.length < minObjects) return null

	// Sort objects by X position to find diagonal patterns
	const sorted = [...objects].sort((a, b) => a.centerX - b.centerX)

	// Calculate deltas between consecutive objects
	const deltaXs: number[] = []
	const deltaYs: number[] = []
	for (let i = 0; i < sorted.length - 1; i++) {
		deltaXs.push(sorted[i + 1].centerX - sorted[i].centerX)
		deltaYs.push(sorted[i + 1].centerY - sorted[i].centerY)
	}

	if (deltaXs.length === 0) return null

	// Check if deltas are consistent (forming a staircase)
	const avgDeltaX = average(deltaXs)
	const avgDeltaY = average(deltaYs)

	// Need significant movement in both directions for staircase
	if (Math.abs(avgDeltaX) < threshold || Math.abs(avgDeltaY) < threshold) {
		return null
	}

	// Check consistency
	const deltasConsistent =
		areValuesEqual(deltaXs, threshold) &&
		areValuesEqual(deltaYs, threshold)

	if (!deltasConsistent) return null

	// Try positions for dragged object
	// Use a larger threshold for staircase since it's a 2D snap
	const staircaseThreshold = threshold * 1.5

	// Before first
	const beforeX = sorted[0].centerX - avgDeltaX
	const beforeY = sorted[0].centerY - avgDeltaY
	const draggedCenterX = dragged.centerX
	const draggedCenterY = dragged.centerY

	// Calculate diagonal distance to target position
	const beforeDistCenterX = draggedCenterX - beforeX
	const beforeDistCenterY = draggedCenterY - beforeY
	const beforeDist = Math.sqrt(beforeDistCenterX * beforeDistCenterX + beforeDistCenterY * beforeDistCenterY)

	if (beforeDist <= staircaseThreshold) {
		const newX = beforeX - dragged.bounds.width / 2
		const newY = beforeY - dragged.bounds.height / 2
		const newDragged = {
			...dragged,
			left: newX,
			right: newX + dragged.bounds.width,
			top: newY,
			bottom: newY + dragged.bounds.height,
			centerX: beforeX,
			centerY: beforeY
		}
		const allObjects = [newDragged, ...sorted]

		return {
			position: { x: newX, y: newY },
			info: {
				pattern: 'staircase',
				objectIds: allObjects.map(o => o.id),
				spacing: Math.sqrt(avgDeltaX * avgDeltaX + avgDeltaY * avgDeltaY),
				gaps: createStaircaseGaps(allObjects, avgDeltaX, avgDeltaY)
			},
			distance: beforeDist,
			score: calculateDistributionScore(allObjects.length, beforeDist, threshold)
		}
	}

	// After last
	const afterX = sorted[sorted.length - 1].centerX + avgDeltaX
	const afterY = sorted[sorted.length - 1].centerY + avgDeltaY

	// Calculate diagonal distance to target position
	const afterDistCenterX = draggedCenterX - afterX
	const afterDistCenterY = draggedCenterY - afterY
	const afterDist = Math.sqrt(afterDistCenterX * afterDistCenterX + afterDistCenterY * afterDistCenterY)

	if (afterDist <= staircaseThreshold) {
		const newX = afterX - dragged.bounds.width / 2
		const newY = afterY - dragged.bounds.height / 2

		const newDragged = {
			...dragged,
			left: newX,
			right: newX + dragged.bounds.width,
			top: newY,
			bottom: newY + dragged.bounds.height,
			centerX: afterX,
			centerY: afterY
		}
		const allObjects = [...sorted, newDragged]

		return {
			position: { x: newX, y: newY },
			info: {
				pattern: 'staircase',
				objectIds: allObjects.map(o => o.id),
				spacing: Math.sqrt(avgDeltaX * avgDeltaX + avgDeltaY * avgDeltaY),
				gaps: createStaircaseGaps(allObjects, avgDeltaX, avgDeltaY)
			},
			distance: afterDist,
			score: calculateDistributionScore(allObjects.length, afterDist, threshold)
		}
	}

	return null
}

/**
 * Calculate distribution score (higher = better)
 * More objects and closer distance = higher score
 */
function calculateDistributionScore(
	objectCount: number,
	distance: number,
	threshold: number
): number {
	const distanceScore = Math.max(0, (threshold - distance) / threshold)
	const countBonus = Math.min(objectCount / 5, 1) // Bonus for more objects, capped at 5
	return distanceScore * (1 + countBonus * 0.5)
}

/**
 * Main distribution detection function
 * Detects all distribution patterns and returns the best candidates
 */
export function detectDistribution(
	draggedBounds: RotatedBounds,
	draggedId: string,
	objects: SnapSpatialObject[],
	excludeIds: Set<string>,
	config: SnapConfiguration
): DistributionCandidate[] {
	if (!config.snapToDistribution) {
		return []
	}

	const threshold = config.snapThreshold

	// Convert to ObjectWithBounds
	const dragged = draggedToBounds(draggedBounds, draggedId)
	const otherObjects = objects
		.filter(obj => !excludeIds.has(obj.id))
		.map(toObjectWithBounds)

	// Need at least 2 other objects for distribution
	if (otherObjects.length < 2) {
		return []
	}

	const candidates: DistributionCandidate[] = []

	// Detect row distribution
	const rowCandidate = detectRowDistribution(dragged, otherObjects, threshold)
	if (rowCandidate) {
		candidates.push(rowCandidate)
	}

	// Detect column distribution
	const columnCandidate = detectColumnDistribution(dragged, otherObjects, threshold)
	if (columnCandidate) {
		candidates.push(columnCandidate)
	}

	// Detect staircase distribution
	const staircaseCandidate = detectStaircaseDistribution(dragged, otherObjects, threshold)
	if (staircaseCandidate) {
		candidates.push(staircaseCandidate)
	}

	// Sort by score (descending)
	candidates.sort((a, b) => b.score - a.score)

	return candidates
}

/**
 * Convert distribution candidate to ActiveSnap for rendering
 */
export function distributionToActiveSnap(
	candidate: DistributionCandidate,
	config: SnapConfiguration
): ActiveSnap {
	const { position, info, distance, score } = candidate

	// Create a distribution snap target
	const target: SnapTarget = {
		type: 'distribution',
		axis: info.pattern === 'column' ? 'y' : 'x',
		value: info.pattern === 'column' ? position.y : position.x,
		priority: config.weights.distributionPriority
	}

	// Guide lines span across the pattern
	// Use first and last gap endpoints
	const firstGap = info.gaps[0]
	const lastGap = info.gaps[info.gaps.length - 1]

	return {
		target,
		distance,
		score,
		guideStart: firstGap?.start ?? position,
		guideEnd: lastGap?.end ?? position,
		distribution: info
	}
}

// vim: ts=4
