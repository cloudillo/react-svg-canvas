/**
 * Individual resize handle component
 */

import React from 'react'
import type { ResizeHandle as ResizeHandleType } from '../types'
import { RESIZE_CURSORS } from '../types'

export interface ResizeHandleProps {
	handle: ResizeHandleType
	x: number
	y: number
	size?: number
	fill?: string
	fillHover?: string
	stroke?: string
	strokeWidth?: number
	strokeWidthHover?: number
	onMouseDown?: (handle: ResizeHandleType, e: React.MouseEvent) => void
}

export function ResizeHandle({
	handle,
	x,
	y,
	size = 8,
	fill = '#ffffff',
	fillHover = '#0066ff',
	stroke = '#0066ff',
	strokeWidth = 1,
	strokeWidthHover = 2,
	onMouseDown
}: ResizeHandleProps) {
	const [isHovered, setIsHovered] = React.useState(false)

	return (
		<rect
			x={x - size / 2}
			y={y - size / 2}
			width={size}
			height={size}
			fill={isHovered ? fillHover : fill}
			stroke={stroke}
			strokeWidth={isHovered ? strokeWidthHover : strokeWidth}
			style={{ cursor: RESIZE_CURSORS[handle] }}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onMouseDown={(e) => {
				e.stopPropagation()
				e.preventDefault()
				onMouseDown?.(handle, e)
			}}
		/>
	)
}

// vim: ts=4
