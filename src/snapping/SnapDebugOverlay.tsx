/**
 * Debug overlay for visualizing snap algorithm behavior
 */

import * as React from 'react'
import type { Bounds } from '../types'
import type {
	ScoredCandidate,
	SnapDebugConfig,
	ActiveSnap,
	RotatedBounds
} from './types'

export interface SnapDebugOverlayProps {
	candidates: ScoredCandidate[]
	activeSnaps: ActiveSnap[]
	config: SnapDebugConfig
	viewBounds: Bounds
	draggedBounds?: RotatedBounds
}

/**
 * Comprehensive debug overlay showing all scoring information
 */
export function SnapDebugOverlay({
	candidates,
	activeSnaps,
	config,
	viewBounds,
	draggedBounds
}: SnapDebugOverlayProps) {
	if (!config.enabled || candidates.length === 0) {
		return null
	}

	// Get top N candidates
	const topCandidates = candidates.slice(0, config.showTopN)

	// Find max score for normalization
	const maxScore = Math.max(...candidates.map(c => c.score), 0.001)

	// Active snap values for highlighting
	const activeValues = new Set(
		activeSnaps.map(s => `${s.target.axis}-${s.target.value}`)
	)

	return (
		<g className="snap-debug-overlay" pointerEvents="none">
			{/* Render candidate lines with varying opacity */}
			{topCandidates.map((candidate, index) => {
				const isWinner = activeValues.has(
					`${candidate.target.axis}-${candidate.target.value}`
				)
				const normalizedScore = candidate.score / maxScore

				return (
					<DebugCandidateLine
						key={`debug-line-${index}`}
						candidate={candidate}
						index={index}
						isWinner={isWinner}
						normalizedScore={normalizedScore}
						showScores={config.showScores}
						showBreakdown={config.showScoreBreakdown}
						viewBounds={viewBounds}
					/>
				)
			})}

			{/* Debug panel with score rankings */}
			{config.showScores && (
				<DebugScorePanel
					candidates={topCandidates}
					activeValues={activeValues}
					viewBounds={viewBounds}
					showBreakdown={config.showScoreBreakdown}
				/>
			)}
		</g>
	)
}

interface DebugCandidateLineProps {
	candidate: ScoredCandidate
	index: number
	isWinner: boolean
	normalizedScore: number
	showScores: boolean
	showBreakdown: boolean
	viewBounds: Bounds
}

/**
 * Debug visualization for a single candidate
 */
function DebugCandidateLine({
	candidate,
	index,
	isWinner,
	normalizedScore,
	showScores,
	showBreakdown,
	viewBounds
}: DebugCandidateLineProps) {
	const { guideStart, guideEnd, target, score, breakdown } = candidate

	// Color based on ranking
	const color = isWinner
		? '#22c55e' // Green for winner
		: index === 0
			? '#eab308' // Yellow for top non-winner
			: index < 3
				? '#f97316' // Orange for top 3
				: '#64748b' // Gray for others

	// Opacity based on score
	const opacity = isWinner ? 1 : 0.3 + normalizedScore * 0.5

	// Line style
	const strokeWidth = isWinner ? 2 : 1
	const dashArray = isWinner ? undefined : '3,3'

	return (
		<g>
			{/* Guide line */}
			<line
				x1={guideStart.x}
				y1={guideStart.y}
				x2={guideEnd.x}
				y2={guideEnd.y}
				stroke={color}
				strokeWidth={strokeWidth}
				strokeDasharray={dashArray}
				opacity={opacity}
			/>

			{/* Score badge at line midpoint */}
			{showScores && (
				<ScoreBadge
					candidate={candidate}
					color={color}
					isWinner={isWinner}
					showBreakdown={showBreakdown}
				/>
			)}
		</g>
	)
}

interface ScoreBadgeProps {
	candidate: ScoredCandidate
	color: string
	isWinner: boolean
	showBreakdown: boolean
}

/**
 * Score badge shown on each candidate line
 */
