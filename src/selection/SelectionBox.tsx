/**
 * SelectionBox component - renders selection rectangle with resize handles
 */

import React from 'react'
import type { Bounds, ResizeHandle as ResizeHandleType } from '../types'
import { getHandlePositions } from '../geometry/bounds'
import { ResizeHandle as ResizeHandleComponent } from './ResizeHandle'

export interface SelectionBoxProps {
	bounds: Bounds
	// Rotation support
	rotation?: number
	pivotX?: number  // 0-1, default 0.5 (center)
	pivotY?: number  // 0-1, default 0.5 (center)
	// Appearance
	stroke?: string
	strokeWidth?: number
	strokeDasharray?: string
	// Handles
	showHandles?: boolean
	handleSize?: number
	handleFill?: string
	handleFillHover?: string
	handleStroke?: string
	// Callbacks
	onResizeStart?: (handle: ResizeHandleType, e: React.MouseEvent) => void
}

export function SelectionBox({
	bounds,
	rotation = 0,
	pivotX = 0.5,
	pivotY = 0.5,
	stroke = '#0066ff',
	strokeWidth = 2,
	strokeDasharray = '4,4',
	showHandles = true,
	handleSize = 8,
	handleFill = '#ffffff',
	handleFillHover = '#0066ff',
	handleStroke,
	onResizeStart
}: SelectionBoxProps) {
	const handlePositions = getHandlePositions(bounds)
	const effectiveHandleStroke = handleStroke ?? stroke

	// Calculate rotation center
	const cx = bounds.x + bounds.width * pivotX
	const cy = bounds.y + bounds.height * pivotY

	// Build transform string (only apply if rotated)
	const transform = rotation !== 0
		? `rotate(${rotation} ${cx} ${cy})`
		: undefined

	return (
		<g transform={transform}>
			{/* Main selection rectangle */}
			<rect
				x={bounds.x}
				y={bounds.y}
				width={bounds.width}
				height={bounds.height}
				fill="none"
				stroke={stroke}
				strokeWidth={strokeWidth}
				strokeDasharray={strokeDasharray}
				pointerEvents="none"
			/>

			{/* Resize handles */}
			{showHandles && handlePositions.map(({ handle, x, y }) => (
				<ResizeHandleComponent
					key={handle}
					handle={handle}
					x={x}
					y={y}
					size={handleSize}
					fill={handleFill}
					fillHover={handleFillHover}
					stroke={effectiveHandleStroke}
					onMouseDown={onResizeStart}
				/>
			))}
		</g>
	)
}

// vim: ts=4
