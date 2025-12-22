/**
 * View/viewport coordinate utilities
 *
 * These utilities convert between canvas coordinates and view-local coordinates.
 * A "view" is a rectangular viewport (using Bounds type) that defines
 * a portion of the canvas.
 */

import type { Point, Bounds } from '../types'

/**
 * Convert canvas coordinates to view-local coordinates
 * @param point - Point in canvas coordinate space
 * @param view - The view/viewport (x, y defines top-left corner)
 * @returns Point relative to view's top-left corner
 */
export function canvasToView(point: Point, view: Bounds): Point {
	return {
		x: point.x - view.x,
		y: point.y - view.y
	}
}

/**
 * Convert view-local coordinates to canvas coordinates
 * @param point - Point relative to view's top-left corner
 * @param view - The view/viewport
 * @returns Point in canvas coordinate space
 */
export function viewToCanvas(point: Point, view: Bounds): Point {
	return {
		x: point.x + view.x,
		y: point.y + view.y
	}
}

/**
 * Check if a point (in canvas coords) is inside a view
 * @param point - Point in canvas coordinates
 * @param view - The view/viewport bounds
 * @returns true if point is inside the view
 */
export function isPointInView(point: Point, view: Bounds): boolean {
	return (
		point.x >= view.x &&
		point.x <= view.x + view.width &&
		point.y >= view.y &&
		point.y <= view.y + view.height
	)
}

/**
 * Check if bounds intersects with a view
 * Uses AABB (axis-aligned bounding box) intersection test.
 * @param bounds - Rectangle to test
 * @param view - The view/viewport bounds
 * @returns true if bounds intersects with view
 */
export function boundsIntersectsView(bounds: Bounds, view: Bounds): boolean {
	const boundsRight = bounds.x + bounds.width
	const boundsBottom = bounds.y + bounds.height
	const viewRight = view.x + view.width
	const viewBottom = view.y + view.height

	return !(
		bounds.x > viewRight ||
		boundsRight < view.x ||
		bounds.y > viewBottom ||
		boundsBottom < view.y
	)
}

// vim: ts=4
