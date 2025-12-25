/**
 * Rotation-aware resize utilities
 *
 * These utilities handle resizing objects that are rotated around a pivot point.
 * The key challenge is keeping the anchor point (opposite corner from the resize handle)
 * fixed on screen while the object changes size.
 */

import type { Point, Bounds, ResizeHandle } from '../types'
import type { RotationMatrix } from './math'
import { createRotationMatrix, unrotateDeltaWithMatrix } from './math'

/**
 * Get the anchor point (opposite corner/edge) for a resize handle.
 * Returns normalized coordinates (0, 0.5, or 1).
 */
export function getAnchorForHandle(handle: ResizeHandle): Point {
	switch (handle) {
		case 'nw': return { x: 1, y: 1 }     // anchor SE
		case 'n':  return { x: 0.5, y: 1 }   // anchor S center
		case 'ne': return { x: 0, y: 1 }     // anchor SW
		case 'e':  return { x: 0, y: 0.5 }   // anchor W center
		case 'se': return { x: 0, y: 0 }     // anchor NW
		case 's':  return { x: 0.5, y: 0 }   // anchor N center
		case 'sw': return { x: 1, y: 0 }     // anchor NE
		case 'w':  return { x: 1, y: 0.5 }   // anchor E center
	}
}

/**
 * Calculate the initial anchor screen position for a rotated object.
 * The anchor is rotated around the pivot point.
 */
export function getRotatedAnchorPosition(
	bounds: Bounds,
	anchor: Point,
	pivot: Point,
	rotationMatrix: RotationMatrix
): Point {
	const anchorLocalX = bounds.x + bounds.width * anchor.x
	const anchorLocalY = bounds.y + bounds.height * anchor.y
	const pivotAbsX = bounds.x + bounds.width * pivot.x
	const pivotAbsY = bounds.y + bounds.height * pivot.y

	// Rotate anchor around pivot
	return {
		x: pivotAbsX + (anchorLocalX - pivotAbsX) * rotationMatrix.cos - (anchorLocalY - pivotAbsY) * rotationMatrix.sin,
		y: pivotAbsY + (anchorLocalX - pivotAbsX) * rotationMatrix.sin + (anchorLocalY - pivotAbsY) * rotationMatrix.cos
	}
}

/**
 * Determine which dimension should drive the resize for aspect ratio constraint.
 * For edge handles, the edge determines the driver.
 * For corner handles, use proportional change to determine which dimension drives.
 */
export function getDriverDimension(
	handle: ResizeHandle,
	localDx: number,
	localDy: number,
	originalWidth: number,
	originalHeight: number
): 'width' | 'height' {
	// Edge handles: the edge determines the driver
	if (handle === 'e' || handle === 'w') return 'width'
	if (handle === 'n' || handle === 's') return 'height'

	// Corner handles: use proportional change to determine driver
	const propX = Math.abs(localDx) / originalWidth
	const propY = Math.abs(localDy) / originalHeight
	return propX >= propY ? 'width' : 'height'
}

/**
 * Calculate new size based on handle and mouse delta in object-local space.
 */
export function calculateResizedDimensions(
	handle: ResizeHandle,
	originalWidth: number,
	originalHeight: number,
	localDx: number,
	localDy: number
): { width: number; height: number } {
	let width = originalWidth
	let height = originalHeight

	switch (handle) {
		case 'nw':
			width = originalWidth - localDx
			height = originalHeight - localDy
			break
		case 'n':
			height = originalHeight - localDy
			break
		case 'ne':
			width = originalWidth + localDx
			height = originalHeight - localDy
			break
		case 'e':
			width = originalWidth + localDx
			break
		case 'se':
			width = originalWidth + localDx
			height = originalHeight + localDy
			break
		case 's':
			height = originalHeight + localDy
			break
		case 'sw':
			width = originalWidth - localDx
			height = originalHeight + localDy
			break
		case 'w':
			width = originalWidth - localDx
			break
	}

	return { width, height }
}

/**
 * Calculate new position to keep anchor point fixed during rotated resize.
 *
 * The math works as follows:
 * 1. Calculate the offset from pivot to anchor in the new (resized) object
 * 2. Rotate this offset to screen space
 * 3. The new pivot screen position = anchor screen position - rotated offset
 * 4. From pivot screen position, derive the new object position
 */
