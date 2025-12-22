/**
 * useDraggable hook - provides smooth drag interaction
 * Uses Pointer Events API for unified mouse/touch/pen handling
 *
 * Supports optional snapping integration when snapDrag is provided.
 *
 * When used inside SvgCanvas, automatically uses the canvas coordinate
 * transform (translateTo) for correct pan/zoom handling.
 */

import React from 'react'
import type { DragStartEvent, DragMoveEvent, DragEndEvent, Point, Bounds } from '../types'
import type { RotatedBounds, ActiveSnap, ScoredCandidate } from '../snapping/types'
import { computeGrabPoint } from '../snapping/rotation-utils'
import { useSvgCanvas } from '../svgcanvas'

/** Result from snap computation (matches useSnapping return type) */
export interface SnapDragResult {
	position: Point
	activeSnaps?: ActiveSnap[]
	candidates?: ScoredCandidate[]
}

/** Parameters for snap function */
export interface SnapDragFn {
	(params: {
		bounds: RotatedBounds
		objectId: string
		delta: Point
		grabPoint: Point
		excludeIds?: Set<string>
	}): SnapDragResult
}

export interface UseDraggableOptions {
	/** Called when drag starts */
	onDragStart?: (e: DragStartEvent) => void
	/** Called during drag */
	onDragMove?: (e: DragMoveEvent) => void
	/** Called when drag ends */
	onDragEnd?: (e: DragEndEvent) => void
	/** Disable dragging */
	disabled?: boolean
	/** Custom coordinate transformer (e.g., SVG CTM) */
	transformCoordinates?: (clientX: number, clientY: number, element: Element) => Point

	// Object context for snapping
	/** Unique identifier for the object being dragged */
	objectId?: string
	/** Current bounds of the object (x, y = position, width/height = size) */
	objectBounds?: Bounds
	/** Object rotation in degrees */
	rotation?: number
	/** Pivot X (0-1 normalized), default 0.5 */
	pivotX?: number
	/** Pivot Y (0-1 normalized), default 0.5 */
	pivotY?: number

	// Snapping integration
	/** Snap function from useSnapping hook */
	snapDrag?: SnapDragFn
	/** Whether to auto-compute grab point from initial click position */
	autoGrabPoint?: boolean
}

export interface UseDraggableReturn {
	/** Whether currently dragging */
	isDragging: boolean
	/** Props to spread onto the draggable element */
	dragProps: {
		onPointerDown: (e: React.PointerEvent) => void
	}
}

/**
 * Default coordinate transformer (screen to element-local)
 */
function defaultTransformCoordinates(clientX: number, clientY: number, element: Element): Point {
	const rect = element.getBoundingClientRect()
	return {
		x: clientX - rect.left,
		y: clientY - rect.top
	}
}

/**
 * SVG coordinate transformer using CTM (fallback when not in SvgCanvas context)
 */
export function svgTransformCoordinates(clientX: number, clientY: number, element: Element): Point {
	const svgElement = element instanceof SVGElement
		? element.ownerSVGElement || element as SVGSVGElement
		: null

	if (!svgElement || !(svgElement instanceof SVGSVGElement)) {
		return defaultTransformCoordinates(clientX, clientY, element)
	}

	const ctm = svgElement.getScreenCTM()
	if (!ctm) {
		return defaultTransformCoordinates(clientX, clientY, element)
	}

	const point = svgElement.createSVGPoint()
	point.x = clientX
	point.y = clientY
	const svgPoint = point.matrixTransform(ctm.inverse())

	return { x: svgPoint.x, y: svgPoint.y }
}

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

