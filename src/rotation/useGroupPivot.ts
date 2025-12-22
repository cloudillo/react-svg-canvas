/**
 * useGroupPivot hook - provides group pivot for multi-select rotation
 * When multiple objects are selected, they rotate around a shared group pivot
 */

import React from 'react'
import type { Point, Bounds } from '../types'
import type { GroupPivotOptions, GroupPivotState, TransformedObject, RotatedObjectBounds } from './types'
import { INITIAL_GROUP_PIVOT_STATE } from './types'
import { rotateObjectAroundPivot } from './rotation-utils'

export interface UseGroupPivotReturn {
	/** Current group pivot state */
	groupPivotState: GroupPivotState
	/** Group pivot position in canvas coordinates */
	groupPivot: Point
	/** Start group pivot drag from a pointer event */
	handleGroupPivotDragStart: (e: React.PointerEvent) => void
	/** Get props to spread onto the group pivot handle element */
	groupPivotDragProps: {
		onPointerDown: (e: React.PointerEvent) => void
	}
	/** Rotate all objects around the group pivot by a delta angle */
	rotateObjectsAroundPivot: (deltaAngle: number) => TransformedObject[]
	/** Reset group pivot to center of selection */
	resetPivotToCenter: () => void
	/** Set custom group pivot position */
	setGroupPivot: (pivot: Point) => void
}

/**
 * Calculate the center of a selection bounds
 */
function getSelectionCenter(bounds: Bounds): Point {
	return {
		x: bounds.x + bounds.width / 2,
		y: bounds.y + bounds.height / 2
	}
}

export function useGroupPivot(options: GroupPivotOptions): UseGroupPivotReturn {
	const {
		objects,
		selectionBounds,
		onDragStart,
		onDrag,
		onDragEnd,
		onRotate,
		disabled = false
	} = options

	// Calculate default center when selection changes
	const defaultCenter = React.useMemo(
		() => getSelectionCenter(selectionBounds),
		[selectionBounds]
	)

	const [groupPivotState, setGroupPivotState] = React.useState<GroupPivotState>({
		...INITIAL_GROUP_PIVOT_STATE,
		pivotX: defaultCenter.x,
		pivotY: defaultCenter.y
	})

	// Reset to center when selection changes (unless custom pivot is set)
	React.useEffect(() => {
		if (!groupPivotState.isPivotCustom && !groupPivotState.isDragging) {
			setGroupPivotState(prev => ({
				...prev,
				pivotX: defaultCenter.x,
				pivotY: defaultCenter.y
			}))
		}
	}, [defaultCenter, groupPivotState.isPivotCustom, groupPivotState.isDragging])

	// Refs for stable callbacks
	const optionsRef = React.useRef(options)
	optionsRef.current = options

	const stateRef = React.useRef<{
		initialPivot: Point
		element: Element | null
	}>({
		initialPivot: { x: 0, y: 0 },
		element: null
	})

	// Get current group pivot
	const groupPivot: Point = React.useMemo(
		() => ({
			x: groupPivotState.pivotX,
			y: groupPivotState.pivotY
		}),
		[groupPivotState.pivotX, groupPivotState.pivotY]
	)

	// Rotate all objects around the group pivot
	const rotateObjectsAroundPivot = React.useCallback(
		(deltaAngle: number): TransformedObject[] => {
			const transformedObjects: TransformedObject[] = []

			for (const obj of optionsRef.current.objects) {
				const transformed = rotateObjectAroundPivot(
					obj.bounds,
					obj.rotation,
					groupPivot,
					deltaAngle
				)

				transformedObjects.push({
					id: obj.id,
					x: transformed.x,
					y: transformed.y,
					rotation: transformed.rotation
				})
			}

			optionsRef.current.onRotate?.(deltaAngle, transformedObjects)

			return transformedObjects
		},
		[groupPivot]
	)

	// Reset pivot to center
	const resetPivotToCenter = React.useCallback(() => {
		const center = getSelectionCenter(optionsRef.current.selectionBounds)
		setGroupPivotState({
			isDragging: false,
			pivotX: center.x,
			pivotY: center.y,
			isPivotCustom: false
		})
	}, [])

	// Set custom pivot
	const setGroupPivot = React.useCallback((pivot: Point) => {
		setGroupPivotState({
			isDragging: false,
			pivotX: pivot.x,
			pivotY: pivot.y,
			isPivotCustom: true
		})
	}, [])

	// Handle group pivot drag
	const handleGroupPivotDragStart = React.useCallback(
		(e: React.PointerEvent) => {
			if (disabled) return

			e.preventDefault()
			e.stopPropagation()

			const element = e.currentTarget as Element
			const svg = (element as SVGElement).ownerSVGElement
			if (!svg) return

			const initialPivot: Point = {
				x: groupPivotState.pivotX,
				y: groupPivotState.pivotY
			}

			stateRef.current = {
				initialPivot,
				element
			}

			setGroupPivotState(prev => ({
				...prev,
				isDragging: true,
				isPivotCustom: true
			}))

			onDragStart?.(initialPivot)

			const handlePointerMove = (moveEvent: PointerEvent) => {
				const svg = (stateRef.current.element as SVGElement)?.ownerSVGElement
				if (!svg) return

				const ctm = svg.getScreenCTM()
				if (!ctm) return

				// Get canvas coordinates
				const point = svg.createSVGPoint()
				point.x = moveEvent.clientX
				point.y = moveEvent.clientY
				const svgPoint = point.matrixTransform(ctm.inverse())

				const newPivot: Point = { x: svgPoint.x, y: svgPoint.y }

				setGroupPivotState(prev => ({
					...prev,
					pivotX: newPivot.x,
					pivotY: newPivot.y
				}))

				optionsRef.current.onDrag?.(newPivot)
			}

			const handlePointerUp = (upEvent: PointerEvent) => {
				const svg = (stateRef.current.element as SVGElement)?.ownerSVGElement
				if (!svg) return

				const ctm = svg.getScreenCTM()
				if (!ctm) return

				const point = svg.createSVGPoint()
				point.x = upEvent.clientX
				point.y = upEvent.clientY
				const svgPoint = point.matrixTransform(ctm.inverse())

				const finalPivot: Point = { x: svgPoint.x, y: svgPoint.y }

				setGroupPivotState(prev => ({
					...prev,
					isDragging: false,
					pivotX: finalPivot.x,
					pivotY: finalPivot.y
				}))

				optionsRef.current.onDragEnd?.(finalPivot)

				window.removeEventListener('pointermove', handlePointerMove)
				window.removeEventListener('pointerup', handlePointerUp)
			}

			window.addEventListener('pointermove', handlePointerMove)
			window.addEventListener('pointerup', handlePointerUp)
		},
		[disabled, groupPivotState.pivotX, groupPivotState.pivotY, onDragStart]
	)

	return {
		groupPivotState,
		groupPivot,
		handleGroupPivotDragStart,
		groupPivotDragProps: {
			onPointerDown: handleGroupPivotDragStart
		},
		rotateObjectsAroundPivot,
		resetPivotToCenter,
		setGroupPivot
	}
}

// vim: ts=4