function ScoreBadge({ candidate, color, isWinner, showBreakdown }: ScoreBadgeProps) {
	const { guideStart, guideEnd, target, score, breakdown, dragSnapEdge } = candidate

	// Position at midpoint with offset based on axis
	const midX = (guideStart.x + guideEnd.x) / 2
	const midY = (guideStart.y + guideEnd.y) / 2
	const offset = target.axis === 'x' ? { x: 8, y: 0 } : { x: 0, y: -12 }

	const x = midX + offset.x
	const y = midY + offset.y

	// Format score text
	let scoreText: string
	if (showBreakdown) {
		const b = breakdown
		scoreText = `${score.toFixed(1)} [d${b.distance.toFixed(1)} g${b.grabProximity.toFixed(1)} h${b.hierarchy.toFixed(1)} v${b.velocity.toFixed(1)}]`
	} else {
		scoreText = score.toFixed(2)
	}

	const width = showBreakdown ? 140 : 36
	const height = 14

	return (
		<g>
			{/* Background */}
			<rect
				x={x - 2}
				y={y - height + 2}
				width={width}
				height={height}
				fill={isWinner ? color : 'rgba(0,0,0,0.8)'}
				rx={3}
			/>

			{/* Score text */}
			<text
				x={x}
				y={y - 2}
				fontSize={10}
				fill={isWinner ? 'white' : color}
				fontFamily="monospace"
				fontWeight={isWinner ? 'bold' : 'normal'}
			>
				{scoreText}
			</text>

			{/* Edge indicator */}
			{dragSnapEdge && (
				<text
					x={x + width - 20}
					y={y - 2}
					fontSize={8}
					fill={isWinner ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)'}
					fontFamily="monospace"
				>
					{dragSnapEdge.slice(0, 1).toUpperCase()}
				</text>
			)}
		</g>
	)
}

interface DebugScorePanelProps {
	candidates: ScoredCandidate[]
	activeValues: Set<string>
	viewBounds: Bounds
	showBreakdown: boolean
}

/**
 * Panel showing ranked list of candidates
 */
function DebugScorePanel({
	candidates,
	activeValues,
	viewBounds,
	showBreakdown
}: DebugScorePanelProps) {
	// Position panel in top-right corner
	const panelX = viewBounds.x + viewBounds.width - 200
	const panelY = viewBounds.y + 10
	const lineHeight = 14
	const panelHeight = candidates.length * lineHeight + 20

	return (
		<g className="debug-panel">
			{/* Panel background */}
			<rect
				x={panelX}
				y={panelY}
				width={190}
				height={panelHeight}
				fill="rgba(0,0,0,0.85)"
				rx={4}
			/>

			{/* Title */}
			<text
				x={panelX + 8}
				y={panelY + 14}
				fontSize={11}
				fill="#94a3b8"
				fontFamily="system-ui, sans-serif"
				fontWeight="bold"
			>
				Snap Candidates
			</text>

			{/* Candidate list */}
			{candidates.map((candidate, index) => {
				const isActive = activeValues.has(
					`${candidate.target.axis}-${candidate.target.value}`
				)
				const y = panelY + 28 + index * lineHeight

				return (
					<g key={`panel-item-${index}`}>
						{/* Rank number */}
						<text
							x={panelX + 8}
							y={y}
							fontSize={10}
							fill={isActive ? '#22c55e' : '#64748b'}
							fontFamily="monospace"
						>
							{index + 1}.
						</text>

						{/* Axis and type */}
						<text
							x={panelX + 24}
							y={y}
							fontSize={10}
							fill={isActive ? '#22c55e' : '#e2e8f0'}
							fontFamily="monospace"
						>
							{candidate.target.axis.toUpperCase()}:{candidate.target.type.slice(0, 4)}
						</text>

						{/* Value */}
						<text
							x={panelX + 70}
							y={y}
							fontSize={10}
							fill={isActive ? '#22c55e' : '#94a3b8'}
							fontFamily="monospace"
						>
							@{Math.round(candidate.target.value)}
						</text>

						{/* Score */}
						<text
							x={panelX + 115}
							y={y}
							fontSize={10}
							fill={isActive ? '#22c55e' : '#fbbf24'}
							fontFamily="monospace"
							fontWeight={isActive ? 'bold' : 'normal'}
						>
							{candidate.score.toFixed(2)}
						</text>

						{/* Active indicator */}
						{isActive && (
							<text
								x={panelX + 160}
								y={y}
								fontSize={10}
								fill="#22c55e"
							>
								✓
							</text>
						)}
					</g>
				)
			})}
		</g>
	)
}

// vim: ts=4
