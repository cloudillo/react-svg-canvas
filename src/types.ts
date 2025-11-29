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
