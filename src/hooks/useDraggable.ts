/**
 * useDraggable hook - provides smooth drag interaction
 * Uses window-level events for reliability outside element bounds
 */

import React from 'react'
import type { DragStartEvent, DragMoveEvent, DragEndEvent, Point } from '../types'

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
}

export interface UseDraggableReturn {
	/** Whether currently dragging */
	isDragging: boolean
	/** Props to spread onto the draggable element */
	dragProps: {
		onMouseDown: (e: React.MouseEvent) => void
		onTouchStart: (e: React.TouchEvent) => void
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
 * SVG coordinate transformer using CTM
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

export function useDraggable(options: UseDraggableOptions = {}): UseDraggableReturn {
	const {
		onDragStart,
		onDragMove,
		onDragEnd,
		disabled = false,
		transformCoordinates = defaultTransformCoordinates
	} = options

	const [isDragging, setIsDragging] = React.useState(false)

	// Refs for stable callbacks in event handlers
	const stateRef = React.useRef<{
		startX: number
		startY: number
		element: Element | null
	}>({ startX: 0, startY: 0, element: null })

	const optionsRef = React.useRef(options)
	optionsRef.current = options

	const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
		if (disabled) return
		if (e.button !== 0) return // Only left button

		e.preventDefault()
		e.stopPropagation()

		const element = e.currentTarget as Element
		const coords = transformCoordinates(e.clientX, e.clientY, element)

		stateRef.current = {
			startX: coords.x,
			startY: coords.y,
			element
		}

		setIsDragging(true)
		onDragStart?.({
			x: coords.x,
			y: coords.y,
			clientX: e.clientX,
			clientY: e.clientY
		})

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const { startX, startY, element } = stateRef.current
			if (!element) return

			const moveCoords = optionsRef.current.transformCoordinates?.(
				moveEvent.clientX,
				moveEvent.clientY,
				element
			) ?? transformCoordinates(moveEvent.clientX, moveEvent.clientY, element)

			optionsRef.current.onDragMove?.({
				x: moveCoords.x,
				y: moveCoords.y,
				startX,
				startY,
				deltaX: moveCoords.x - startX,
				deltaY: moveCoords.y - startY,
				clientX: moveEvent.clientX,
				clientY: moveEvent.clientY
			})
		}

		const handleMouseUp = (upEvent: MouseEvent) => {
			const { startX, startY, element } = stateRef.current
			if (!element) return

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
				startY
			})

			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('mouseup', handleMouseUp)
		}

		window.addEventListener('mousemove', handleMouseMove)
		window.addEventListener('mouseup', handleMouseUp)
	}, [disabled, transformCoordinates, onDragStart])

	const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
		if (disabled) return
		if (e.touches.length !== 1) return

		e.preventDefault()
		e.stopPropagation()

		const touch = e.touches[0]
		const element = e.currentTarget as Element
		const coords = transformCoordinates(touch.clientX, touch.clientY, element)

		stateRef.current = {
			startX: coords.x,
			startY: coords.y,
			element
		}

		setIsDragging(true)
		onDragStart?.({
			x: coords.x,
			y: coords.y,
			clientX: touch.clientX,
			clientY: touch.clientY
		})

		const handleTouchMove = (moveEvent: TouchEvent) => {
			if (moveEvent.touches.length !== 1) return

			const moveTouch = moveEvent.touches[0]
			const { startX, startY, element } = stateRef.current
			if (!element) return

			const moveCoords = optionsRef.current.transformCoordinates?.(
				moveTouch.clientX,
				moveTouch.clientY,
				element
			) ?? transformCoordinates(moveTouch.clientX, moveTouch.clientY, element)

			optionsRef.current.onDragMove?.({
				x: moveCoords.x,
				y: moveCoords.y,
				startX,
				startY,
				deltaX: moveCoords.x - startX,
				deltaY: moveCoords.y - startY,
				clientX: moveTouch.clientX,
				clientY: moveTouch.clientY
			})
		}

		const handleTouchEnd = (endEvent: TouchEvent) => {
			const { startX, startY } = stateRef.current

			setIsDragging(false)
			optionsRef.current.onDragEnd?.({
				x: startX, // No final position on touch end
				y: startY,
				startX,
				startY
			})

			window.removeEventListener('touchmove', handleTouchMove)
			window.removeEventListener('touchend', handleTouchEnd)
		}

		window.addEventListener('touchmove', handleTouchMove, { passive: false })
		window.addEventListener('touchend', handleTouchEnd)
	}, [disabled, transformCoordinates, onDragStart])

	return {
		isDragging,
		dragProps: {
			onMouseDown: handleMouseDown,
			onTouchStart: handleTouchStart
		}
	}
}

// vim: ts=4
