/**
 * Utility functions for rotation and pivot operations
 */

import type { Bounds, Point } from '../types'
import { normalizeAngle, degToRad, radToDeg } from '../geometry/math'

// ============================================================================
// Constants
// ============================================================================

/** Default snap angles at 15° intervals */
export const DEFAULT_SNAP_ANGLES = Array.from({ length: 24 }, (_, i) => i * 15)

/** Default snap zone ratio (inner 75% of arc) */
export const DEFAULT_SNAP_ZONE_RATIO = 0.75

/** Default pivot snap threshold (8% of object dimension) */
export const DEFAULT_PIVOT_SNAP_THRESHOLD = 0.08

// ============================================================================
// Angle Calculation
// ============================================================================

/**
 * Calculate the angle from a center point to a target point
 * @param center The center point
 * @param target The target point
 * @returns Angle in degrees (0-360, where 0 is right, 90 is down)
 */
export function getAngleFromCenter(center: Point, target: Point): number {
	const dx = target.x - center.x
	const dy = target.y - center.y
	const radians = Math.atan2(dy, dx)
	return normalizeAngle(radToDeg(radians))
}

/**
 * Snap an angle to the nearest snap angle if within threshold
 * @param angle The angle to snap (degrees)
 * @param snapAngles Available snap angles (degrees)
 * @param threshold Maximum distance to snap (degrees), default 2
 * @returns The snapped angle, or original if not within threshold
 */
export function snapAngle(
	angle: number,
	snapAngles: number[] = DEFAULT_SNAP_ANGLES,
	threshold: number = 2
): { angle: number; isSnapped: boolean } {
	const normalized = normalizeAngle(angle)

	let closestAngle = normalized
	let minDistance = Infinity

	for (const snapAngle of snapAngles) {
		// Handle wrap-around (e.g., 359° is close to 0°)
		const distance = Math.min(
			Math.abs(normalized - snapAngle),
			Math.abs(normalized - snapAngle + 360),
			Math.abs(normalized - snapAngle - 360)
		)

		if (distance < minDistance) {
			minDistance = distance
			closestAngle = snapAngle
		}
	}

	if (minDistance <= threshold) {
		return { angle: normalizeAngle(closestAngle), isSnapped: true }
	}

	return { angle: normalized, isSnapped: false }
}

/**
 * Find the closest snap angle to a given angle
 * @param angle The angle to find closest snap for (degrees)
 * @param snapAngles Available snap angles (degrees)
 * @returns The closest snap angle
 */
export function findClosestSnapAngle(
	angle: number,
	snapAngles: number[] = DEFAULT_SNAP_ANGLES
): number {
	const normalized = normalizeAngle(angle)
	let closest = snapAngles[0]
	let minDistance = Infinity

	for (const snapAngle of snapAngles) {
		const distance = Math.min(
			Math.abs(normalized - snapAngle),
			Math.abs(normalized - snapAngle + 360),
			Math.abs(normalized - snapAngle - 360)
		)

		if (distance < minDistance) {
			minDistance = distance
			closest = snapAngle
		}
	}

	return closest
}

// ============================================================================
// Pivot Position Compensation
// ============================================================================

/**
 * Calculate position compensation when pivot changes on a rotated object.
 * This keeps the object visually in the same place when the pivot moves.
 *
 * When an object is rotated and its pivot point changes, the object's position
 * (which is defined relative to the pivot) needs to be adjusted to maintain
 * the same visual appearance.
 *
 * The formula accounts for the fact that changing the pivot on a rotated object
 * causes it to shift - we calculate the inverse of that shift.
 *
 * @param oldPivot Previous pivot (normalized 0-1)
 * @param newPivot New pivot (normalized 0-1)
 * @param bounds Object bounds (width/height used for scaling)
 * @param rotation Object rotation in degrees
 * @returns Position compensation (dx, dy) to add to object position
 */
export function calculatePivotCompensation(
	oldPivot: Point,
	newPivot: Point,
	bounds: Bounds,
	rotation: number
): Point {
	// Delta in pivot (normalized coordinates) - how much pivot moved
	const dpx = oldPivot.x - newPivot.x
	const dpy = oldPivot.y - newPivot.y

	// If no rotation, compensation is simple translation
	if (rotation === 0 || Math.abs(rotation) < 0.001) {
		return {
			x: bounds.width * dpx,
			y: bounds.height * dpy
		}
	}

	// For rotated objects, use the correct compensation formula
	// This formula keeps the object visually in place when pivot changes
	const rad = degToRad(rotation)
	const cos = Math.cos(rad)
	const sin = Math.sin(rad)

	const objW = bounds.width
	const objH = bounds.height

	// Compensation formula derived from transform math:
	// When pivot changes on a rotated object, the object shifts.
	// This formula calculates the inverse of that shift.
	return {
		x: objW * dpx * (1 - cos) + objH * dpy * sin,
		y: objH * dpy * (1 - cos) - objW * dpx * sin
	}
}

/**
 * Calculate the absolute position of a pivot point in canvas coordinates
 * @param bounds Object bounds
 * @param pivotX Normalized pivot X (0-1)
 * @param pivotY Normalized pivot Y (0-1)
 * @returns Absolute pivot position in canvas coordinates
 */
export function getPivotPosition(bounds: Bounds, pivotX: number, pivotY: number): Point {
	return {
		x: bounds.x + bounds.width * pivotX,
		y: bounds.y + bounds.height * pivotY
	}
}

/**
 * Convert canvas coordinates to normalized pivot coordinates
 * @param point Canvas coordinates
 * @param bounds Object bounds
 * @returns Normalized pivot (0-1 for each axis)
 */
