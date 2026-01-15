/**
 * usePivotDrag hook - provides pivot point drag interaction with snapping
 * Includes position compensation calculation for rotated objects
 *
 * Uses delta-based approach:
 * 1. Capture start position on drag start
 * 2. Calculate delta in canvas space
 * 3. Un-rotate delta to get local movement
 * 4. Convert to pivot delta
 *
 * When used inside SvgCanvas, automatically uses the canvas coordinate
 * transform (translateTo) for correct pan/zoom handling.
 */

import React from 'react'
import type { Point } from '../types'
import type { PivotDragOptions, PivotState } from './types'
import { INITIAL_PIVOT_STATE, DEFAULT_PIVOT_SNAP_POINTS } from './types'
import {
	snapPivot,
	clampPivot,
	calculatePivotCompensation,
	DEFAULT_PIVOT_SNAP_THRESHOLD
} from './rotation-utils'
import { useSvgCanvas } from '../svgcanvas'

export interface UsePivotDragReturn {
	/** Current pivot state */
	pivotState: PivotState
	/** Start pivot drag from a pointer event (attach to pivot handle) */
	handlePivotDragStart: (e: React.PointerEvent) => void
	/** Get props to spread onto the pivot handle element */
	pivotDragProps: {
		onPointerDown: (e: React.PointerEvent) => void
	}
	/** Calculate position compensation for a pivot change */
	getPositionCompensation: (oldPivot: Point, newPivot: Point) => Point
}

/**
 * Fallback coordinate transform using getScreenCTM
 * Used when translateTo is not provided
 */
function fallbackTransform(
	svg: SVGSVGElement,
	clientX: number,
	clientY: number
): [number, number] {
	const ctm = svg.getScreenCTM()
	if (!ctm) return [0, 0]

	const point = svg.createSVGPoint()
	point.x = clientX
	point.y = clientY
	const svgPoint = point.matrixTransform(ctm.inverse())
	return [svgPoint.x, svgPoint.y]
}

