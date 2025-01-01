import React from 'react'

const SvgCanvasContext = React.createContext<{
	svg?: SVGSVGElement
	matrix: [number, number, number, number, number, number]
	scale: number
	translateTo: (x: number, y: number) => [number, number]
	translateFrom: (x: number, y: number) => [number, number]
	setDragHandler: React.Dispatch<React.SetStateAction<DragHandler | undefined>>
	startDrag: (evt: React.MouseEvent | React.TouchEvent) => void
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
}

//////////////////
// useSvgCanvas //
//////////////////
export function useSvgCanvas() {
	return React.useContext(SvgCanvasContext)
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
}

interface DragHandler {
	onDragMove: (evt: ToolEvent) => void
	onDragEnd?: () => void
}

export function SvgCanvas({
	className,
	style,
	children,
	fixed,
	onToolStart,
	onToolMove,
	onToolEnd
}: SvgCanvasProps) {
	const svgRef = React.useRef<SVGSVGElement>(null)
	const [active, setActive] = React.useState<undefined>()
	const [pan, setPan] = React.useState<{ lastX: number, lastY: number } | undefined>()
	const [pinch, setPinch] = React.useState<number | undefined>()
	const [drag, setDrag] = React.useState<{ target: any, startX: number, startY: number, lastX: number, lastY: number } | undefined>()
	const [toolStart, setToolStart] = React.useState<{ startX: number, startY: number } | undefined>()
	const [dragHandler, setDragHandler] = React.useState<DragHandler | undefined>()
	const [matrix, setMatrix] = React.useState<[number, number, number, number, number, number]>([1, 0, 0, 1, 0, 0])

	const translateTo = React.useCallback(function traslateTo(x: number, y: number): [number, number] {
		return [(x - matrix[4]) / matrix[0],( y - matrix[5]) / matrix[3]]
	}, [matrix])

	const translateFrom = React.useCallback(function translateFrom(x: number, y: number): [number, number] {
		console.log('translateFrom matrix', matrix)
		return [x * matrix[0] + matrix[4], y * matrix[3] + matrix[5]]
	}, [matrix])

	function startDrag(evt: React.MouseEvent | React.TouchEvent) {
		const e = 'touches' in evt ? transformTouchEvent(evt) : transformMouseEvent(evt)
		if (!e) return

		setToolStart({ startX: e.x, startY: e.y})
		//setDrag({ target, startX: e.x, startY: e.y, lastX: e.x, lastY: e.y})
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

	function transformTouchEvent(evt: React.TouchEvent) {
		if (!svgRef.current) return { x: 0, y: 0 }

		const br = svgRef.current.getBoundingClientRect(),
			[x, y] = translateTo(evt.touches[0].clientX - br.left, evt.touches[0].clientY - br.top)
		return { buttons: undefined, x, y }
	}

	function transformMouseEvent(evt: React.MouseEvent) {
		if (!svgRef.current) return { x: 0, y: 0 }

		const br = svgRef.current.getBoundingClientRect(),
			[x, y] = translateTo(evt.clientX - br.left, evt.clientY - br.top)
		return { buttons: evt.buttons, x, y }
	}

	function onMouseDown(evt: React.MouseEvent) {
		evt.preventDefault()
		evt.stopPropagation()
		switch (evt.buttons) {
		case 1: /* left button */
			if (onToolStart) {
				const e = transformMouseEvent(evt)
				if (e) {
					setToolStart({ startX: e.x, startY: e.y })
					onToolStart({ startX: e.x, startY: e.y, x: e.x, y: e.y })
				}
			}
			setActive(undefined)
			break
		case 4: /* middle button */
			// Pan
			const lastX = evt.clientX
			const lastY = evt.clientY

			setPan({lastX, lastY})
			break
		}
	}

	function onTouchStart(evt: React.TouchEvent) {
		const lastX = evt.touches[0].clientX
		const lastY = evt.touches[0].clientY

		evt.stopPropagation()
		if (onToolStart) {
			const e = transformTouchEvent(evt)
			if (e) {
				setToolStart({ startX: e.x, startY: e.y })
				onToolStart({ startX: e.x, startY: e.y, x: e.x, y: e.y })
			}
		} else {
			setPan({lastX, lastY})
		}
	}

	function onMouseMove(evt: React.MouseEvent) {
		if (!evt.buttons) return
		evt.preventDefault()
		evt.stopPropagation()

		console.log('onMouseMove', dragHandler, toolStart)
		if (dragHandler && toolStart) {
			const e = transformMouseEvent(evt)
			dragHandler.onDragMove({ x: e.x, y: e.y, startX: toolStart.startX, startY: toolStart.startY })
		/*
		} else if (drag) {
			const e = transformMouseEvent(evt)
			if (e?.buttons == 1 && drag.target) {
				let scale = matrix[0]
			} else return onDragEnd()
			setDrag(drag => drag ? { ...drag, lastX: e.x, lastY: e.y } : undefined)
		*/
		} else if (pan) {
			if (evt.buttons == 4) {
				// Pan
				let x = evt.clientX,
					y = evt.clientY
				const dx = x - pan.lastX
				const dy = y - pan.lastY
				setMatrix(matrix => [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4] + dx, matrix[5] + dy])
				setPan({lastX: x, lastY: y})
				evt.stopPropagation()
			} else return onDragEnd()
		} else if (onToolMove && toolStart) {
			const e = transformMouseEvent(evt)
			if (e) {
				onToolMove({ x: e.x, y: e.y, startX: toolStart.startX, startY: toolStart.startY })
			}
		} else return onDragEnd()
	}

	function onTouchMove(evt: React.TouchEvent) {
		evt.stopPropagation()
		console.log('touchMove', evt)
		if (evt.touches.length == 1) {
			if (dragHandler && toolStart) {
				const e = transformTouchEvent(evt)
				dragHandler.onDragMove({ x: e.x, y: e.y, startX: toolStart?.startX, startY: toolStart?.startY })
				/*
				if (e && drag.target) {
					let scale = matrix[0]
				} else return onDragEnd()
				setDrag(drag => drag ? { ...drag, lastX: e.x, lastY: e.y } : undefined)
				*/
			} else if (pan) {
				// Pan
				let x = evt.touches[0].clientX,
					y = evt.touches[0].clientY
				const dx = x - pan.lastX
				const dy = y - pan.lastY
				setMatrix(matrix => [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4] + dx, matrix[5] + dy])
				setPan({lastX: x, lastY: y})
				evt.stopPropagation()
			} else if (onToolMove && toolStart) {
				const e = transformTouchEvent(evt)
				if (e) {
					onToolMove({ x: e.x, y: e.y, startX: toolStart.startX, startY: toolStart.startY })
				}
			} else return onDragEnd()
		} else if (evt.touches.length == 2) {
			if (!pinch) {
				setPinch(Math.sqrt(
					(evt.touches[0].clientX - evt.touches[1].clientX) ** 2
					+ (evt.touches[0].clientY - evt.touches[1].clientY) ** 2
				))
			} else {
				const newPinch = Math.sqrt(
					(evt.touches[0].clientX - evt.touches[1].clientX) ** 2
					+ (evt.touches[0].clientY - evt.touches[1].clientY) ** 2
				)
				const cx = (evt.touches[0].clientX + evt.touches[1].clientX) / 2
				const xy = (evt.touches[0].clientY + evt.touches[1].clientY) / 2
				const scale = newPinch / pinch
				zoom(scale, cx, xy)
				setPinch(newPinch)
				evt.stopPropagation()
				evt.preventDefault()
			}
		}
	}

	function onDragEnd() {
		if (pinch) setPinch(undefined)
		if (dragHandler) {
			dragHandler.onDragEnd?.()
			setDragHandler(undefined)
			setToolStart(undefined)
		}
		if (drag) drag?.target.onDragEnd?.()
		if (onToolEnd) onToolEnd()
		setDrag(undefined)
		setPan(undefined)
	}

	function onWheel(evt: React.WheelEvent) {
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
			onMouseDown={onMouseDown}
			onTouchStart={onTouchStart}
			onMouseMove={onMouseMove}
			onTouchMove={onTouchMove}
			onMouseUp={onDragEnd}
			onTouchEnd={onDragEnd}
			onWheel={onWheel}
		>
			<g transform={`matrix(${matrix.map(x => Math.round(x * 1000) / 1000).join(' ')})`}>
				{children}
			</g>
			<g>{fixed}</g>
		</svg>
	</SvgCanvasContext.Provider>
}

// vim: ts=4
