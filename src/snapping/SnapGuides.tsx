/**
 * Figma-style snap guide lines component
 */

import * as React from 'react'
import type { Bounds } from '../types'
import type {
	ActiveSnap,
	ScoredCandidate,
	SnapGuidesConfig,
	SnapDebugConfig,
	RotatedBounds,
	SnapTarget
} from './types'

export interface SnapGuidesProps {
	activeSnaps: ActiveSnap[]
	allCandidates?: ScoredCandidate[]
	config: SnapGuidesConfig
	debugConfig?: SnapDebugConfig
	viewBounds: Bounds
	draggedBounds?: RotatedBounds
	/** Transform function to convert canvas coords to screen coords (for fixed layer rendering) */
	transformPoint?: (x: number, y: number) => [number, number]
}

/**
 * Calculate distance between dragged object and snap source
 */
function calculateSnapDistance(
	snap: ActiveSnap,
	draggedBounds: RotatedBounds | undefined
): number | null {
	if (!draggedBounds || !snap.target.sourceObjectId) {
		return null
	}

	// This is the snap distance (how far the object moved to snap)
	return Math.abs(snap.distance)
}

/**
 * Get position for distance label
 */
function getDistanceLabelPosition(
	snap: ActiveSnap,
	draggedBounds: RotatedBounds | undefined
): { x: number; y: number } | null {
	if (!draggedBounds) {
		return null
	}

	const { guideStart, guideEnd, target } = snap

	if (target.axis === 'x') {
		// Vertical line - place label at dragged object's center Y
		return {
			x: target.value + 5,
			y: draggedBounds.y + draggedBounds.height / 2
		}
	} else {
		// Horizontal line - place label at dragged object's center X
		return {
			x: draggedBounds.x + draggedBounds.width / 2,
			y: target.value - 5
		}
	}
}

/**
 * Component to highlight source object bounding boxes during snapping
 */
function SourceBoundingBoxHighlight({
	bounds,
	color,
	strokeWidth,
	transformPoint
}: {
	bounds: Bounds
	color: string
	strokeWidth: number
	transformPoint: (x: number, y: number) => [number, number]
}) {
	// Transform all four corners
	const [x1, y1] = transformPoint(bounds.x, bounds.y)
	const [x2, y2] = transformPoint(bounds.x + bounds.width, bounds.y + bounds.height)

	// Calculate transformed dimensions
	const minX = Math.min(x1, x2)
	const minY = Math.min(y1, y2)
	const width = Math.abs(x2 - x1)
	const height = Math.abs(y2 - y1)

	return (
		<rect
			x={minX}
			y={minY}
			width={width}
			height={height}
			fill="none"
			stroke={color}
			strokeWidth={strokeWidth}
			strokeDasharray="4,3"
			strokeOpacity={0.7}
		/>
	)
}

/**
 * Main snap guides component - renders Figma-style red guide lines
 */
export function SnapGuides({
	activeSnaps,
	allCandidates,
	config,
	debugConfig,
	viewBounds,
	draggedBounds,
	transformPoint
}: SnapGuidesProps) {
	if (activeSnaps.length === 0 && (!debugConfig?.enabled || !allCandidates?.length)) {
		return null
	}

	// Identity transform if none provided
	const transform = transformPoint || ((x: number, y: number): [number, number] => [x, y])

	// Collect unique source objects to highlight (by ID to avoid duplicates)
	const sourceObjectsToHighlight = React.useMemo(() => {
		const seen = new Map<string, Bounds>()
		for (const snap of activeSnaps) {
			const sourceId = snap.target.sourceObjectId
			if (sourceId && snap.sourceBounds && !seen.has(sourceId)) {
				seen.set(sourceId, snap.sourceBounds)
			}
		}
		return Array.from(seen.entries())
	}, [activeSnaps])

	return (
		<g className="snap-guides" pointerEvents="none">
			{/* Source object bounding box highlights */}
			{sourceObjectsToHighlight.map(([sourceId, bounds]) => (
				<SourceBoundingBoxHighlight
					key={`source-highlight-${sourceId}`}
					bounds={bounds}
					color={config.color}
					strokeWidth={config.strokeWidth}
					transformPoint={transform}
				/>
			))}

			{/* Active snap guide lines */}
			{activeSnaps.map((snap, index) => (
				<SnapGuideLine
					key={`active-${index}-${snap.target.axis}-${snap.target.value}`}
					snap={snap}
					config={config}
					draggedBounds={draggedBounds}
					isActive={true}
					transformPoint={transform}
				/>
			))}

			{/* Debug overlay for candidates */}
			{debugConfig?.enabled && allCandidates && (
				<SnapDebugCandidates
					candidates={allCandidates}
					config={debugConfig}
					activeSnaps={activeSnaps}
					transformPoint={transform}
				/>
			)}
		</g>
	)
}

