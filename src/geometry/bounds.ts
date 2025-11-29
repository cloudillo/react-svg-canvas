/**
 * Bounds operations for SVG canvas
 */

import type { Point, Bounds, HandlePosition, ResizeHandle } from '../types'

/**
 * Get center of bounds
 */
export function getBoundsCenter(bounds: Bounds): Point {
	return {
		x: bounds.x + bounds.width / 2,
		y: bounds.y + bounds.height / 2
	}
}

/**
 * Expand bounds by margin
 */
export function expandBounds(bounds: Bounds, margin: number): Bounds {
	return {
		x: bounds.x - margin,
		y: bounds.y - margin,
		width: bounds.width + margin * 2,
		height: bounds.height + margin * 2
	}
}

/**
 * Union of two bounds
 */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
	const minX = Math.min(a.x, b.x)
	const minY = Math.min(a.y, b.y)
	const maxX = Math.max(a.x + a.width, b.x + b.width)
	const maxY = Math.max(a.y + a.height, b.y + b.height)

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY
	}
}

/**
 * Union of multiple bounds
 */
export function unionAllBounds(boundsArray: Bounds[]): Bounds | null {
	if (boundsArray.length === 0) return null
	return boundsArray.reduce((acc, b) => unionBounds(acc, b))
}

/**
 * Check if two bounds intersect (AABB collision)
 */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
	return !(a.x > b.x + b.width || a.x + a.width < b.x ||
		a.y > b.y + b.height || a.y + a.height < b.y)
}

/**
 * Check if point is inside bounds
 */
export function pointInBounds(point: Point, bounds: Bounds): boolean {
	return point.x >= bounds.x &&
		point.x <= bounds.x + bounds.width &&
		point.y >= bounds.y &&
		point.y <= bounds.y + bounds.height
}

/**
 * Check if bounds A is completely inside bounds B
 */
export function boundsContains(outer: Bounds, inner: Bounds): boolean {
	return inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.width <= outer.x + outer.width &&
		inner.y + inner.height <= outer.y + outer.height
}

/**
 * Create bounds from two points (handles negative width/height)
 */
export function boundsFromPoints(p1: Point, p2: Point): Bounds {
	return {
		x: Math.min(p1.x, p2.x),
		y: Math.min(p1.y, p2.y),
		width: Math.abs(p2.x - p1.x),
		height: Math.abs(p2.y - p1.y)
	}
}

/**
 * Get the 8 resize handle positions for a bounds
 */
export function getHandlePositions(bounds: Bounds): HandlePosition[] {
	const { x, y, width, height } = bounds
	const cx = x + width / 2
	const cy = y + height / 2

	return [
		{ handle: 'nw', x, y },
		{ handle: 'n', x: cx, y },
		{ handle: 'ne', x: x + width, y },
		{ handle: 'e', x: x + width, y: cy },
		{ handle: 'se', x: x + width, y: y + height },
		{ handle: 's', x: cx, y: y + height },
		{ handle: 'sw', x, y: y + height },
		{ handle: 'w', x, y: cy }
	]
}

/**
 * Calculate new bounds after resizing from a handle
 */
export function resizeBounds(
	originalBounds: Bounds,
	handle: ResizeHandle,
	deltaX: number,
	deltaY: number,
	minWidth: number = 1,
	minHeight: number = 1
): Bounds {
	let { x, y, width, height } = originalBounds

	switch (handle) {
		case 'nw':
			x += deltaX
			y += deltaY
			width -= deltaX
			height -= deltaY
			break
		case 'n':
			y += deltaY
			height -= deltaY
			break
		case 'ne':
			y += deltaY
			width += deltaX
			height -= deltaY
			break
		case 'e':
			width += deltaX
			break
		case 'se':
			width += deltaX
			height += deltaY
			break
		case 's':
			height += deltaY
			break
		case 'sw':
			x += deltaX
			width -= deltaX
			height += deltaY
			break
		case 'w':
			x += deltaX
			width -= deltaX
			break
	}

	// Enforce minimum size
	if (width < minWidth) {
		if (handle.includes('w')) {
			x = originalBounds.x + originalBounds.width - minWidth
		}
		width = minWidth
	}
	if (height < minHeight) {
		if (handle.includes('n')) {
			y = originalBounds.y + originalBounds.height - minHeight
		}
		height = minHeight
	}

	return { x, y, width, height }
}

// vim: ts=4
