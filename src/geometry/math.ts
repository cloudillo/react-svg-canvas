/**
 * Basic math operations for SVG canvas
 */

import type { Point } from '../types'

/**
 * Rotate a point around a center
 */
export function rotatePoint(point: Point, center: Point, angleDegrees: number): Point {
	const angle = angleDegrees * Math.PI / 180
	const cos = Math.cos(angle)
	const sin = Math.sin(angle)
	const dx = point.x - center.x
	const dy = point.y - center.y

	return {
		x: center.x + dx * cos - dy * sin,
		y: center.y + dx * sin + dy * cos
	}
}

/**
 * Scale a point relative to a center
 */
export function scalePoint(point: Point, center: Point, scaleX: number, scaleY: number = scaleX): Point {
	return {
		x: center.x + (point.x - center.x) * scaleX,
		y: center.y + (point.y - center.y) * scaleY
	}
}

/**
 * Calculate distance between two points
 */
export function distance(a: Point, b: Point): number {
	const dx = b.x - a.x
	const dy = b.y - a.y
	return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Snap value to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
	return Math.round(value / gridSize) * gridSize
}

/**
 * Snap point to grid
 */
export function snapPointToGrid(point: Point, gridSize: number): Point {
	return {
		x: snapToGrid(point.x, gridSize),
		y: snapToGrid(point.y, gridSize)
	}
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
	return ((angle % 360) + 360) % 360
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
	return degrees * Math.PI / 180
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
	return radians * 180 / Math.PI
}

/**
 * Pre-calculated rotation matrix for performance.
 * When performing multiple operations with the same rotation angle,
 * this avoids redundant Math.cos/sin calls.
 */
export interface RotationMatrix {
	degrees: number
	radians: number
	cos: number
	sin: number
}

/**
 * Create a rotation matrix from angle in degrees
 */
export function createRotationMatrix(degrees: number): RotationMatrix {
	const radians = degrees * Math.PI / 180
	return {
		degrees,
		radians,
		cos: Math.cos(radians),
		sin: Math.sin(radians)
	}
}

/**
 * Rotate a point around center using pre-calculated matrix
 */
export function rotatePointWithMatrix(
	point: Point,
	center: Point,
	matrix: RotationMatrix
): Point {
	const dx = point.x - center.x
	const dy = point.y - center.y
	return {
		x: center.x + dx * matrix.cos - dy * matrix.sin,
		y: center.y + dx * matrix.sin + dy * matrix.cos
	}
}

/**
 * Un-rotate a point (inverse rotation) using pre-calculated matrix
 */
export function unrotatePointWithMatrix(
	point: Point,
	center: Point,
	matrix: RotationMatrix
): Point {
	const dx = point.x - center.x
	const dy = point.y - center.y
	// Inverse rotation: use -sin instead of sin
	return {
		x: center.x + dx * matrix.cos + dy * matrix.sin,
		y: center.y - dx * matrix.sin + dy * matrix.cos
	}
}

/**
 * Rotate a delta (vector) using pre-calculated matrix
 */
export function rotateDeltaWithMatrix(
	dx: number,
	dy: number,
	matrix: RotationMatrix
): [number, number] {
	return [
		dx * matrix.cos - dy * matrix.sin,
		dx * matrix.sin + dy * matrix.cos
	]
}

/**
 * Un-rotate a delta (inverse rotation) using pre-calculated matrix
 */
export function unrotateDeltaWithMatrix(
	dx: number,
	dy: number,
	matrix: RotationMatrix
): [number, number] {
	return [
		dx * matrix.cos + dy * matrix.sin,
		-dx * matrix.sin + dy * matrix.cos
	]
}

// vim: ts=4