interface SnapGuideLineProps {
	snap: ActiveSnap
	config: SnapGuidesConfig
	draggedBounds?: RotatedBounds
	isActive: boolean
	opacity?: number
	transformPoint: (x: number, y: number) => [number, number]
}

/**
 * Diamond marker component for guide line endpoints
 */
function DiamondMarker({ x, y, size = 4, color }: { x: number; y: number; size?: number; color: string }) {
	const half = size / 2
	return (
		<polygon
			points={`${x},${y - half} ${x + half},${y} ${x},${y + half} ${x - half},${y}`}
			fill={color}
		/>
	)
}

/**
 * Individual snap guide line
 */
function SnapGuideLine({
	snap,
	config,
	draggedBounds,
	isActive,
	opacity = 1,
	transformPoint
}: SnapGuideLineProps) {
	const { guideStart, guideEnd, target, matchedSize, sourceBounds } = snap

	// Transform coordinates from canvas to screen space
	const [x1, y1] = transformPoint(guideStart.x, guideStart.y)
	const [x2, y2] = transformPoint(guideEnd.x, guideEnd.y)

	const distanceLabel = config.showDistanceIndicators && draggedBounds
		? calculateSnapDistance(snap, draggedBounds)
		: null

	const labelPos = distanceLabel !== null && draggedBounds
		? getDistanceLabelPosition(snap, draggedBounds)
		: null

	// Transform label position if available
	const [labelX, labelY] = labelPos ? transformPoint(labelPos.x, labelPos.y) : [0, 0]

	// Check if this is a size snap
	const isSizeSnap = target.type === 'size' && matchedSize !== undefined

	// Check if this is an object-based snap (has source bounds)
	const isObjectSnap = !!sourceBounds

	// Calculate midpoint in screen coords for size label
	const midX = (x1 + x2) / 2
	const midY = (y1 + y2) / 2

	return (
		<g opacity={opacity}>
			{/* Main guide line */}
			<line
				x1={x1}
				y1={y1}
				x2={x2}
				y2={y2}
				stroke={config.color}
				strokeWidth={config.strokeWidth}
				strokeDasharray={isActive ? undefined : '4,4'}
			/>

			{/* Endpoint markers for object-based snaps */}
			{isActive && isObjectSnap && (
				<>
					<DiamondMarker x={x1} y={y1} color={config.color} />
					<DiamondMarker x={x2} y={y2} color={config.color} />
				</>
			)}

			{/* Size snap indicator with arrows and label */}
			{isSizeSnap && (
				<g>
					{/* Arrow endpoints */}
					{target.axis === 'x' ? (
						<>
							{/* Left arrow */}
							<polygon
								points={`${x1},${y1} ${x1 + 6},${y1 - 4} ${x1 + 6},${y1 + 4}`}
								fill={config.color}
							/>
							{/* Right arrow */}
							<polygon
								points={`${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`}
								fill={config.color}
							/>
						</>
					) : (
						<>
							{/* Top arrow */}
							<polygon
								points={`${x1},${y1} ${x1 - 4},${y1 + 6} ${x1 + 4},${y1 + 6}`}
								fill={config.color}
							/>
							{/* Bottom arrow */}
							<polygon
								points={`${x2},${y2} ${x2 - 4},${y2 - 6} ${x2 + 4},${y2 - 6}`}
								fill={config.color}
							/>
						</>
					)}

					{/* Size label */}
					<g>
						{target.axis === 'x' ? (
							<>
								<rect
									x={midX - 20}
									y={y1 - 18}
									width={40}
									height={14}
									fill="white"
									fillOpacity={0.95}
									rx={2}
								/>
								<text
									x={midX}
									y={y1 - 7}
									fontSize={10}
									fill={config.color}
									fontFamily="system-ui, sans-serif"
									textAnchor="middle"
								>
									{Math.round(matchedSize)}
								</text>
							</>
						) : (
							<>
								<rect
									x={x1 - 30}
									y={midY - 7}
									width={25}
									height={14}
									fill="white"
									fillOpacity={0.95}
									rx={2}
								/>
								<text
									x={x1 - 18}
									y={midY + 4}
									fontSize={10}
									fill={config.color}
									fontFamily="system-ui, sans-serif"
									textAnchor="middle"
								>
									{Math.round(matchedSize)}
								</text>
							</>
						)}
					</g>
				</g>
			)}

			{/* Distance indicator (for non-size snaps) */}
			{!isSizeSnap && labelPos && distanceLabel !== null && distanceLabel > 0 && (
				<g>
					{/* Background for readability */}
					<rect
						x={labelX - 2}
						y={labelY - 10}
						width={30}
						height={14}
						fill="white"
						fillOpacity={0.9}
						rx={2}
					/>
					<text
						x={labelX}
						y={labelY}
						fontSize={10}
						fill={config.color}
						fontFamily="system-ui, sans-serif"
					>
						{Math.round(distanceLabel)}px
					</text>
				</g>
			)}
		</g>
	)
}

