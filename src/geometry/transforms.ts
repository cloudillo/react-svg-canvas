/**
 * Coordinate transformation utilities
 */

import type { Point, Bounds, Transform } from '../types'
import { degToRad } from './math'

/**
 * Compose two transforms (parent * child)
 * Result is the transform that represents applying child then parent
 */
export function composeTransforms(parent: Transform, child: Transform): Transform {
	const rotation = degToRad(parent.rotation)
	const cos = Math.cos(rotation)
	const sin = Math.sin(rotation)

	return {
		x: parent.x + (child.x * cos - child.y * sin) * parent.scaleX,
		y: parent.y + (child.x * sin + child.y * cos) * parent.scaleY,
		rotation: parent.rotation + child.rotation,
		scaleX: parent.scaleX * child.scaleX,
		scaleY: parent.scaleY * child.scaleY
	}
}

/**
 * Get identity transform
 */
export function identityTransform(): Transform {
	return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
}

/**
 * Apply transform to a point
 */
export function transformPoint(point: Point, transform: Transform): Point {
	const rotation = degToRad(transform.rotation)
	const cos = Math.cos(rotation)
	const sin = Math.sin(rotation)

	return {
		x: transform.x + (point.x * cos - point.y * sin) * transform.scaleX,
		y: transform.y + (point.x * sin + point.y * cos) * transform.scaleY
	}
}

/**
 * Invert a transform
 */
export function invertTransform(transform: Transform): Transform {
	const rotation = degToRad(-transform.rotation)
	const cos = Math.cos(rotation)
	const sin = Math.sin(rotation)
	const scaleX = 1 / transform.scaleX
	const scaleY = 1 / transform.scaleY

	return {
		x: -(transform.x * cos - transform.y * sin) * scaleX,
		y: -(transform.x * sin + transform.y * cos) * scaleY,
		rotation: -transform.rotation,
		scaleX,
		scaleY
	}
}

/**
 * Convert SVG matrix array [a, b, c, d, e, f] to Transform
 */
export function matrixToTransform(matrix: [number, number, number, number, number, number]): Transform {
	const [a, b, c, d, e, f] = matrix
	const scaleX = Math.sqrt(a * a + b * b)
	const scaleY = Math.sqrt(c * c + d * d)
	const rotation = Math.atan2(b, a) * 180 / Math.PI

	return {
		x: e,
		y: f,
		rotation,
		scaleX,
		scaleY
	}
}

/**
 * Convert Transform to SVG matrix array
 */
export function transformToMatrix(transform: Transform): [number, number, number, number, number, number] {
	const rotation = degToRad(transform.rotation)
	const cos = Math.cos(rotation)
	const sin = Math.sin(rotation)

	return [
		cos * transform.scaleX,
		sin * transform.scaleX,
		-sin * transform.scaleY,
		cos * transform.scaleY,
		transform.x,
		transform.y
	]
}

/**
 * Get absolute position by walking up a hierarchy
 * Generic version that accepts a getParent function
 */
export function getAbsolutePosition<T extends { x: number; y: number; rotation?: number; scaleX?: number; scaleY?: number }>(
	item: T,
	getParent: (item: T) => T | undefined
): Point {
	let x = item.x
	let y = item.y
	let parent = getParent(item)

	while (parent) {
		const rotation = degToRad(parent.rotation || 0)
		const cos = Math.cos(rotation)
		const sin = Math.sin(rotation)
		const sx = parent.scaleX ?? 1
		const sy = parent.scaleY ?? 1

		const newX = parent.x + (x * cos - y * sin) * sx
		const newY = parent.y + (x * sin + y * cos) * sy

		x = newX
		y = newY
		parent = getParent(parent)
	}

	return { x, y }
}

/**
 * Get absolute bounds for an item with width/height
 */
export function getAbsoluteBounds<T extends { x: number; y: number; width: number; height: number; rotation?: number; scaleX?: number; scaleY?: number }>(
	item: T,
	getParent: (item: T) => T | undefined
): Bounds {
	const pos = getAbsolutePosition(item, getParent)
	return {
		x: pos.x,
		y: pos.y,
		width: item.width,
		height: item.height
	}
}

// vim: ts=4