export function useDraggable(options: UseDraggableOptions = {}): UseDraggableReturn {
	const {
		onDragStart,
		onDragMove,
		onDragEnd,
		disabled = false,
		transformCoordinates: customTransformCoordinates,
		// Snapping-related options
		objectId,
		objectBounds,
		rotation = 0,
		pivotX = 0.5,
		pivotY = 0.5,
		snapDrag,
		autoGrabPoint = false
	} = options

	// Get SvgCanvas context for automatic coordinate transformation
	const canvasContext = useSvgCanvas()

	// Use canvas context transform if available, otherwise fall back to custom or default
	const transformCoordinates = React.useMemo(
		() => customTransformCoordinates ?? createCanvasTransform(canvasContext.translateTo),
		[customTransformCoordinates, canvasContext.translateTo]
	)

	const [isDragging, setIsDragging] = React.useState(false)

	// Refs for stable callbacks in event handlers
	const stateRef = React.useRef<{
		startX: number
		startY: number
		element: Element | null
		pointerId: number
		// Snapping context
		objectStartX: number
		objectStartY: number
		grabPoint: Point
		currentPosition: Point  // Track current position for final commit
	}>({
		startX: 0,
		startY: 0,
		element: null,
		pointerId: -1,
		objectStartX: 0,
		objectStartY: 0,
		grabPoint: { x: 0.5, y: 0.5 },
		currentPosition: { x: 0, y: 0 }
	})

	const optionsRef = React.useRef(options)
	optionsRef.current = options

	const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
		if (disabled) return
		if (e.button !== 0) return // Only primary button

		e.preventDefault()
		e.stopPropagation()

		const element = e.currentTarget as Element
		const coords = transformCoordinates(e.clientX, e.clientY, element)

		// Get object bounds for snapping (from options or infer from coords)
		const { objectBounds, rotation = 0, pivotX = 0.5, pivotY = 0.5, autoGrabPoint } = optionsRef.current
		const objX = objectBounds?.x ?? coords.x
		const objY = objectBounds?.y ?? coords.y
		const objW = objectBounds?.width ?? 0
		const objH = objectBounds?.height ?? 0

		// Compute grab point if requested
		let grabPoint: Point = { x: 0.5, y: 0.5 }
		if (autoGrabPoint && objectBounds && objW > 0 && objH > 0) {
			grabPoint = computeGrabPoint(
				{ x: coords.x, y: coords.y },
				{
					x: objX,
					y: objY,
					width: objW,
					height: objH,
					rotation,
					pivotX,
					pivotY
				}
			)
		}

		stateRef.current = {
			startX: coords.x,
			startY: coords.y,
			element,
			pointerId: e.pointerId,
			objectStartX: objX,
			objectStartY: objY,
			grabPoint,
			currentPosition: { x: objX, y: objY }
		}

		setIsDragging(true)
		onDragStart?.({
			x: coords.x,
			y: coords.y,
			clientX: e.clientX,
			clientY: e.clientY
		})

		const handlePointerMove = (moveEvent: PointerEvent) => {
			const { startX, startY, element, objectStartX, objectStartY, grabPoint, pointerId } = stateRef.current
			if (!element || moveEvent.pointerId !== pointerId) return

			const opts = optionsRef.current
			const moveCoords = opts.transformCoordinates?.(
				moveEvent.clientX,
				moveEvent.clientY,
				element
			) ?? transformCoordinates(moveEvent.clientX, moveEvent.clientY, element)

			const deltaX = moveCoords.x - startX
			const deltaY = moveCoords.y - startY

			// Calculate proposed position (object origin + delta)
			const proposedX = objectStartX + deltaX
			const proposedY = objectStartY + deltaY

			// Apply snapping if available
			let finalPosition: Point = { x: proposedX, y: proposedY }
			if (opts.snapDrag && opts.objectId && opts.objectBounds) {
				const snapResult = opts.snapDrag({
					bounds: {
						x: proposedX,
						y: proposedY,
						width: opts.objectBounds.width,
						height: opts.objectBounds.height,
						rotation: opts.rotation ?? 0,
						pivotX: opts.pivotX ?? 0.5,
						pivotY: opts.pivotY ?? 0.5
					},
					objectId: opts.objectId,
					delta: { x: deltaX, y: deltaY },
					grabPoint,
					excludeIds: new Set([opts.objectId])
				})
				finalPosition = snapResult.position
			}

			// Track current position for final commit
			stateRef.current.currentPosition = finalPosition

			opts.onDragMove?.({
				x: moveCoords.x,
				y: moveCoords.y,
				startX,
				startY,
				deltaX,
				deltaY,
				clientX: moveEvent.clientX,
				clientY: moveEvent.clientY,
				position: finalPosition,
				grabPoint
			})
		}

		const handlePointerUp = (upEvent: PointerEvent) => {
			const { startX, startY, element, currentPosition, pointerId } = stateRef.current
			if (!element || upEvent.pointerId !== pointerId) return

			const upCoords = optionsRef.current.transformCoordinates?.(
				upEvent.clientX,
				upEvent.clientY,
				element
			) ?? transformCoordinates(upEvent.clientX, upEvent.clientY, element)

			setIsDragging(false)
			optionsRef.current.onDragEnd?.({
				x: upCoords.x,
				y: upCoords.y,
				startX,
				startY,
				position: currentPosition
			})

			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
			window.removeEventListener('pointercancel', handlePointerUp)
		}

		window.addEventListener('pointermove', handlePointerMove)
		window.addEventListener('pointerup', handlePointerUp)
		window.addEventListener('pointercancel', handlePointerUp)
	}, [disabled, transformCoordinates, onDragStart])

	return {
		isDragging,
		dragProps: {
			onPointerDown: handlePointerDown
		}
	}
}

// vim: ts=4
