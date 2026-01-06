import React from 'react'

const SvgCanvasContext = React.createContext<{
	svg?: SVGSVGElement
	matrix: [number, number, number, number, number, number]
	scale: number
	translateTo: (x: number, y: number) => [number, number]
	translateFrom: (x: number, y: number) => [number, number]
	setDragHandler: React.Dispatch<React.SetStateAction<DragHandler | undefined>>
	startDrag: (evt: React.PointerEvent) => void
}>({
	matrix: [1, 0, 0, 1, 0, 0],
	scale: 1,
	translateTo: () => [0, 0],
	translateFrom: () => [0, 0],
	startDrag: () => {},
	setDragHandler: () => {}
})

export interface ToolEvent {
	startX: number
	startY: number
	x: number
	y: number
	shiftKey?: boolean
	ctrlKey?: boolean
	metaKey?: boolean
	altKey?: boolean
}

//////////////////
// useSvgCanvas //
//////////////////
export function useSvgCanvas() {
	return React.useContext(SvgCanvasContext)
}

/**
 * Context exposed to consumers via onContextReady callback
 */
export interface SvgCanvasContext {
	svg: SVGSVGElement | undefined
	matrix: [number, number, number, number, number, number]
	scale: number
	translateTo: (x: number, y: number) => [number, number]
	translateFrom: (x: number, y: number) => [number, number]
}

/**
 * Imperative handle for SvgCanvas
 */
export interface SvgCanvasHandle {
	/** Center the viewport on a specific point in canvas coordinates */
	centerOn: (x: number, y: number, zoom?: number) => void
	/** Center the viewport on a rectangle (fitting it in view) */
	centerOnRect: (x: number, y: number, width: number, height: number, padding?: number) => void
	/** Center the viewport on a rectangle with smooth animation */
	centerOnRectAnimated: (
		x: number,
		y: number,
		width: number,
		height: number,
		options?: {
			duration?: number
			padding?: number
			/** Zoom out factor during transition (0-1, e.g. 0.15 = zoom out 15% at midpoint) */
			zoomOutFactor?: number
		}
	) => void
	/** Check if a rectangle's center is currently visible in the viewport */
	isRectInView: (x: number, y: number, width: number, height: number) => boolean
	/** Get current matrix */
	getMatrix: () => [number, number, number, number, number, number]
	/** Set matrix directly */
	setMatrix: (matrix: [number, number, number, number, number, number]) => void
}

///////////////
// SvgCanvas //
///////////////
interface SvgCanvasProps {
	className?: string
	style?: React.CSSProperties
	children?: React.ReactNode
	fixed?: React.ReactNode
	onToolStart?: (e: ToolEvent) => void
	onToolMove?: (e: ToolEvent) => void
	onToolEnd?: () => void
	/** Callback fired on pointer move (for cursor tracking, etc.) */
	onMove?: (e: ToolEvent) => void
	/** Callback fired when the canvas context is ready or changes (zoom, pan, etc.) */
	onContextReady?: (context: SvgCanvasContext) => void
}

interface DragHandler {
	onDragMove: (evt: ToolEvent) => void
	onDragEnd?: () => void
}

// Track active pointers for multi-touch
interface ActivePointer {
	id: number
	x: number
	y: number
}

