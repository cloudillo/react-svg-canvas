/**
 * useResizable hook - provides resize interaction for selected objects
 * Uses window-level events for smooth resizing
 */

import React from 'react'
import type { Bounds, ResizeHandle, Point, ResizeStartEvent, ResizeMoveEvent, ResizeEndEvent } from '../types'
import { resizeBounds } from '../geometry/bounds'
import { svgTransformCoordinates } from './useDraggable'

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
}

export interface UseResizableReturn {
	/** Whether currently resizing */
	isResizing: boolean
	/** Which handle is active */
	activeHandle: ResizeHandle | null
	/** Handler to start resize from a handle */
	handleResizeStart: (handle: ResizeHandle, e: React.MouseEvent) => void
}

export function useResizable(options: UseResizableOptions): UseResizableReturn {
	const {
		bounds,
		minWidth = 1,
		minHeight = 1,
		onResizeStart,
		onResize,
		onResizeEnd,
		disabled = false,
		transformCoordinates = svgTransformCoordinates
	} = options

	const [isResizing, setIsResizing] = React.useState(false)
	const [activeHandle, setActiveHandle] = React.useState<ResizeHandle | null>(null)

	// Refs for stable state in event handlers
	const stateRef = React.useRef<{
		handle: ResizeHandle
		startX: number
		startY: number
		originalBounds: Bounds
		element: Element | null
	} | null>(null)

	const optionsRef = React.useRef(options)
	optionsRef.current = options

	const handleResizeStart = React.useCallback((handle: ResizeHandle, e: React.MouseEvent) => {
		if (disabled) return

		e.preventDefault()
		e.stopPropagation()

		const target = e.target as Element
		const element = target instanceof SVGElement
			? (target.ownerSVGElement || target)
			: target
		const coords = transformCoordinates(e.clientX, e.clientY, element)

		const state = {
			handle,
			startX: coords.x,
			startY: coords.y,
			originalBounds: { ...bounds },
			element
		}

		stateRef.current = state
		setIsResizing(true)
		setActiveHandle(handle)

		onResizeStart?.({
			handle,
			bounds: { ...bounds }
		})

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const currentState = stateRef.current
			if (!currentState || !currentState.element) return

			const moveCoords = optionsRef.current.transformCoordinates?.(
				moveEvent.clientX,
				moveEvent.clientY,
				currentState.element
			) ?? transformCoordinates(moveEvent.clientX, moveEvent.clientY, currentState.element)

			const deltaX = moveCoords.x - currentState.startX
			const deltaY = moveCoords.y - currentState.startY

			const newBounds = resizeBounds(
				currentState.originalBounds,
				currentState.handle,
				deltaX,
				deltaY,
				optionsRef.current.minWidth ?? 1,
				optionsRef.current.minHeight ?? 1
			)

			optionsRef.current.onResize?.({
				handle: currentState.handle,
				bounds: newBounds,
				originalBounds: currentState.originalBounds
			})
		}

		const handleMouseUp = () => {
			const currentState = stateRef.current
			if (currentState) {
				optionsRef.current.onResizeEnd?.({
					handle: currentState.handle,
					bounds: optionsRef.current.bounds,
					originalBounds: currentState.originalBounds
				})
			}

			stateRef.current = null
			setIsResizing(false)
			setActiveHandle(null)

			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('mouseup', handleMouseUp)
		}

		window.addEventListener('mousemove', handleMouseMove)
		window.addEventListener('mouseup', handleMouseUp)
	}, [disabled, bounds, transformCoordinates, onResizeStart])

	return {
		isResizing,
		activeHandle,
		handleResizeStart
	}
}

// vim: ts=4