export function usePivotDrag(options: PivotDragOptions): UsePivotDragReturn {
	const {
		bounds,
		rotation,
		pivotX,
		pivotY,
		snapPoints = DEFAULT_PIVOT_SNAP_POINTS,
		snapThreshold = DEFAULT_PIVOT_SNAP_THRESHOLD,
		translateTo: customTranslateTo,
		onPointerDown,
		onDragStart,
		onDrag,
		onDragEnd,
		disabled = false
	} = options

	// Get SvgCanvas context for automatic coordinate transformation
	const canvasContext = useSvgCanvas()

	// Use canvas context transform if available, otherwise fall back to custom
	const translateTo = customTranslateTo ?? canvasContext.translateTo

	const [pivotState, setPivotState] = React.useState<PivotState>({
		...INITIAL_PIVOT_STATE,
		pivotX,
		pivotY
	})

	// Track previous props to detect when parent updates
	const prevPropsRef = React.useRef<Point>({ x: pivotX, y: pivotY })

	// Update state when props actually change (parent pushed new values)
	React.useEffect(() => {
		const propsChanged =
			Math.abs(pivotX - prevPropsRef.current.x) > 0.001 ||
			Math.abs(pivotY - prevPropsRef.current.y) > 0.001

		prevPropsRef.current = { x: pivotX, y: pivotY }

		if (!pivotState.isDragging && propsChanged) {
			setPivotState(prev => ({
				...prev,
				pivotX,
				pivotY
			}))
		}
	}, [pivotX, pivotY, pivotState.isDragging])

	// Refs for stable callbacks in event handlers
	const optionsRef = React.useRef(options)
	optionsRef.current = options

	// Ref for resolved transform (includes canvas context fallback)
	const translateToRef = React.useRef(translateTo)
	translateToRef.current = translateTo

	// Movement threshold in canvas pixels to distinguish clicks from drags
	const DRAG_THRESHOLD = 3

	const stateRef = React.useRef<{
		initialPivot: Point
		currentPivot: Point
		startPoint: Point  // Start position in canvas coords
		initialBounds: { x: number; y: number; width: number; height: number }  // Captured at drag start
		initialRotation: number  // Captured at drag start
		svg: SVGSVGElement | null
		pointerId: number
		dragStarted: boolean  // True once movement exceeds threshold
	}>({
		initialPivot: { x: pivotX, y: pivotY },
		currentPivot: { x: pivotX, y: pivotY },
		startPoint: { x: 0, y: 0 },
		initialBounds: { x: 0, y: 0, width: 100, height: 100 },
		initialRotation: 0,
		svg: null,
		pointerId: -1,
		dragStarted: false
	})

	// Calculate position compensation for a pivot change
	const getPositionCompensation = React.useCallback(
		(oldPivot: Point, newPivot: Point): Point => {
			return calculatePivotCompensation(oldPivot, newPivot, bounds, rotation)
		},
		[bounds, rotation]
	)

	const handlePivotDragStart = React.useCallback(
		(e: React.PointerEvent) => {
			if (disabled) return

			// Note: We intentionally don't call e.stopPropagation() or e.preventDefault() here.
			// This allows clicks at the pivot point to reach objects below for selection/editing.
			// We only "claim" the interaction once actual movement is detected in handlePointerMove.

			const element = e.currentTarget as Element
			const svg = (element as SVGElement).ownerSVGElement
			if (!svg) return

			// Note: We don't use pointer capture because it redirects events to the element,
			// but we're using window event listeners. Window listeners work reliably
			// across the entire screen without needing pointer capture.

			const rect = svg.getBoundingClientRect()
			const currentTranslateTo = translateToRef.current
			const opts = optionsRef.current

			// Get fresh values using getters if provided (avoids stale closure issues with CRDT)
			const currentBounds = opts.getBounds ? opts.getBounds() : opts.bounds
			const currentRotation = opts.getRotation ? opts.getRotation() : opts.rotation
			const currentPivotPoint = opts.getPivot
				? opts.getPivot()
				: { x: opts.pivotX, y: opts.pivotY }

			// Get start position using provided transform or fallback
			const [startX, startY] = currentTranslateTo
				? currentTranslateTo(e.clientX - rect.left, e.clientY - rect.top)
				: fallbackTransform(svg, e.clientX, e.clientY)

			const initialPivot: Point = {
				x: currentPivotPoint.x,
				y: currentPivotPoint.y
			}

			stateRef.current = {
				initialPivot,
				currentPivot: initialPivot,
				startPoint: { x: startX, y: startY },
				initialBounds: { ...currentBounds },
				initialRotation: currentRotation,
				svg,
				pointerId: e.pointerId,
				dragStarted: false  // Will be set true once movement exceeds threshold
			}

			// Call onPointerDown immediately - this allows callers to set flags
			// (e.g., to prevent canvas click from clearing selection)
			optionsRef.current.onPointerDown?.()

			// Don't set isDragging: true or call onDragStart yet - wait for actual movement

			const handlePointerMove = (moveEvent: PointerEvent) => {
				// Use captured initial values to prevent stale closure issues
				const { initialPivot, startPoint, initialBounds, initialRotation, svg, pointerId, dragStarted } = stateRef.current
				if (!svg || moveEvent.pointerId !== pointerId) return

				const currentTranslateTo = translateToRef.current
				const rect = svg.getBoundingClientRect()

				// Get current position using provided transform or fallback
				const [moveX, moveY] = currentTranslateTo
					? currentTranslateTo(moveEvent.clientX - rect.left, moveEvent.clientY - rect.top)
					: fallbackTransform(svg, moveEvent.clientX, moveEvent.clientY)

				// Delta from start in canvas space
				const dx = moveX - startPoint.x
				const dy = moveY - startPoint.y

				// Check if drag should start (movement exceeds threshold)
				if (!dragStarted) {
					const distance = Math.sqrt(dx * dx + dy * dy)
					if (distance < DRAG_THRESHOLD) {
						// Not enough movement yet - don't start drag
						return
					}
					// Movement exceeds threshold - start the drag now
					stateRef.current.dragStarted = true
					setPivotState(prev => ({
						...prev,
						isDragging: true,
						initialPivot
					}))
					optionsRef.current.onDragStart?.(initialPivot)
				}

				// Un-rotate delta to get movement in object-local space
				// Formula from prezillo: localDx = dx * cos + dy * sin; localDy = -dx * sin + dy * cos
				const radians = initialRotation * (Math.PI / 180)
				const cos = Math.cos(radians)
				const sin = Math.sin(radians)
				const localDx = dx * cos + dy * sin
				const localDy = -dx * sin + dy * cos

				// Convert to pivot delta (normalized by object dimensions)
				let newPivot: Point = {
					x: initialPivot.x + localDx / initialBounds.width,
					y: initialPivot.y + localDy / initialBounds.height
				}

				// Clamp to valid range
				newPivot = clampPivot(newPivot)

				// Apply snapping
				const snapResult = snapPivot(
					newPivot,
					optionsRef.current.snapPoints ?? DEFAULT_PIVOT_SNAP_POINTS,
					optionsRef.current.snapThreshold ?? DEFAULT_PIVOT_SNAP_THRESHOLD
				)

				// Calculate position compensation using captured initial values
				const compensation = calculatePivotCompensation(
					initialPivot,
					snapResult.pivot,
					initialBounds,
					initialRotation
				)

				// Update ref for use in handlePointerUp (state closure would be stale)
				stateRef.current.currentPivot = snapResult.pivot

				setPivotState(prev => ({
					...prev,
					pivotX: snapResult.pivot.x,
					pivotY: snapResult.pivot.y,
					snappedPoint: snapResult.snappedPoint
				}))

				optionsRef.current.onDrag?.(snapResult.pivot, snapResult.snappedPoint, compensation)
			}

			const handlePointerUp = (upEvent: PointerEvent) => {
				// Use captured initial values to prevent stale closure issues
				const { initialPivot, currentPivot, initialBounds, initialRotation, pointerId, dragStarted } = stateRef.current
				if (upEvent.pointerId !== pointerId) return

				// Clean up listeners first
				window.removeEventListener('pointermove', handlePointerMove)
				window.removeEventListener('pointerup', handlePointerUp)
				window.removeEventListener('pointercancel', handlePointerUp)

				// Only complete the drag if it actually started (movement exceeded threshold)
				if (!dragStarted) {
					// This was just a click - don't update pivot or call onDragEnd
					// The click event will propagate to objects below
					return
				}

				// Get final pivot from ref (state closure would be stale)
				const finalPivot: Point = currentPivot

				// Calculate final position compensation using captured initial values
				const compensation = calculatePivotCompensation(
					initialPivot,
					finalPivot,
					initialBounds,
					initialRotation
				)

				setPivotState(prev => ({
					...prev,
					pivotX: finalPivot.x,
					pivotY: finalPivot.y,
					isDragging: false,
					snappedPoint: null,
					initialPivot: null
				}))

				optionsRef.current.onDragEnd?.(finalPivot, compensation)
			}

			window.addEventListener('pointermove', handlePointerMove)
			window.addEventListener('pointerup', handlePointerUp)
			window.addEventListener('pointercancel', handlePointerUp)
		},
		[disabled, onDragStart]
	)

	return {
		pivotState,
		handlePivotDragStart,
		pivotDragProps: {
			onPointerDown: handlePivotDragStart
		},
		getPositionCompensation
	}
}

// vim: ts=4
