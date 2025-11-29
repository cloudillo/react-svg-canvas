/**
 * Rotation-aware geometry calculations for snapping
 */

import type { Point, Bounds } from '../types'
import type { RotatedBounds, SnapPoints, SnapSpatialObject } from './types'
import { degToRad } from '../geometry/math'

/**
 * Get the center point (pivot) of rotated bounds
 * Uses custom pivot if provided, otherwise defaults to center (0.5, 0.5)
 */
export function getRotatedBoundsCenter(bounds: RotatedBounds): Point {
	const pivotX = bounds.pivotX ?? 0.5
	const pivotY = bounds.pivotY ?? 0.5
	return {
		x: bounds.x + bounds.width * pivotX,
		y: bounds.y + bounds.height * pivotY
	}
}

/**
 * Rotate a point around a center
 */
export function rotatePointAround(point: Point, center: Point, angleDegrees: number): Point {
	const rad = degToRad(angleDegrees)
	const cos = Math.cos(rad)
	const sin = Math.sin(rad)
	const dx = point.x - center.x
	const dy = point.y - center.y

	return {
		x: center.x + dx * cos - dy * sin,
		y: center.y + dx * sin + dy * cos
	}
}

/**
 * Get the four corners of a rotated bounds
 */
export function getRotatedCorners(bounds: RotatedBounds): Point[] {
	const { x, y, width, height, rotation } = bounds
	const center = getRotatedBoundsCenter(bounds)

	// Corners before rotation (relative to bounds origin)
	const corners: Point[] = [
		{ x, y },                           // top-left
		{ x: x + width, y },                // top-right
		{ x: x + width, y: y + height },    // bottom-right
		{ x, y: y + height }                // bottom-left
	]

	// Apply rotation around center
	if (rotation !== 0) {
		return corners.map(corner => rotatePointAround(corner, center, rotation))
	}

	return corners
}

/**
 * Get snap points from rotated bounds
 * For snapping, we use the axis-aligned bounding box of the rotated shape
 */
export function getRotatedSnapPoints(bounds: RotatedBounds): SnapPoints {
	const corners = getRotatedCorners(bounds)
	const pivot = getRotatedBoundsCenter(bounds)

	// Get axis-aligned bounding box from rotated corners
	const xs = corners.map(c => c.x)
	const ys = corners.map(c => c.y)

	const left = Math.min(...xs)
	const right = Math.max(...xs)
	const top = Math.min(...ys)
	const bottom = Math.max(...ys)

	return {
		left,
		right,
		top,
		bottom,
		// Center is the geometric center of the AABB for center snapping
		centerX: (left + right) / 2,
		centerY: (top + bottom) / 2,
		// Pivot for pivot-to-pivot snapping
		pivotX: pivot.x,
		pivotY: pivot.y,
		corners
	}
}

/**
 * Get snap points from non-rotated bounds (simpler case)
 */
export function getSnapPoints(bounds: RotatedBounds): SnapPoints {
	if (bounds.rotation && bounds.rotation !== 0) {
		return getRotatedSnapPoints(bounds)
	}

	const { x, y, width, height } = bounds
	const pivot = getRotatedBoundsCenter(bounds)

	return {
		left: x,
		right: x + width,
		top: y,
		bottom: y + height,
		// Center is the geometric center for center snapping
		centerX: x + width / 2,
		centerY: y + height / 2,
		// Pivot for pivot-to-pivot snapping
		pivotX: pivot.x,
		pivotY: pivot.y,
		corners: [
			{ x, y },
			{ x: x + width, y },
			{ x: x + width, y: y + height },
			{ x, y: y + height }
		]
	}
}

/**
 * Get the axis-aligned projection of rotated bounds
 */
export function getRotatedBoundsProjection(bounds: RotatedBounds): {
	left: number
	right: number
	top: number
	bottom: number
	width: number
	height: number
} {
	const snapPoints = getSnapPoints(bounds)

	return {
		left: snapPoints.left,
		right: snapPoints.right,
		top: snapPoints.top,
		bottom: snapPoints.bottom,
		width: snapPoints.right - snapPoints.left,
		height: snapPoints.bottom - snapPoints.top
	}
}

/**
 * Represents an edge with start and end points
 */
export interface Edge {
	start: Point
	end: Point
}

/**
 * Get the edges of a rotated bounds
 */
export function getRotatedEdges(bounds: RotatedBounds): Edge[] {
	const corners = getRotatedCorners(bounds)

	return [
		{ start: corners[0], end: corners[1] }, // top
		{ start: corners[1], end: corners[2] }, // right
		{ start: corners[2], end: corners[3] }, // bottom
		{ start: corners[3], end: corners[0] }  // left
	]
}

/**
 * Calculate perpendicular distance from a point to a line segment
 */
export function distanceToEdge(point: Point, edge: Edge): number {
	const { start, end } = edge
	const dx = end.x - start.x
	const dy = end.y - start.y
	const lengthSq = dx * dx + dy * dy

	if (lengthSq === 0) {
		// Edge is a point
		return Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2)
	}

	// Project point onto line, clamped to segment
	let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq
	t = Math.max(0, Math.min(1, t))

	const projX = start.x + t * dx
	const projY = start.y + t * dy

	return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2)
}

/**
 * Normalize a point to a 0-1 range within bounds
 */
export function normalizePointInBounds(point: Point, bounds: RotatedBounds): Point {
	// For simplicity, use non-rotated bounds for normalization
	return {
		x: Math.max(0, Math.min(1, (point.x - bounds.x) / bounds.width)),
		y: Math.max(0, Math.min(1, (point.y - bounds.y) / bounds.height))
	}
}

/**
 * Compute grab point from initial mouse position and object bounds
 */
export function computeGrabPoint(mousePos: Point, bounds: RotatedBounds): Point {
	return normalizePointInBounds(mousePos, bounds)
}

/**
 * Calculate the Axis-Aligned Bounding Box (AABB) from a SnapSpatialObject
 * Takes into account rotation to compute the smallest axis-aligned rectangle
 * that contains all corners of the rotated object.
 */
export function getAABB(obj: SnapSpatialObject): Bounds {
	const rotation = obj.rotation ?? 0

	// If no rotation, just return the original bounds
	if (rotation === 0) {
		return obj.bounds
	}

	// Create RotatedBounds for corner calculation
	const rotatedBounds: RotatedBounds = {
		x: obj.bounds.x,
		y: obj.bounds.y,
		width: obj.bounds.width,
		height: obj.bounds.height,
		rotation,
		pivotX: obj.pivotX ?? 0.5,
		pivotY: obj.pivotY ?? 0.5
	}

	// Get the rotated corners
	const corners = getRotatedCorners(rotatedBounds)

	// Calculate AABB from corners
	const xs = corners.map(c => c.x)
	const ys = corners.map(c => c.y)

	const minX = Math.min(...xs)
	const maxX = Math.max(...xs)
	const minY = Math.min(...ys)
	const maxY = Math.max(...ys)

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	}
}

// vim: ts=4
