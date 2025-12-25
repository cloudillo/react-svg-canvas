/**
 * useResizable hook - provides rotation-aware resize interaction
 * Uses Pointer Events API for unified mouse/touch/pen handling
 *
 * When rotation is provided, uses proper anchor point calculation
 * to keep the opposite corner fixed during resize.
 *
 * When used inside SvgCanvas, automatically uses the canvas coordinate
 * transform (translateTo) for correct pan/zoom handling.
 */

import React from 'react'
import type { Bounds, ResizeHandle, Point, ResizeStartEvent, ResizeMoveEvent, ResizeEndEvent } from '../types'
import type { RotatedBounds, ActiveSnap, ScoredCandidate } from '../snapping/types'
import { svgTransformCoordinates } from './useDraggable'
import { useSvgCanvas } from '../svgcanvas'
import {
	type ResizeState,
	initResizeState,
	calculateResizeBounds
} from '../geometry/resize'

/**
 * Create a transform function that uses SvgCanvas context if available
 */
function createCanvasTransform(
	translateTo: ((x: number, y: number) => [number, number]) | undefined
): (clientX: number, clientY: number, element: Element) => Point {
	if (!translateTo) {
		return svgTransformCoordinates
	}
	return (clientX: number, clientY: number, element: Element): Point => {
		const rect = element.getBoundingClientRect()
		const [x, y] = translateTo(clientX - rect.left, clientY - rect.top)
		return { x, y }
	}
}

/** Result from snap computation for resize */
export interface SnapResizeResult {
	bounds: Bounds
	activeSnaps?: ActiveSnap[]
	candidates?: ScoredCandidate[]
}

/** Parameters for snap resize function */
export interface SnapResizeFn {
	(params: {
		originalBounds: RotatedBounds
		currentBounds: RotatedBounds
		objectId: string
		handle: ResizeHandle
		delta: Point
		excludeIds?: Set<string>
	}): SnapResizeResult
}

export interface UseResizableOptions {
	/** Current bounds of the resizable object */
	bounds: Bounds
	/** Minimum width */
	minWidth?: number
	/** Minimum height */
	minHeight?: number
	/** Called when resize starts */
	onResizeStart?: (e: ResizeStartEvent) => void
	/** Called during resize */
	onResize?: (e: ResizeMoveEvent) => void
	/** Called when resize ends */
	onResizeEnd?: (e: ResizeEndEvent) => void
	/** Disable resizing */
	disabled?: boolean
	/** Custom coordinate transformer */
	transformCoordinates?: (clientX: number, clientY: number, element: Element) => Point

	// Rotation-aware resize options
	/** Object rotation in degrees (default 0) */
	rotation?: number
	/** Pivot X (0-1 normalized), default 0.5 */
	pivotX?: number
	/** Pivot Y (0-1 normalized), default 0.5 */
	pivotY?: number

	// Snapping integration
	/** Unique identifier for the object being resized */
	objectId?: string
	/** Snap function from useSnapping hook */
	snapResize?: SnapResizeFn

	/**
	 * Optional getter for fresh bounds at resize start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * If provided, this is called at resize start and its return value is used
	 * instead of the `bounds` prop.
	 */
	getBounds?: () => Bounds
	/**
	 * Optional getter for fresh rotation at resize start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * If provided, this is called at resize start and its return value is used
	 * instead of the `rotation` prop.
	 */
	getRotation?: () => number
	/**
	 * Optional getter for fresh pivot at resize start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 * Returns { x: pivotX, y: pivotY } in normalized coordinates (0-1).
	 */
	getPivot?: () => Point

	// Aspect ratio constraint
	/**
	 * Aspect ratio constraint (width/height).
	 * When provided, resize maintains this ratio.
	 * For images, typically originalWidth / originalHeight.
	 */
	aspectRatio?: number
	/**
	 * Optional getter for fresh aspect ratio at resize start.
	 * Use this when working with CRDT/external state to avoid stale closures.
	 */
	getAspectRatio?: () => number | undefined
}

export interface UseResizableReturn {
	/** Whether currently resizing */
	isResizing: boolean
	/** Which handle is active */
	activeHandle: ResizeHandle | null
	/** Handler to start resize from a handle */
	handleResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void
}

