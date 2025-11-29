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

// vim: ts=4