export const SvgCanvas = React.forwardRef<SvgCanvasHandle, SvgCanvasProps>(function SvgCanvas({
	className,
	style,
	children,
	fixed,
	onToolStart,
	onToolMove,
	onToolEnd,
	onMove,
	onContextReady
}, ref) {
	const svgRef = React.useRef<SVGSVGElement>(null)
	const [active, setActive] = React.useState<undefined>()
	// Use ref for pan state to avoid React batching delays and enable window-level event handling
	const panRef = React.useRef<{ lastX: number, lastY: number, pointerId: number } | null>(null)
	const [drag, setDrag] = React.useState<{ target: any, startX: number, startY: number, lastX: number, lastY: number } | undefined>()
	const [toolStart, setToolStart] = React.useState<{ startX: number, startY: number } | undefined>()
	const [dragHandler, setDragHandler] = React.useState<DragHandler | undefined>()
	const [matrix, setMatrix] = React.useState<[number, number, number, number, number, number]>([1, 0, 0, 1, 0, 0])

	// Track active pointers for multi-touch gestures
	const activePointersRef = React.useRef<Map<number, ActivePointer>>(new Map())
	const lastPinchDistanceRef = React.useRef<number | undefined>(undefined)
	const lastPinchCenterRef = React.useRef<{ x: number, y: number } | undefined>(undefined)

	// Track animation frame for cancellation
	const animationFrameRef = React.useRef<number | undefined>(undefined)

	// Store onContextReady callback in ref to avoid infinite loops
	const onContextReadyRef = React.useRef(onContextReady)

	// Cancel any ongoing animation when user interacts
	const cancelAnimation = React.useCallback(() => {
		if (animationFrameRef.current !== undefined) {
			cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = undefined
		}
	}, [])

	// Window-level pan handler - uses refs for immediate updates without React batching
	const handleWindowPan = React.useCallback((evt: PointerEvent) => {
		const pan = panRef.current
		if (!pan || evt.pointerId !== pan.pointerId) return

		const dx = evt.clientX - pan.lastX
		const dy = evt.clientY - pan.lastY
		setMatrix(m => [m[0], m[1], m[2], m[3], m[4] + dx, m[5] + dy])
		panRef.current = { lastX: evt.clientX, lastY: evt.clientY, pointerId: pan.pointerId }
	}, [])

	// Window-level pan end handler - cleans up window listeners
	const handleWindowPanEnd = React.useCallback((evt: PointerEvent) => {
		const pan = panRef.current
		if (!pan || evt.pointerId !== pan.pointerId) return

		panRef.current = null
		window.removeEventListener('pointermove', handleWindowPan)
		window.removeEventListener('pointerup', handleWindowPanEnd)
		window.removeEventListener('pointercancel', handleWindowPanEnd)
	}, [handleWindowPan])

	// Start panning with window-level event listeners
	const startPan = React.useCallback((evt: React.PointerEvent) => {
		panRef.current = { lastX: evt.clientX, lastY: evt.clientY, pointerId: evt.pointerId }
		window.addEventListener('pointermove', handleWindowPan)
		window.addEventListener('pointerup', handleWindowPanEnd)
		window.addEventListener('pointercancel', handleWindowPanEnd)
	}, [handleWindowPan, handleWindowPanEnd])

	// Stop panning and clean up window listeners (used when entering pinch-zoom or other cancellation)
	const stopPan = React.useCallback(() => {
		if (panRef.current) {
			panRef.current = null
			window.removeEventListener('pointermove', handleWindowPan)
			window.removeEventListener('pointerup', handleWindowPanEnd)
			window.removeEventListener('pointercancel', handleWindowPanEnd)
		}
	}, [handleWindowPan, handleWindowPanEnd])

	const translateTo = React.useCallback(function traslateTo(x: number, y: number): [number, number] {
		return [(x - matrix[4]) / matrix[0],( y - matrix[5]) / matrix[3]]
	}, [matrix])

	const translateFrom = React.useCallback(function translateFrom(x: number, y: number): [number, number] {
		return [x * matrix[0] + matrix[4], y * matrix[3] + matrix[5]]
	}, [matrix])

	function startDrag(evt: React.PointerEvent) {
		const e = transformPointerEvent(evt)
		if (!e) return

		setToolStart({ startX: e.x, startY: e.y})
	}

	const svgContext = React.useMemo(() => ({
		svg: svgRef.current || undefined,
		matrix,
		scale: matrix[0],
		translateTo,
		translateFrom,
		setDragHandler,
		startDrag
	}), [svgRef.current, matrix])

	// Keep onContextReady ref in sync
	React.useEffect(() => {
		onContextReadyRef.current = onContextReady
	}, [onContextReady])

	// Call onContextReady callback when matrix changes
	// Only depend on matrix - translateTo/translateFrom are derived from it
	React.useEffect(() => {
		if (onContextReadyRef.current) {
			onContextReadyRef.current({
				svg: svgRef.current || undefined,
				matrix,
				scale: matrix[0],
				translateTo,
				translateFrom
			})
		}
	}, [matrix])

	// Expose imperative handle
	React.useImperativeHandle(ref, () => ({
		centerOn: (x: number, y: number, zoom?: number) => {
			const svg = svgRef.current
			if (!svg) return

			const rect = svg.getBoundingClientRect()
			const centerX = rect.width / 2
			const centerY = rect.height / 2
			const scale = zoom ?? matrix[0]

			setMatrix([scale, 0, 0, scale, centerX - x * scale, centerY - y * scale])
		},
		centerOnRect: (x: number, y: number, width: number, height: number, padding = 50) => {
			const svg = svgRef.current
			if (!svg) return

			const rect = svg.getBoundingClientRect()
			const availableWidth = rect.width - padding * 2
			const availableHeight = rect.height - padding * 2

			// Calculate scale to fit the rectangle
			const scaleX = availableWidth / width
			const scaleY = availableHeight / height
			const scale = Math.min(scaleX, scaleY, 2) // Cap at 2x zoom

			// Center of the target rectangle
			const targetCenterX = x + width / 2
			const targetCenterY = y + height / 2

			// Center of the viewport
			const viewCenterX = rect.width / 2
			const viewCenterY = rect.height / 2

			setMatrix([scale, 0, 0, scale, viewCenterX - targetCenterX * scale, viewCenterY - targetCenterY * scale])
		},
		centerOnRectAnimated: (
			x: number,
			y: number,
			width: number,
			height: number,
			options?: { duration?: number; padding?: number; zoomOutFactor?: number }
		) => {
			const svg = svgRef.current
			if (!svg) return

			const duration = options?.duration ?? 350
			const padding = options?.padding ?? 50
			const zoomOutFactor = options?.zoomOutFactor ?? 0

			const rect = svg.getBoundingClientRect()
			const availableWidth = rect.width - padding * 2
			const availableHeight = rect.height - padding * 2

			// Calculate target scale to fit the rectangle
			const scaleX = availableWidth / width
			const scaleY = availableHeight / height
			const targetScale = Math.min(scaleX, scaleY, 2) // Cap at 2x zoom

			// Center of the target rectangle
			const targetCenterX = x + width / 2
			const targetCenterY = y + height / 2

			// Center of the viewport
			const viewCenterX = rect.width / 2
			const viewCenterY = rect.height / 2

			// Get current matrix for interpolation
			const startMatrix = [...matrix] as [number, number, number, number, number, number]
			const startScale = startMatrix[0]

			// Calculate start center in canvas coords (reverse the matrix transform)
			const startCenterX = (viewCenterX - startMatrix[4]) / startScale
			const startCenterY = (viewCenterY - startMatrix[5]) / startScale

			const startTime = performance.now()

			// easeInOutCubic for smooth acceleration/deceleration (better for zoom-out transitions)
			const easeInOutCubic = (t: number): number => {
				return t < 0.5
					? 4 * t * t * t
					: 1 - Math.pow(-2 * t + 2, 3) / 2
			}

			// Cancel any existing animation
			cancelAnimation()

			const animate = (currentTime: number) => {
				const elapsed = currentTime - startTime
				const progress = Math.min(elapsed / duration, 1)
				const eased = easeInOutCubic(progress)

				// Interpolate center position
				const currentCenterX = startCenterX + (targetCenterX - startCenterX) * eased
				const currentCenterY = startCenterY + (targetCenterY - startCenterY) * eased

				// Interpolate scale with optional zoom-out dip
				// zoomOutDip creates a parabola that dips at t=0.5
				// At t=0: dip=0, at t=0.5: dip=1, at t=1: dip=0
				const zoomOutDip = 4 * progress * (1 - progress) * zoomOutFactor
				const baseScale = startScale + (targetScale - startScale) * eased
				const currentScale = baseScale * (1 - zoomOutDip)

				// Calculate new matrix with interpolated values
				const newMatrix: [number, number, number, number, number, number] = [
					currentScale,
					0,
					0,
					currentScale,
					viewCenterX - currentCenterX * currentScale,
					viewCenterY - currentCenterY * currentScale
				]

				setMatrix(newMatrix)

				if (progress < 1) {
					animationFrameRef.current = requestAnimationFrame(animate)
				} else {
					animationFrameRef.current = undefined
				}
			}

			animationFrameRef.current = requestAnimationFrame(animate)
		},
		isRectInView: (x: number, y: number, width: number, height: number): boolean => {
			const svg = svgRef.current
			if (!svg) return false

			const rect = svg.getBoundingClientRect()

			// Calculate rect center in canvas coordinates
			const rectCenterX = x + width / 2
			const rectCenterY = y + height / 2

			// Transform to screen coordinates using current matrix
			const screenX = rectCenterX * matrix[0] + matrix[4]
			const screenY = rectCenterY * matrix[3] + matrix[5]

			// Check if center is within viewport bounds
			return screenX >= 0 && screenX <= rect.width && screenY >= 0 && screenY <= rect.height
		},
		getMatrix: () => matrix,
		setMatrix: (newMatrix) => setMatrix(newMatrix)
	}), [matrix, cancelAnimation])

	function transformPointerEvent(evt: React.PointerEvent) {
		if (!svgRef.current) return { x: 0, y: 0, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false }

		const br = svgRef.current.getBoundingClientRect(),
			[x, y] = translateTo(evt.clientX - br.left, evt.clientY - br.top)
		return { buttons: evt.buttons, x, y, shiftKey: evt.shiftKey, ctrlKey: evt.ctrlKey, metaKey: evt.metaKey, altKey: evt.altKey }
	}

	function transformMouseEvent(evt: React.MouseEvent) {
		if (!svgRef.current) return { x: 0, y: 0 }

		const br = svgRef.current.getBoundingClientRect(),
			[x, y] = translateTo(evt.clientX - br.left, evt.clientY - br.top)
		return { buttons: evt.buttons, x, y }
	}

	function onPointerDown(evt: React.PointerEvent) {
		// Cancel any ongoing animation when user interacts
		cancelAnimation()

		// Track this pointer
		activePointersRef.current.set(evt.pointerId, {
			id: evt.pointerId,
			x: evt.clientX,
			y: evt.clientY
		})

		const pointerCount = activePointersRef.current.size

		// If we have 2+ pointers, enter pinch-zoom mode
		if (pointerCount >= 2) {
			const pointers = Array.from(activePointersRef.current.values())
			const distance = Math.sqrt(
				(pointers[0].x - pointers[1].x) ** 2 +
				(pointers[0].y - pointers[1].y) ** 2
			)
			const centerX = (pointers[0].x + pointers[1].x) / 2
			const centerY = (pointers[0].y + pointers[1].y) / 2

			lastPinchDistanceRef.current = distance
			lastPinchCenterRef.current = { x: centerX, y: centerY }

			// Cancel any active tool operation
			setToolStart(undefined)
			stopPan()

			evt.preventDefault()
			evt.stopPropagation()
			return
		}

		// Single pointer handling
		evt.preventDefault()
		evt.stopPropagation()

		// Check if this is a touch event (pointerType === 'touch') or mouse
		if (evt.pointerType === 'mouse') {
			switch (evt.buttons) {
			case 1: /* left button */
				if (onToolStart) {
					const e = transformPointerEvent(evt)
					if (e) {
						setToolStart({ startX: e.x, startY: e.y })
						onToolStart({ startX: e.x, startY: e.y, x: e.x, y: e.y, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey })
					}
				}
				setActive(undefined)
				break
			case 4: /* middle button */
				startPan(evt)
				break
			}
		} else {
			// Touch or pen - single finger
			if (onToolStart) {
				const e = transformPointerEvent(evt)
				if (e) {
					setToolStart({ startX: e.x, startY: e.y })
					onToolStart({ startX: e.x, startY: e.y, x: e.x, y: e.y, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey })
				}
			} else {
				// No tool active - pan mode
				startPan(evt)
			}
		}
	}

	function onPointerMove(evt: React.PointerEvent) {
		// Update tracked pointer position
		if (activePointersRef.current.has(evt.pointerId)) {
			activePointersRef.current.set(evt.pointerId, {
				id: evt.pointerId,
				x: evt.clientX,
				y: evt.clientY
			})
		}

		const pointerCount = activePointersRef.current.size

		// Handle 2-finger pinch+pan
		if (pointerCount >= 2 && lastPinchDistanceRef.current !== undefined && lastPinchCenterRef.current !== undefined) {
			const pointers = Array.from(activePointersRef.current.values())
			const newDistance = Math.sqrt(
				(pointers[0].x - pointers[1].x) ** 2 +
				(pointers[0].y - pointers[1].y) ** 2
			)
			const newCenterX = (pointers[0].x + pointers[1].x) / 2
			const newCenterY = (pointers[0].y + pointers[1].y) / 2

			// Calculate zoom scale
			const scale = newDistance / lastPinchDistanceRef.current

			// Calculate pan delta (center point movement)
			const dx = newCenterX - lastPinchCenterRef.current.x
			const dy = newCenterY - lastPinchCenterRef.current.y

			// Apply combined pan+zoom transformation
			setMatrix(m => [
				m[0] * scale,
				m[1] * scale,
				m[2] * scale,
				m[3] * scale,
				(m[4] + dx) - (newCenterX - (m[4] + dx)) * (scale - 1),
				(m[5] + dy) - (newCenterY - (m[5] + dy)) * (scale - 1)
			])

			// Update tracking state
			lastPinchDistanceRef.current = newDistance
			lastPinchCenterRef.current = { x: newCenterX, y: newCenterY }

			evt.stopPropagation()
			evt.preventDefault()
			return
		}

		// Single pointer handling (pan is handled by window-level events, not here)
		if (dragHandler && toolStart) {
			const e = transformPointerEvent(evt)
			dragHandler.onDragMove({ x: e.x, y: e.y, startX: toolStart.startX, startY: toolStart.startY })
		} else if (onToolMove && toolStart) {
			const e = transformPointerEvent(evt)
			if (e) {
				onToolMove({ x: e.x, y: e.y, startX: toolStart.startX, startY: toolStart.startY })
			}
		}

		// Always call onMove for cursor tracking (when not panning/pinching)
		// pointerCount <= 1 covers both hovering (0) and single pointer drag (1)
		if (onMove && pointerCount <= 1 && !panRef.current) {
			const e = transformPointerEvent(evt)
			if (e) {
				onMove({ x: e.x, y: e.y, startX: e.x, startY: e.y })
			}
		}
	}

	function onPointerUp(evt: React.PointerEvent) {
		// Remove this pointer from tracking
		activePointersRef.current.delete(evt.pointerId)

		const pointerCount = activePointersRef.current.size

		// If we still have pointers, reinitialize pinch state with remaining pointers
		if (pointerCount >= 2) {
			const pointers = Array.from(activePointersRef.current.values())
			lastPinchDistanceRef.current = Math.sqrt(
				(pointers[0].x - pointers[1].x) ** 2 +
				(pointers[0].y - pointers[1].y) ** 2
			)
			lastPinchCenterRef.current = {
				x: (pointers[0].x + pointers[1].x) / 2,
				y: (pointers[0].y + pointers[1].y) / 2
			}
			return
		}

		// If we're down to 1 pointer and were pinching, reset pinch state
		if (pointerCount === 1) {
			lastPinchDistanceRef.current = undefined
			lastPinchCenterRef.current = undefined
			// Don't start panning - let the remaining pointer continue without action
			return
		}

		// All pointers released - cleanup
		onDragEnd()
	}

	function onPointerCancel(evt: React.PointerEvent) {
		activePointersRef.current.delete(evt.pointerId)
		if (activePointersRef.current.size === 0) {
			lastPinchDistanceRef.current = undefined
			lastPinchCenterRef.current = undefined
			onDragEnd()
		}
	}

	function onDragEnd() {
		lastPinchDistanceRef.current = undefined
		lastPinchCenterRef.current = undefined
		if (dragHandler) {
			dragHandler.onDragEnd?.()
			setDragHandler(undefined)
			setToolStart(undefined)
		}
		if (drag) drag?.target.onDragEnd?.()
		if (onToolEnd) onToolEnd()
		setDrag(undefined)
		stopPan()
		setToolStart(undefined)
	}

	function onWheel(evt: React.WheelEvent) {
		// Cancel any ongoing animation when user zooms
		cancelAnimation()

		const page = svgRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
		let scale = matrix[0]
		if (scale < 10 && evt.deltaY < 0) {
			zoom(1.25, evt.pageX - page.left, evt.pageY - page.top)
		} else if (scale > 0.1 && evt.deltaY > 0) {
			zoom(0.8, evt.pageX - page.left, evt.pageY - page.top)
		}
		evt.stopPropagation()
	}

	function zoom(scale: number, cx: number, cy: number) {
		setMatrix(m => [
			m[0] * scale,
			m[1] * scale,
			m[2] * scale,
			m[3] * scale,
			m[4] - (cx - m[4]) * (scale - 1),
			m[5] - (cy - m[5]) * (scale - 1)
		])
	}

	return <SvgCanvasContext.Provider value={svgContext}>
		<svg
			ref={svgRef}
			className={className}
			style={{...style, touchAction: 'none'}}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onWheel={onWheel}
		>
			<g transform={`matrix(${matrix.map(x => Math.round(x * 1000) / 1000).join(' ')})`}>
				{children}
			</g>
			<g>{fixed}</g>
		</svg>
	</SvgCanvasContext.Provider>
})

// vim: ts=4
