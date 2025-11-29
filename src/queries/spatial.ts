/**
 * Generic spatial queries for SVG canvas
 * These work with any objects that have an id and bounds
 */

import type { Point, Bounds, SpatialObject } from '../types'
import { boundsIntersect, pointInBounds, boundsContains, unionAllBounds } from '../geometry/bounds'

/**
 * Get objects at a point (hit testing)
 * Returns in provided order (typically z-order: back to front)
 */
export function getObjectsAtPoint<T extends SpatialObject>(
	objects: T[],
	point: Point
): T[] {
	return objects.filter(obj => pointInBounds(point, obj.bounds))
}

/**
 * Get topmost object at a point
 * Assumes objects are in z-order (back to front), returns last match
 */
export function getTopmostAtPoint<T extends SpatialObject>(
	objects: T[],
	point: Point
): T | undefined {
	for (let i = objects.length - 1; i >= 0; i--) {
		if (pointInBounds(point, objects[i].bounds)) {
			return objects[i]
		}
	}
	return undefined
}

/**
 * Get objects that intersect with a rectangle (selection box)
 */
export function getObjectsIntersectingRect<T extends SpatialObject>(
	objects: T[],
	rect: Bounds
): T[] {
	return objects.filter(obj => boundsIntersect(obj.bounds, rect))
}

/**
 * Get objects fully contained within a rectangle
 */
export function getObjectsContainedInRect<T extends SpatialObject>(
	objects: T[],
	rect: Bounds
): T[] {
	return objects.filter(obj => boundsContains(rect, obj.bounds))
}

/**
 * Get IDs of objects at a point
 */
export function getObjectIdsAtPoint<T extends SpatialObject>(
	objects: T[],
	point: Point
): string[] {
	return getObjectsAtPoint(objects, point).map(obj => obj.id)
}

/**
 * Get IDs of objects in rectangle
 */
export function getObjectIdsInRect<T extends SpatialObject>(
	objects: T[],
	rect: Bounds
): string[] {
	return getObjectsIntersectingRect(objects, rect).map(obj => obj.id)
}

/**
 * Get union bounds of multiple objects
 */
export function getSelectionBounds<T extends SpatialObject>(
	objects: T[]
): Bounds | null {
	if (objects.length === 0) return null
	return unionAllBounds(objects.map(obj => obj.bounds))
}

/**
 * Get union bounds by IDs
 */
export function getSelectionBoundsById<T extends SpatialObject>(
	objects: T[],
	ids: Set<string> | string[]
): Bounds | null {
	const idSet = ids instanceof Set ? ids : new Set(ids)
	const selected = objects.filter(obj => idSet.has(obj.id))
	return getSelectionBounds(selected)
}

/**
 * Filter objects by visibility bounds (culling)
 */
export function getObjectsInView<T extends SpatialObject>(
	objects: T[],
	viewBounds: Bounds
): T[] {
	return objects.filter(obj => boundsIntersect(obj.bounds, viewBounds))
}

/**
 * Find nearest object to a point
 */
export function findNearestObject<T extends SpatialObject>(
	objects: T[],
	point: Point,
	maxDistance: number = Infinity
): T | undefined {
	let nearest: T | undefined
	let nearestDist = maxDistance

	for (const obj of objects) {
		const bounds = obj.bounds
		// Calculate distance to bounds center
		const cx = bounds.x + bounds.width / 2
		const cy = bounds.y + bounds.height / 2
		const dist = Math.sqrt((point.x - cx) ** 2 + (point.y - cy) ** 2)

		if (dist < nearestDist) {
			nearestDist = dist
			nearest = obj
		}
	}

	return nearest
}

/**
 * Get objects within a radius of a point
 */
export function getObjectsInRadius<T extends SpatialObject>(
	objects: T[],
	center: Point,
	radius: number
): T[] {
	const result: T[] = []

	for (const obj of objects) {
		const bounds = obj.bounds
		// Check if bounds center is within radius
		const cx = bounds.x + bounds.width / 2
		const cy = bounds.y + bounds.height / 2
		const dist = Math.sqrt((center.x - cx) ** 2 + (center.y - cy) ** 2)

		if (dist <= radius) {
			result.push(obj)
		}
	}

	return result
}

// vim: ts=4