interface SnapDebugCandidatesProps {
	candidates: ScoredCandidate[]
	config: SnapDebugConfig
	activeSnaps: ActiveSnap[]
	transformPoint: (x: number, y: number) => [number, number]
}

/**
 * Debug visualization showing top-N candidates with scores
 */
function SnapDebugCandidates({
	candidates,
	config,
	activeSnaps,
	transformPoint
}: SnapDebugCandidatesProps) {
	// Get top N candidates (excluding active ones to avoid duplication)
	const activeValues = new Set(
		activeSnaps.map(s => `${s.target.axis}-${s.target.value}`)
	)

	const debugCandidates = candidates
		.filter(c => !activeValues.has(`${c.target.axis}-${c.target.value}`))
		.slice(0, config.showTopN)

	// Normalize scores for opacity
	const maxScore = Math.max(...candidates.map(c => c.score), 0.001)

	return (
		<g className="snap-debug-candidates">
			{debugCandidates.map((candidate, index) => {
				const opacity = 0.3 + (candidate.score / maxScore) * 0.4
				const color = getDebugColor(index)

				// Transform coordinates
				const [x1, y1] = transformPoint(candidate.guideStart.x, candidate.guideStart.y)
				const [x2, y2] = transformPoint(candidate.guideEnd.x, candidate.guideEnd.y)

				return (
					<g key={`debug-${index}-${candidate.target.axis}-${candidate.target.value}`}>
						{/* Candidate guide line */}
						<line
							x1={x1}
							y1={y1}
							x2={x2}
							y2={y2}
							stroke={color}
							strokeWidth={1}
							strokeDasharray="2,4"
							opacity={opacity}
						/>

						{/* Score label */}
						{config.showScores && (
							<DebugScoreLabel
								candidate={candidate}
								color={color}
								showBreakdown={config.showScoreBreakdown}
								transformPoint={transformPoint}
							/>
						)}
					</g>
				)
			})}
		</g>
	)
}

interface DebugScoreLabelProps {
	candidate: ScoredCandidate
	color: string
	showBreakdown: boolean
	transformPoint: (x: number, y: number) => [number, number]
}

/**
 * Debug score label for a candidate
 */
function DebugScoreLabel({ candidate, color, showBreakdown, transformPoint }: DebugScoreLabelProps) {
	const { target, score, breakdown, guideStart, guideEnd } = candidate

	// Position label at midpoint of guide (in canvas coords)
	const midX = (guideStart.x + guideEnd.x) / 2
	const midY = (guideStart.y + guideEnd.y) / 2

	// Transform to screen coords
	const [labelX, labelY] = transformPoint(midX, midY)

	// Offset based on axis to avoid overlap with line
	const offset = target.axis === 'x' ? { x: 5, y: 0 } : { x: 0, y: -5 }

	const scoreText = showBreakdown
		? `${score.toFixed(2)} (d:${breakdown.distance.toFixed(1)} g:${breakdown.grabProximity.toFixed(1)} h:${breakdown.hierarchy.toFixed(1)})`
		: score.toFixed(2)

	return (
		<g>
			<rect
				x={labelX + offset.x - 2}
				y={labelY + offset.y - 10}
				width={showBreakdown ? 120 : 30}
				height={12}
				fill="rgba(0,0,0,0.7)"
				rx={2}
			/>
			<text
				x={labelX + offset.x}
				y={labelY + offset.y}
				fontSize={9}
				fill={color}
				fontFamily="monospace"
			>
				{scoreText}
			</text>
		</g>
	)
}

/**
 * Get color for debug candidate based on rank
 */
function getDebugColor(index: number): string {
	const colors = [
		'#4ade80', // green - top candidate
		'#facc15', // yellow - second
		'#fb923c', // orange - third
		'#94a3b8', // gray - others
		'#94a3b8',
		'#94a3b8'
	]

	return colors[Math.min(index, colors.length - 1)]
}

// vim: ts=4