export function canvasToPivot(point: Point, bounds: Bounds): Point {
	return {
		x: (point.x - bounds.x) / bounds.width,
		y: (point.y - bounds.y) / bounds.height
	}
}

/**
 * Clamp pivot to valid range (0-1)
 * @param pivot Pivot point (may be outside 0-1 range)
 * @returns Clamped pivot
 */
export function clampPivot(pivot: Point): Point {
	return {
		x: Math.max(0, Math.min(1, pivot.x)),
		y: Math.max(0, Math.min(1, pivot.y))
	}
}

// ============================================================================
// Pivot Snapping
// ============================================================================

/**
 * Snap pivot to nearest snap point if within threshold
 * @param pivot Current pivot (normalized)
 * @param snapPoints Available snap points (normalized)
 * @param threshold Snap threshold in normalized units
 * @returns Snapped pivot and snap point if snapped
 */
export function snapPivot(
	pivot: Point,
	snapPoints: Point[],
	threshold: number = DEFAULT_PIVOT_SNAP_THRESHOLD
): { pivot: Point; snappedPoint: Point | null } {
	let closestPoint: Point | null = null
	let minDistance = Infinity

	for (const snapPoint of snapPoints) {
		const dx = pivot.x - snapPoint.x
		const dy = pivot.y - snapPoint.y
		const distance = Math.sqrt(dx * dx + dy * dy)

		if (distance < minDistance) {
			minDistance = distance
			closestPoint = snapPoint
		}
	}

	if (closestPoint && minDistance <= threshold) {
		return { pivot: closestPoint, snappedPoint: closestPoint }
	}

	return { pivot, snappedPoint: null }
}

// ============================================================================
// Rotation Around Point
// ============================================================================

/**
 * Rotate a point around a center by a given angle
 * @param point The point to rotate
 * @param center The center of rotation
 * @param angleDegrees The angle to rotate (degrees)
 * @returns The rotated point
 */
export function rotatePointAroundCenter(
	point: Point,
	center: Point,
	angleDegrees: number
): Point {
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
 * Calculate the new position of an object when rotated around a group pivot
 * @param objectBounds The object's bounds
 * @param objectRotation The object's current rotation (degrees)
 * @param groupPivot The group pivot point (canvas coordinates)
 * @param deltaAngle The angle to rotate by (degrees)
 * @returns New position and rotation for the object
 */
export function rotateObjectAroundPivot(
	objectBounds: Bounds,
	objectRotation: number,
	groupPivot: Point,
	deltaAngle: number
): { x: number; y: number; rotation: number } {
	// Get object center
	const objectCenter: Point = {
		x: objectBounds.x + objectBounds.width / 2,
		y: objectBounds.y + objectBounds.height / 2
	}

	// Rotate object center around group pivot
	const newCenter = rotatePointAroundCenter(objectCenter, groupPivot, deltaAngle)

	// Calculate new position (top-left corner)
	const newX = newCenter.x - objectBounds.width / 2
	const newY = newCenter.y - objectBounds.height / 2

	// New rotation is original rotation plus delta
	const newRotation = normalizeAngle(objectRotation + deltaAngle)

	return { x: newX, y: newY, rotation: newRotation }
}

// ============================================================================
// Arc Geometry for Rotation Handle
// ============================================================================

/**
 * Calculate the maximum distance from pivot to any corner of the bounds
 * Used to determine arc radius for rotation handle
 * @param bounds Object bounds
 * @param pivotX Normalized pivot X
 * @param pivotY Normalized pivot Y
 * @returns Maximum distance to any corner
 */
export function getMaxDistanceFromPivot(
	bounds: Bounds,
	pivotX: number,
	pivotY: number
): number {
	const pivot = getPivotPosition(bounds, pivotX, pivotY)

	const corners: Point[] = [
		{ x: bounds.x, y: bounds.y },
		{ x: bounds.x + bounds.width, y: bounds.y },
		{ x: bounds.x, y: bounds.y + bounds.height },
		{ x: bounds.x + bounds.width, y: bounds.y + bounds.height }
	]

	let maxDist = 0
	for (const corner of corners) {
		const dx = corner.x - pivot.x
		const dy = corner.y - pivot.y
		const dist = Math.sqrt(dx * dx + dy * dy)
		maxDist = Math.max(maxDist, dist)
	}

	return maxDist
}

/**
 * Check if a point is within the snap zone (inner portion of arc)
 * @param point The point to check (canvas coordinates)
 * @param center Center of the arc (pivot point)
 * @param arcRadius Full arc radius
 * @param snapZoneRatio Ratio of arc radius that is snap zone (0-1)
 * @returns True if point is within snap zone
 */
export function isInSnapZone(
	point: Point,
	center: Point,
	arcRadius: number,
	snapZoneRatio: number = DEFAULT_SNAP_ZONE_RATIO
): boolean {
	const dx = point.x - center.x
	const dy = point.y - center.y
	const distance = Math.sqrt(dx * dx + dy * dy)

	return distance <= arcRadius * snapZoneRatio
}

/**
 * Get position on arc for a given angle
 * @param center Center of the arc
 * @param radius Arc radius
 * @param angleDegrees Angle in degrees (0 = right, 90 = down)
 * @returns Point on the arc
 */
export function getPointOnArc(center: Point, radius: number, angleDegrees: number): Point {
	const rad = degToRad(angleDegrees)
	return {
		x: center.x + radius * Math.cos(rad),
		y: center.y + radius * Math.sin(rad)
	}
}

// vim: ts=4
