/**
 * Individual resize handle component
 */

import React from 'react'
import type { ResizeHandle as ResizeHandleType } from '../types'
import { getRotatedCursor } from '../types'

export interface ResizeHandleProps {
	handle: ResizeHandleType
	x: number
	y: number
	rotation?: number // Object rotation in degrees, for cursor adjustment
	size?: number
	fill?: string
	fillHover?: string
	stroke?: string
	strokeWidth?: number
	strokeWidthHover?: number
	onPointerDown?: (handle: ResizeHandleType, e: React.PointerEvent) => void
}

export function ResizeHandle({
	handle,
	x,
	y,
	rotation = 0,
	size = 8,
	fill = '#ffffff',
	fillHover = '#0066ff',
	stroke = '#0066ff',
	strokeWidth = 1,
	strokeWidthHover = 2,
	onPointerDown
}: ResizeHandleProps) {
	const [isHovered, setIsHovered] = React.useState(false)
	const cursor = getRotatedCursor(handle, rotation)

	return (
		<rect
			x={x - size / 2}
			y={y - size / 2}
			width={size}
			height={size}
			fill={isHovered ? fillHover : fill}
			stroke={stroke}
			strokeWidth={isHovered ? strokeWidthHover : strokeWidth}
			style={{ cursor }}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onPointerDown={(e) => {
				e.stopPropagation()
				e.preventDefault()
				onPointerDown?.(handle, e)
			}}
		/>
	)
}

// vim: ts=4