export function calculateResizedPosition(
	newWidth: number,
	newHeight: number,
	anchor: Point,
	pivot: Point,
	anchorScreenPos: Point,
	rotationMatrix: RotationMatrix
): Point {
	// The anchor offset from pivot (in local coords) after resize
	const newAnchorOffsetX = newWidth * (anchor.x - pivot.x)
	const newAnchorOffsetY = newHeight * (anchor.y - pivot.y)

	// Rotate this offset to get screen-space offset from pivot to anchor
	const rotatedOffsetX = newAnchorOffsetX * rotationMatrix.cos - newAnchorOffsetY * rotationMatrix.sin
	const rotatedOffsetY = newAnchorOffsetX * rotationMatrix.sin + newAnchorOffsetY * rotationMatrix.cos

	// The pivot screen position should be such that pivot + rotatedOffset = anchorScreen
	const newPivotScreenX = anchorScreenPos.x - rotatedOffsetX
	const newPivotScreenY = anchorScreenPos.y - rotatedOffsetY

	// Now pivot = (newX + newWidth * pivotX, newY + newHeight * pivotY)
	// So newX = pivotScreenX - newWidth * pivotX, etc.
	return {
		x: newPivotScreenX - newWidth * pivot.x,
		y: newPivotScreenY - newHeight * pivot.y
	}
}

/**
 * State for tracking a resize operation.
 * This captures all the initial values needed to calculate new bounds
 * as the user drags the resize handle.
 */
export interface ResizeState {
	startX: number
	startY: number
	handle: ResizeHandle
	originalBounds: Bounds
	pivot: Point
	anchor: Point
	anchorScreenPos: Point
	rotationMatrix: RotationMatrix
}

/**
 * Initialize resize state for a rotated object.
 * Call this when starting a resize operation.
 *
 * @param startPoint - Initial mouse/pointer position in canvas coords
 * @param handle - Which resize handle is being dragged
 * @param bounds - Current object bounds
 * @param pivot - Pivot point in normalized coords (0-1)
 * @param rotation - Object rotation in degrees
 */
export function initResizeState(
	startPoint: Point,
	handle: ResizeHandle,
	bounds: Bounds,
	pivot: Point,
	rotation: number
): ResizeState {
	const rotationMatrix = createRotationMatrix(rotation)
	const anchor = getAnchorForHandle(handle)
	const anchorScreenPos = getRotatedAnchorPosition(bounds, anchor, pivot, rotationMatrix)

	return {
		startX: startPoint.x,
		startY: startPoint.y,
		handle,
		originalBounds: { ...bounds },
		pivot,
		anchor,
		anchorScreenPos,
		rotationMatrix
	}
}

/**
 * Calculate new bounds during resize, keeping anchor fixed.
 *
 * @param state - Resize state from initResizeState
 * @param currentPoint - Current mouse/pointer position in canvas coords
 * @param minWidth - Minimum allowed width (default 10)
 * @param minHeight - Minimum allowed height (default 10)
 * @param aspectRatio - Optional aspect ratio constraint (width/height). When provided, resize maintains this ratio.
 * @returns New bounds with position adjusted to keep anchor fixed
 */
export function calculateResizeBounds(
	state: ResizeState,
	currentPoint: Point,
	minWidth: number = 10,
	minHeight: number = 10,
	aspectRatio?: number
): Bounds {
	// Calculate screen delta
	const screenDx = currentPoint.x - state.startX
	const screenDy = currentPoint.y - state.startY

	// Un-rotate to get local (object space) delta
	const [localDx, localDy] = unrotateDeltaWithMatrix(screenDx, screenDy, state.rotationMatrix)

	// Calculate new dimensions (unconstrained first)
	let { width, height } = calculateResizedDimensions(
		state.handle,
		state.originalBounds.width,
		state.originalBounds.height,
		localDx,
		localDy
	)

	// Apply aspect ratio constraint if provided
	if (aspectRatio !== undefined) {
		const driver = getDriverDimension(
			state.handle,
			localDx,
			localDy,
			state.originalBounds.width,
			state.originalBounds.height
		)

		if (driver === 'width') {
			// Width drives, calculate height from aspect ratio
			height = width / aspectRatio
		} else {
			// Height drives, calculate width from aspect ratio
			width = height * aspectRatio
		}
	}

	// Enforce minimum size (maintaining aspect ratio if constrained)
	if (aspectRatio !== undefined) {
		// Calculate effective minimum considering aspect ratio
		const minByWidth = minWidth
		const minByHeight = minHeight * aspectRatio

		if (width < minByWidth || height < minHeight) {
			if (minByWidth >= minByHeight) {
				width = minByWidth
				height = width / aspectRatio
			} else {
				height = minHeight
				width = height * aspectRatio
			}
		}
	} else {
		width = Math.max(width, minWidth)
		height = Math.max(height, minHeight)
	}

	// Calculate position to keep anchor fixed
	const position = calculateResizedPosition(
		width,
		height,
		state.anchor,
		state.pivot,
		state.anchorScreenPos,
		state.rotationMatrix
	)

	return {
		x: position.x,
		y: position.y,
		width,
		height
	}
}

// vim: ts=4
