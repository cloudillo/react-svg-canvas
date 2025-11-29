/**
 * useSelection hook - manages selection state for canvas objects
 */

import React from 'react'
import type { Bounds, SpatialObject } from '../types'
import { getSelectionBounds, getObjectsIntersectingRect, getObjectsContainedInRect } from '../queries/spatial'

export interface UseSelectionOptions<T extends SpatialObject> {
	/** All selectable objects */
	objects: T[]
	/** Called when selection changes */
	onChange?: (selectedIds: Set<string>) => void
	/** Initial selection */
	initialSelection?: string[] | Set<string>
}

export interface UseSelectionReturn<T extends SpatialObject> {
	/** Currently selected IDs */
	selectedIds: Set<string>
	/** Currently selected objects */
	selectedObjects: T[]
	/** Number of selected items */
	selectionCount: number
	/** Whether anything is selected */
	hasSelection: boolean
	/** Bounds of the selection */
	selectionBounds: Bounds | null
	/** Select an object (optionally additive) */
	select: (id: string, additive?: boolean) => void
	/** Select multiple objects */
	selectMultiple: (ids: string[], additive?: boolean) => void
	/** Deselect an object */
	deselect: (id: string) => void
	/** Clear all selection */
	clear: () => void
	/** Select all objects */
	selectAll: () => void
	/** Toggle selection of an object */
	toggle: (id: string) => void
	/** Check if an object is selected */
	isSelected: (id: string) => boolean
	/** Select objects intersecting with a rectangle */
	selectInRect: (rect: Bounds, additive?: boolean, fullyContained?: boolean) => void
	/** Set selection directly */
	setSelection: (ids: string[] | Set<string>) => void
}

export function useSelection<T extends SpatialObject>(
	options: UseSelectionOptions<T>
): UseSelectionReturn<T> {
	const { objects, onChange, initialSelection } = options

	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => {
		if (initialSelection) {
			return initialSelection instanceof Set
				? initialSelection
				: new Set(initialSelection)
		}
		return new Set()
	})

	// Notify on change
	const updateSelection = React.useCallback((newIds: Set<string>) => {
		setSelectedIds(newIds)
		onChange?.(newIds)
	}, [onChange])

	// Get selected objects
	const selectedObjects = React.useMemo(() => {
		return objects.filter(obj => selectedIds.has(obj.id))
	}, [objects, selectedIds])

	// Get selection bounds
	const selectionBounds = React.useMemo(() => {
		return getSelectionBounds(selectedObjects)
	}, [selectedObjects])

	// Select single object
	const select = React.useCallback((id: string, additive: boolean = false) => {
		updateSelection(additive
			? new Set([...selectedIds, id])
			: new Set([id])
		)
	}, [selectedIds, updateSelection])

	// Select multiple objects
	const selectMultiple = React.useCallback((ids: string[], additive: boolean = false) => {
		updateSelection(additive
			? new Set([...selectedIds, ...ids])
			: new Set(ids)
		)
	}, [selectedIds, updateSelection])

	// Deselect single object
	const deselect = React.useCallback((id: string) => {
		const newIds = new Set(selectedIds)
		newIds.delete(id)
		updateSelection(newIds)
	}, [selectedIds, updateSelection])

	// Clear all selection
	const clear = React.useCallback(() => {
		if (selectedIds.size > 0) {
			updateSelection(new Set())
		}
	}, [selectedIds, updateSelection])

	// Select all
	const selectAll = React.useCallback(() => {
		updateSelection(new Set(objects.map(obj => obj.id)))
	}, [objects, updateSelection])

	// Toggle selection
	const toggle = React.useCallback((id: string) => {
		const newIds = new Set(selectedIds)
		if (newIds.has(id)) {
			newIds.delete(id)
		} else {
			newIds.add(id)
		}
		updateSelection(newIds)
	}, [selectedIds, updateSelection])

	// Check if selected
	const isSelected = React.useCallback((id: string) => {
		return selectedIds.has(id)
	}, [selectedIds])

	// Select in rectangle
	const selectInRect = React.useCallback((
		rect: Bounds,
		additive: boolean = false,
		fullyContained: boolean = false
	) => {
		const inRect = fullyContained
			? getObjectsContainedInRect(objects, rect)
			: getObjectsIntersectingRect(objects, rect)

		const ids = inRect.map(obj => obj.id)
		selectMultiple(ids, additive)
	}, [objects, selectMultiple])

	// Set selection directly
	const setSelection = React.useCallback((ids: string[] | Set<string>) => {
		updateSelection(ids instanceof Set ? ids : new Set(ids))
	}, [updateSelection])

	return {
		selectedIds,
		selectedObjects,
		selectionCount: selectedIds.size,
		hasSelection: selectedIds.size > 0,
		selectionBounds,
		select,
		selectMultiple,
		deselect,
		clear,
		selectAll,
		toggle,
		isSelected,
		selectInRect,
		setSelection
	}
}

// vim: ts=4