export function useResizable(options: UseResizableOptions): UseResizableReturn {
	const {
		bounds,
		minWidth = 10,
		minHeight = 10,
		onResizeStart,
		onResize,
		onResizeEnd,
		disabled = false,
		transformCoordinates: customTransformCoordinates,
		rotation = 0,
		pivotX = 0.5,
		pivotY = 0.5,
		objectId,
		snapResize
	} = options

	// Get SvgCanvas context for automatic coordinate transformation
	const canvasContext = useSvgCanvas()

	// Use canvas context transform if available, otherwise fall back to custom or default
	const transformCoordinates = React.useMemo(
		() => customTransformCoordinates ?? createCanvasTransform(canvasContext.translateTo),
		[customTransformCoordinates, canvasContext.translateTo]
	)

	const [isResizing, setIsResizing] = React.useState(false)
	const [activeHandle, setActiveHandle] = React.useState<ResizeHandle | null>(null)

	// Refs for stable state in event handlers
	const stateRef = React.useRef<{
		resizeState: ResizeState | null
		element: Element | null
		pointerId: number
		currentBounds: Bounds  // Track current bounds for final commit
		aspectRatio: number | undefined  // Captured at resize start
	}>({
		resizeState: null,
		element: null,
		pointerId: -1,
		currentBounds: { x: 0, y: 0, width: 0, height: 0 },
		aspectRatio: undefined
	})

	const optionsRef = React.useRef(options)
	optionsRef.current = options

	const handleResizeStart = React.useCallback((handle: ResizeHandle, e: React.PointerEvent) => {
		if (disabled) return

		e.preventDefault()
		e.stopPropagation()

		const target = e.target as Element
		const element = target instanceof SVGElement
			? (target.ownerSVGElement || target)
			: target
		const coords = transformCoordinates(e.clientX, e.clientY, element)

		// Get current options
		const { bounds, rotation = 0, pivotX = 0.5, pivotY = 0.5 } = optionsRef.current

		// Initialize rotation-aware resize state
		const resizeState = initResizeState(
			{ x: coords.x, y: coords.y },
			handle,
			bounds,
			{ x: pivotX, y: pivotY },
			rotation
		)

		// Capture aspect ratio at resize start (from getter if provided, else from prop)
		const aspectRatio = optionsRef.current.getAspectRatio?.() ?? optionsRef.current.aspectRatio

		stateRef.current = {
			resizeState,
			element,
			pointerId: e.pointerId,
			currentBounds: { ...bounds },
			aspectRatio
		}

		setIsResizing(true)
		setActiveHandle(handle)

		onResizeStart?.({
			handle,
			bounds: { ...bounds }
		})

		const handlePointerMove = (moveEvent: PointerEvent) => {
			const { resizeState, element, pointerId, aspectRatio } = stateRef.current
			if (!resizeState || !element || moveEvent.pointerId !== pointerId) return

			const opts = optionsRef.current
			const moveCoords = opts.transformCoordinates?.(
				moveEvent.clientX,
				moveEvent.clientY,
				element
			) ?? transformCoordinates(moveEvent.clientX, moveEvent.clientY, element)

			// Calculate delta for snapping
			const deltaX = moveCoords.x - resizeState.startX
			const deltaY = moveCoords.y - resizeState.startY

			// Calculate new bounds (rotation-aware, with aspect ratio constraint if provided)
			let newBounds = calculateResizeBounds(
				resizeState,
				{ x: moveCoords.x, y: moveCoords.y },
				opts.minWidth ?? 10,
				opts.minHeight ?? 10,
				aspectRatio
			)

			// Apply snapping if available
			if (opts.snapResize && opts.objectId) {
				const snapResult = opts.snapResize({
					originalBounds: {
						...resizeState.originalBounds,
						rotation: opts.rotation ?? 0,
						pivotX: opts.pivotX ?? 0.5,
						pivotY: opts.pivotY ?? 0.5
					},
					currentBounds: {
						...newBounds,
						rotation: opts.rotation ?? 0,
						pivotX: opts.pivotX ?? 0.5,
						pivotY: opts.pivotY ?? 0.5
					},
					objectId: opts.objectId,
					handle: resizeState.handle,
					delta: { x: deltaX, y: deltaY },
					excludeIds: new Set([opts.objectId])
				})
				newBounds = snapResult.bounds
			}

			// Track current bounds for final commit
			stateRef.current.currentBounds = newBounds

			opts.onResize?.({
				handle: resizeState.handle,
				bounds: newBounds,
				originalBounds: resizeState.originalBounds
			})
		}

		const handlePointerUp = (upEvent: PointerEvent) => {
			const { resizeState, currentBounds, pointerId } = stateRef.current
			if (upEvent.pointerId !== pointerId) return

			if (resizeState) {
				optionsRef.current.onResizeEnd?.({
					handle: resizeState.handle,
					bounds: currentBounds,
					originalBounds: resizeState.originalBounds
				})
			}

			stateRef.current = {
				resizeState: null,
				element: null,
				pointerId: -1,
				currentBounds: { x: 0, y: 0, width: 0, height: 0 },
				aspectRatio: undefined
			}
			setIsResizing(false)
			setActiveHandle(null)

			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
			window.removeEventListener('pointercancel', handlePointerUp)
		}

		window.addEventListener('pointermove', handlePointerMove)
		window.addEventListener('pointerup', handlePointerUp)
		window.addEventListener('pointercancel', handlePointerUp)
	}, [disabled, bounds, transformCoordinates, onResizeStart, rotation, pivotX, pivotY])

	return {
		isResizing,
		activeHandle,
		handleResizeStart
	}
}

// vim: ts=4
