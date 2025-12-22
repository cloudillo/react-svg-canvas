/**
 * useRotatable hook - provides rotation interaction with snap zones
 * Uses window-level events for reliability outside element bounds
 *
 * When used inside SvgCanvas, automatically uses the canvas coordinate
 * transform (translateTo/translateFrom) for correct pan/zoom handling.
 */

import React from 'react'
import type { Point } from '../types'
import type { RotatableOptions, RotationState } from './types'
import { INITIAL_ROTATION_STATE } from './types'
import {
	getAngleFromCenter,
	snapAngle,
	getPivotPosition,
	isInSnapZone,
	getMaxDistanceFromPivot,
	DEFAULT_SNAP_ANGLES,
	DEFAULT_SNAP_ZONE_RATIO
} from './rotation-utils'
import { normalizeAngle } from '../geometry/math'
import { useSvgCanvas } from '../svgcanvas'

export interface UseRotatableReturn {
	/** Current rotation state */
	rotationState: RotationState
	/** Start rotation from a pointer event (attach to rotation handle) */
	handleRotateStart: (e: React.PointerEvent) => void
	/** Get props to spread onto the rotation handle element */
	rotateProps: {
		onPointerDown: (e: React.PointerEvent) => void
	}
	/** Check if a canvas point is in the snap zone */
	checkSnapZone: (canvasPoint: Point) => boolean
	/** Get the arc radius for the rotation handle */
	arcRadius: number
	/** Get the pivot position in canvas coordinates */
	pivotPosition: Point
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

export function useRotatable(options: RotatableOptions): UseRotatableReturn {
	const {
		bounds,
		rotation,
		pivotX = 0.5,
		pivotY = 0.5,
		snapAngles = DEFAULT_SNAP_ANGLES,
		snapZoneRatio = DEFAULT_SNAP_ZONE_RATIO,
		translateTo: customTranslateTo,
		translateFrom: customTranslateFrom,
		screenSpaceSnapZone,
		onRotateStart,
		onRotate,
		onRotateEnd,
		disabled = false
	} = options

	// Get SvgCanvas context for automatic coordinate transformation
	const canvasContext = useSvgCanvas()

	// Use canvas context transform if available, otherwise fall back to custom
	const translateTo = customTranslateTo ?? canvasContext.translateTo
	const translateFrom = customTranslateFrom ?? canvasContext.translateFrom

	const [rotationState, setRotationState] = React.useState<RotationState>(INITIAL_ROTATION_STATE)

	// Refs for stable callbacks in event handlers
	const optionsRef = React.useRef(options)
	optionsRef.current = options

	// Refs for resolved transforms (includes canvas context fallback)
	const translateToRef = React.useRef(translateTo)
	translateToRef.current = translateTo
	const translateFromRef = React.useRef(translateFrom)
	translateFromRef.current = translateFrom

	const stateRef = React.useRef<{
		startAngle: number
		initialRotation: number
		center: Point
		arcRadius: number
		screenArcRadius: number // Screen-space arc radius for snap zone check
		element: Element | null
		pointerId: number
	}>({
		startAngle: 0,
		initialRotation: 0,
		center: { x: 0, y: 0 },
		arcRadius: 0,
		screenArcRadius: 0,
		element: null,
		pointerId: -1
	})

	// Calculate pivot position and arc radius
	const pivotPosition = React.useMemo(
		() => getPivotPosition(bounds, pivotX, pivotY),
		[bounds, pivotX, pivotY]
	)

	const arcRadius = React.useMemo(() => {
		const maxDist = getMaxDistanceFromPivot(bounds, pivotX, pivotY)
		return maxDist + 25 // Add padding for handle
	}, [bounds, pivotX, pivotY])

	// Check if a point is in the snap zone
	// When screenSpaceSnapZone is true, expects screen-space point; otherwise canvas-space
	const checkSnapZone = React.useCallback(
		(point: Point, isScreenSpace: boolean = false): boolean => {
			const opts = optionsRef.current
			const currentTranslateFrom = translateFromRef.current
			if (opts.screenSpaceSnapZone && currentTranslateFrom && isScreenSpace) {
				// Convert pivot to screen space and check there
				const [screenPivotX, screenPivotY] = currentTranslateFrom(pivotPosition.x, pivotPosition.y)
				const screenPivot = { x: screenPivotX, y: screenPivotY }
				// Use a fixed screen-space arc radius (approximate visual size)
				const screenArcRadius = arcRadius // This is passed through as visual size
				return isInSnapZone(point, screenPivot, screenArcRadius, opts.snapZoneRatio ?? DEFAULT_SNAP_ZONE_RATIO)
			}
			// Default: canvas-space check
			return isInSnapZone(point, pivotPosition, arcRadius, opts.snapZoneRatio ?? DEFAULT_SNAP_ZONE_RATIO)
		},
		[pivotPosition, arcRadius]
	)

	const handleRotateStart = React.useCallback(
		(e: React.PointerEvent) => {
			if (disabled) return

			e.preventDefault()
			e.stopPropagation()

			const element = e.currentTarget as Element
			const svg = (element as SVGElement).ownerSVGElement
			if (!svg) return

			const rect = svg.getBoundingClientRect()
			const opts = optionsRef.current
			const currentTranslateTo = translateToRef.current
			const currentTranslateFrom = translateFromRef.current

			// Get fresh values using getters if provided (avoids stale closure issues with CRDT)
			const currentBounds = opts.getBounds ? opts.getBounds() : opts.bounds
			const currentRotation = opts.getRotation ? opts.getRotation() : opts.rotation
			const currentPivot = opts.getPivot
				? opts.getPivot()
				: { x: opts.pivotX ?? 0.5, y: opts.pivotY ?? 0.5 }

			// Get canvas coordinates using provided transform or fallback
			const [x, y] = currentTranslateTo
				? currentTranslateTo(e.clientX - rect.left, e.clientY - rect.top)
				: fallbackTransform(svg, e.clientX, e.clientY)

			const canvasPoint: Point = { x, y }
			const pivot = getPivotPosition(
				currentBounds,
				currentPivot.x,
				currentPivot.y
			)
			const startAngle = getAngleFromCenter(pivot, canvasPoint)

			// Check snap zone - use screen space if configured
			let inSnapZone: boolean
			let screenArcRadius = arcRadius // Default to canvas-space radius
			if (opts.screenSpaceSnapZone && currentTranslateFrom) {
				const screenPoint: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
				const [screenPivotX, screenPivotY] = currentTranslateFrom(pivot.x, pivot.y)
				const screenPivot = { x: screenPivotX, y: screenPivotY }
				// Calculate screen-space arc radius by transforming a point on the arc
				const [screenArcPointX, screenArcPointY] = currentTranslateFrom(pivot.x + arcRadius, pivot.y)
				screenArcRadius = Math.sqrt(
					Math.pow(screenArcPointX - screenPivotX, 2) +
					Math.pow(screenArcPointY - screenPivotY, 2)
				)
				inSnapZone = isInSnapZone(screenPoint, screenPivot, screenArcRadius, opts.snapZoneRatio ?? DEFAULT_SNAP_ZONE_RATIO)
			} else {
				inSnapZone = isInSnapZone(canvasPoint, pivot, arcRadius, opts.snapZoneRatio ?? DEFAULT_SNAP_ZONE_RATIO)
			}

			stateRef.current = {
				startAngle,
				initialRotation: currentRotation,
				center: pivot,
				arcRadius,
				screenArcRadius, // Store screen-space radius for move handler
				element,
				pointerId: e.pointerId
			}

			setRotationState({
				isRotating: true,
				startAngle,
				currentAngle: startAngle,
				centerX: pivot.x,
				centerY: pivot.y,
				isInSnapZone: inSnapZone
			})

			onRotateStart?.(startAngle)

			const handlePointerMove = (moveEvent: PointerEvent) => {
				const { startAngle, initialRotation, center, arcRadius, screenArcRadius, element, pointerId } = stateRef.current
				if (moveEvent.pointerId !== pointerId) return

				const svg = (element as SVGElement)?.ownerSVGElement
				if (!svg) return

				const opts = optionsRef.current
				const currentTranslateTo = translateToRef.current
				const currentTranslateFrom = translateFromRef.current
				const rect = svg.getBoundingClientRect()

				// Get canvas coordinates using provided transform or fallback
				const [moveX, moveY] = currentTranslateTo
					? currentTranslateTo(moveEvent.clientX - rect.left, moveEvent.clientY - rect.top)
					: fallbackTransform(svg, moveEvent.clientX, moveEvent.clientY)

				const canvasPoint: Point = { x: moveX, y: moveY }
				const currentAngle = getAngleFromCenter(center, canvasPoint)

				// Check snap zone - use screen space if configured
				let inSnapZone: boolean
				if (opts.screenSpaceSnapZone && currentTranslateFrom) {
					const screenPoint: Point = { x: moveEvent.clientX - rect.left, y: moveEvent.clientY - rect.top }
					const [screenPivotX, screenPivotY] = currentTranslateFrom(center.x, center.y)
					const screenPivot = { x: screenPivotX, y: screenPivotY }
					// Use screen-space arc radius captured at drag start
					inSnapZone = isInSnapZone(screenPoint, screenPivot, screenArcRadius, opts.snapZoneRatio ?? DEFAULT_SNAP_ZONE_RATIO)
				} else {
					inSnapZone = isInSnapZone(canvasPoint, center, arcRadius, opts.snapZoneRatio ?? DEFAULT_SNAP_ZONE_RATIO)
				}

				// Calculate delta angle
				let deltaAngle = currentAngle - startAngle
				// Handle wrap-around
				if (deltaAngle > 180) deltaAngle -= 360
				if (deltaAngle < -180) deltaAngle += 360

				// Calculate new rotation
				let newRotation = normalizeAngle(initialRotation + deltaAngle)

				// Apply snapping if in snap zone
				// When inside snap zone, always snap to nearest angle (use large threshold)
				let isSnapped = false
				if (inSnapZone) {
					const snapAngles = opts.snapAngles ?? DEFAULT_SNAP_ANGLES
					// Use half the interval as threshold to always snap to nearest when in zone
					const interval = snapAngles.length > 1 ? snapAngles[1] - snapAngles[0] : 15
					const snapResult = snapAngle(newRotation, snapAngles, interval / 2 + 1)
					newRotation = snapResult.angle
					isSnapped = snapResult.isSnapped
				}

				setRotationState(prev => ({
					...prev,
					currentAngle,
					isInSnapZone: inSnapZone
				}))

				opts.onRotate?.(newRotation, isSnapped)
			}

			const handlePointerUp = (upEvent: PointerEvent) => {
				const { startAngle, initialRotation, center, arcRadius, screenArcRadius, element, pointerId } = stateRef.current
				if (upEvent.pointerId !== pointerId) return

				const svg = (element as SVGElement)?.ownerSVGElement
				if (!svg) return

				const opts = optionsRef.current
				const currentTranslateTo = translateToRef.current
				const currentTranslateFrom = translateFromRef.current
				const rect = svg.getBoundingClientRect()

				// Get canvas coordinates using provided transform or fallback
				const [upX, upY] = currentTranslateTo
					? currentTranslateTo(upEvent.clientX - rect.left, upEvent.clientY - rect.top)
					: fallbackTransform(svg, upEvent.clientX, upEvent.clientY)

				const canvasPoint: Point = { x: upX, y: upY }
				const finalAngle = getAngleFromCenter(center, canvasPoint)

				// Check snap zone - use screen space if configured
				let inSnapZone: boolean
				if (opts.screenSpaceSnapZone && currentTranslateFrom) {
					const screenPoint: Point = { x: upEvent.clientX - rect.left, y: upEvent.clientY - rect.top }
					const [screenPivotX, screenPivotY] = currentTranslateFrom(center.x, center.y)
					const screenPivot = { x: screenPivotX, y: screenPivotY }
					// Use screen-space arc radius captured at drag start
					inSnapZone = isInSnapZone(screenPoint, screenPivot, screenArcRadius, opts.snapZoneRatio ?? DEFAULT_SNAP_ZONE_RATIO)
				} else {
					inSnapZone = isInSnapZone(canvasPoint, center, arcRadius, opts.snapZoneRatio ?? DEFAULT_SNAP_ZONE_RATIO)
				}

				// Calculate final rotation
				let deltaAngle = finalAngle - startAngle
				if (deltaAngle > 180) deltaAngle -= 360
				if (deltaAngle < -180) deltaAngle += 360

				let newRotation = normalizeAngle(initialRotation + deltaAngle)

				// Apply snapping if in snap zone
				// When inside snap zone, always snap to nearest angle (use large threshold)
				if (inSnapZone) {
					const snapAngles = opts.snapAngles ?? DEFAULT_SNAP_ANGLES
					const interval = snapAngles.length > 1 ? snapAngles[1] - snapAngles[0] : 15
					const snapResult = snapAngle(newRotation, snapAngles, interval / 2 + 1)
					newRotation = snapResult.angle
				}

				setRotationState(INITIAL_ROTATION_STATE)
				opts.onRotateEnd?.(newRotation)

				window.removeEventListener('pointermove', handlePointerMove)
				window.removeEventListener('pointerup', handlePointerUp)
				window.removeEventListener('pointercancel', handlePointerUp)
			}

			window.addEventListener('pointermove', handlePointerMove)
			window.addEventListener('pointerup', handlePointerUp)
			window.addEventListener('pointercancel', handlePointerUp)
		},
		[disabled, arcRadius, onRotateStart]
	)

	return {
		rotationState,
		handleRotateStart,
		rotateProps: {
			onPointerDown: handleRotateStart
		},
		checkSnapZone,
		arcRadius,
		pivotPosition
	}
}

// vim: ts=4
