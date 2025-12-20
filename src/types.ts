/**
 * Core types for react-svg-canvas
 */

// Basic geometric types
export interface Point {
	x: number
	y: number
}

export interface Bounds {
	x: number
	y: number
	width: number
	height: number
}

export interface Transform {
	x: number
	y: number
	rotation: number
	scaleX: number
	scaleY: number
}

// Selection types
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const RESIZE_CURSORS: Record<ResizeHandle, string> = {
	nw: 'nwse-resize',
	n: 'ns-resize',
	ne: 'nesw-resize',
	e: 'ew-resize',
	se: 'nwse-resize',
	s: 'ns-resize',
	sw: 'nesw-resize',
	w: 'ew-resize'
}

// Base angles for each handle (clockwise from north)
const HANDLE_BASE_ANGLES: Record<ResizeHandle, number> = {
	n: 0,
	ne: 45,
	e: 90,
	se: 135,
	s: 180,
	sw: 225,
	w: 270,
	nw: 315
}

// Cursor types in clockwise order (repeating every 45°)
const CURSOR_ORDER = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'] as const

/**
 * Get the appropriate cursor for a resize handle accounting for object rotation.
 * When an object is rotated, the visual direction of each handle changes,
 * so the cursor should match the rotated direction.
 */
export function getRotatedCursor(handle: ResizeHandle, rotation: number): string {
	const baseAngle = HANDLE_BASE_ANGLES[handle]
	// Add rotation and normalize to 0-360
	const effectiveAngle = ((baseAngle + rotation) % 360 + 360) % 360
	// Each cursor covers 45°, centered on its primary angle
	// Add 22.5 to shift the boundaries (so 0° ± 22.5° maps to index 0)
	const cursorIndex = Math.floor((effectiveAngle + 22.5) / 45) % 4
	return CURSOR_ORDER[cursorIndex]
}

// Handle position type
export interface HandlePosition {
	handle: ResizeHandle
	x: number
	y: number
}

// Drag event types
export interface DragStartEvent {
	x: number
	y: number
	clientX: number
	clientY: number
}

export interface DragMoveEvent {
	x: number
	y: number
	startX: number
	startY: number
	deltaX: number
	deltaY: number
	clientX: number
	clientY: number
}

export interface DragEndEvent {
	x: number
	y: number
	startX: number
	startY: number
}

// Resize event types
export interface ResizeStartEvent {
	handle: ResizeHandle
	bounds: Bounds
}

export interface ResizeMoveEvent {
	handle: ResizeHandle
	bounds: Bounds
	originalBounds: Bounds
}

export interface ResizeEndEvent {
	handle: ResizeHandle
	bounds: Bounds
	originalBounds: Bounds
}

// Generic interface for objects that can be spatially queried
export interface SpatialObject {
	id: string
	bounds: Bounds
}

// vim: ts=4
