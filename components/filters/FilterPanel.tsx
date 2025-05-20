// Enhanced Filter Panel with Better UX
// components/filters/FilterPanel.tsx

'use client'

import React, { useState, useCallback } from 'react'
import { DomainFilters } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react'

interface FilterPanelProps {
  filters: DomainFilters
  onFiltersChange: (filters: DomainFilters) => void
  onReset: () => void
  className?: string
}

export function FilterPanel({
  filters,
  onFiltersChange,
  onReset,
  className = ''
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Correct mock data with proper ECOD hierarchy
  const xGroups = ['2001', '2002', '2003', '2004', '2005', '3001', '3002', '3003', '3004', '3005']
  const allHGroups = [
    '2001.1', '2001.2', '2001.3',
    '2002.1', '2002.2',
    '2003.1', '2003.2', '2003.3',
    '2004.1', '2004.2',
    '2005.1', '2005.2',
    '3001.1', '3001.2',
    '3002.1', '3002.2',
    '3003.1', '3003.2', '3003.3',
    '3004.1', '3004.2',
    '3005.1', '3005.2'
  ]
  const allTGroups = [
    '2001.1.1', '2001.1.2', '2001.2.1', '2001.3.1',
    '2002.1.1', '2002.1.2', '2002.2.1',
    '2003.1.1', '2003.1.2', '2003.2.1', '2003.3.1',
    '2004.1.1', '2004.1.2', '2004.2.1',
    '2005.1.1', '2005.2.1',
    '3001.1.1', '3001.1.2', '3001.2.1',
    '3002.1.1', '3002.1.2',
    '3003.1.1', '3003.2.1', '3003.3.1',
    '3004.1.1', '3004.1.2',
    '3005.1.1', '3005.1.2'
  ]

  // Helper functions for correct hierarchical filtering
  const getParentHGroup = (tGroup: string): string => {
    const parts = tGroup.split('.')
    return `${parts[0]}.${parts[1]}` // e.g., "2001.1.1" -> "2001.1"
  }

  const getParentXGroup = (hGroup: string): string => {
    return hGroup.split('.')[0] // e.g., "2001.1" -> "2001"
  }

  const getTGroupsForHGroup = (hGroup: string): string[] => {
    return allTGroups.filter(tGroup => tGroup.startsWith(hGroup + '.'))
  }

  const getHGroupsForXGroup = (xGroup: string): string[] => {
    return allHGroups.filter(hGroup => hGroup.startsWith(xGroup + '.'))
  }

  const getFilteredTGroups = (): string[] => {
    const selectedHGroups = filters.h_group || []
    if (selectedHGroups.length === 0) {
      return allTGroups
    }
    // Only show T-groups that belong to selected H-groups
    return allTGroups.filter(tGroup =>
      selectedHGroups.some(hGroup => tGroup.startsWith(hGroup + '.'))
    )
  }

  const getFilteredHGroups = (): string[] => {
    const selectedXGroups = filters.x_group || []
    if (selectedXGroups.length === 0) {
      return allHGroups
    }
    // Only show H-groups that belong to selected X-groups
    return allHGroups.filter(hGroup =>
      selectedXGroups.some(xGroup => hGroup.startsWith(xGroup + '.'))
    )
  }

  // Enhanced update filter to handle correct hierarchical relationships
  const updateFilterWithHierarchy = useCallback(<K extends keyof DomainFilters>(
    key: K,
    value: DomainFilters[K]
  ) => {
    let newFilters = { ...filters, [key]: value }

    // Handle X-group changes - clear conflicting H-groups and T-groups
    if (key === 'x_group' && Array.isArray(value)) {
      const selectedXGroups = value as string[]
      const currentHGroups = filters.h_group || []
      const currentTGroups = filters.t_group || []

      if (selectedXGroups.length > 0) {
        // Filter H-groups to only keep those that belong to selected X-groups
        const validHGroups = currentHGroups.filter(hGroup =>
          selectedXGroups.some(xGroup => hGroup.startsWith(xGroup + '.'))
        )
        newFilters.h_group = validHGroups.length > 0 ? validHGroups : undefined

        // Filter T-groups based on remaining valid H-groups
        if (validHGroups.length > 0) {
          const validTGroups = currentTGroups.filter(tGroup =>
            validHGroups.some(hGroup => tGroup.startsWith(hGroup + '.'))
          )
          newFilters.t_group = validTGroups.length > 0 ? validTGroups : undefined
        } else {
          newFilters.t_group = undefined
        }
      }
    }

    // Handle H-group changes - clear conflicting T-groups, auto-select X-groups
    if (key === 'h_group' && Array.isArray(value)) {
      const selectedHGroups = value as string[]
      const currentTGroups = filters.t_group || []

      if (selectedHGroups.length > 0) {
        // Auto-select parent X-groups
        const parentXGroups = [...new Set(selectedHGroups.map(getParentXGroup))]
        const currentXGroups = filters.x_group || []
        const allXGroups = [...new Set([...currentXGroups, ...parentXGroups])]
        newFilters.x_group = allXGroups

        // Filter T-groups to only keep those that belong to selected H-groups
        const validTGroups = currentTGroups.filter(tGroup =>
          selectedHGroups.some(hGroup => tGroup.startsWith(hGroup + '.'))
        )
        newFilters.t_group = validTGroups.length > 0 ? validTGroups : undefined
      }
    }

    // Handle T-group changes - auto-select parent H-groups and X-groups
    if (key === 't_group' && Array.isArray(value)) {
      const selectedTGroups = value as string[]

      if (selectedTGroups.length > 0) {
        // Auto-select parent H-groups
        const parentHGroups = [...new Set(selectedTGroups.map(getParentHGroup))]
        const currentHGroups = filters.h_group || []
        const allHGroups = [...new Set([...currentHGroups, ...parentHGroups])]
        newFilters.h_group = allHGroups

        // Auto-select parent X-groups
        const parentXGroups = [...new Set(parentHGroups.map(getParentXGroup))]
        const currentXGroups = filters.x_group || []
        const allXGroups = [...new Set([...currentXGroups, ...parentXGroups])]
        newFilters.x_group = allXGroups
      }
    }

    onFiltersChange(newFilters)
  }, [filters, onFiltersChange])

  const updateFilter = useCallback(<K extends keyof DomainFilters>(
    key: K,
    value: DomainFilters[K]
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }, [filters, onFiltersChange])

  const removeFilter = useCallback((key: keyof DomainFilters) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    onFiltersChange(newFilters)
  }, [filters, onFiltersChange])

  const activeFilterCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof DomainFilters]
    return value !== undefined && value !== null && value !== ''
  }).length

  // Quick clear for specific filter types
  const clearConfidenceFilters = () => {
    const newFilters = { ...filters }
    delete newFilters.min_confidence
    delete newFilters.max_confidence
    onFiltersChange(newFilters)
  }

  const clearClassificationFilters = () => {
    const newFilters = { ...filters }
    delete newFilters.t_group
    delete newFilters.h_group
    delete newFilters.x_group
    delete newFilters.a_group
    onFiltersChange(newFilters)
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header with filter count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full font-medium">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Less Filters
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  More Filters
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Primary filters - always visible */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">PDB ID</label>
            <Input
              placeholder="e.g., 1abc"
              value={filters.pdb_id || ''}
              onChange={(e) => updateFilter('pdb_id', e.target.value || undefined)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Chain ID</label>
            <Input
              placeholder="e.g., A"
              value={filters.chain_id || ''}
              onChange={(e) => updateFilter('chain_id', e.target.value || undefined)}
              maxLength={1}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              X-Groups (Architecture)
              {filters.x_group && filters.x_group.length > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  ({filters.x_group.length} selected)
                </span>
              )}
            </label>
            <Select
              multiple
              placeholder="Select X-Groups..."
              value={filters.x_group || []}
              onChange={(value) => updateFilterWithHierarchy('x_group', value.length > 0 ? value : undefined)}
              options={xGroups.map(group => ({ value: group, label: `X-Group ${group}` }))}
              search
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              H-Groups (Homology)
              {filters.h_group && filters.h_group.length > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  ({filters.h_group.length} selected)
                </span>
              )}
            </label>
            <Select
              multiple
              placeholder={
                filters.x_group && filters.x_group.length > 0
                  ? "Select H-Groups from chosen X-Groups..."
                  : "Select H-Groups..."
              }
              value={filters.h_group || []}
              onChange={(value) => updateFilterWithHierarchy('h_group', value.length > 0 ? value : undefined)}
              options={getFilteredHGroups().map(group => ({
                value: group,
                label: `H-Group ${group}`
              }))}
              search
            />
            {filters.x_group && filters.x_group.length > 0 && (
              <div className="mt-1 text-xs text-blue-600">
                Showing H-groups for: {filters.x_group.join(', ')}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              T-Groups (Topology)
              {filters.t_group && filters.t_group.length > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  ({filters.t_group.length} selected)
                </span>
              )}
            </label>
            <Select
              multiple
              placeholder={
                filters.h_group && filters.h_group.length > 0
                  ? "Select T-Groups from chosen H-Groups..."
                  : "Select T-Groups..."
              }
              value={filters.t_group || []}
              onChange={(value) => updateFilterWithHierarchy('t_group', value.length > 0 ? value : undefined)}
              options={getFilteredTGroups().map(group => ({
                value: group,
                label: `T-Group ${group}`
              }))}
              search
            />
            {filters.h_group && filters.h_group.length > 0 && (
              <div className="mt-1 text-xs text-blue-600">
                Showing T-groups for: {filters.h_group.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Confidence range with quick presets */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Confidence Range</label>
            {(filters.min_confidence !== undefined || filters.max_confidence !== undefined) && (
              <button
                onClick={clearConfidenceFilters}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                placeholder="Min (0.0)"
                value={filters.min_confidence ?? ''}
                onChange={(e) => updateFilter('min_confidence', e.target.value ? parseFloat(e.target.value) : undefined)}
              />
            </div>
            <span className="text-gray-500">to</span>
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                placeholder="Max (1.0)"
                value={filters.max_confidence ?? ''}
                onChange={(e) => updateFilter('max_confidence', e.target.value ? parseFloat(e.target.value) : undefined)}
              />
            </div>
            {/* Quick preset buttons */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateFilter('min_confidence', 0.8)
                  updateFilter('max_confidence', undefined)
                }}
                className="px-2 py-1 text-xs"
              >
                High
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateFilter('min_confidence', 0.5)
                  updateFilter('max_confidence', 0.8)
                }}
                className="px-2 py-1 text-xs"
              >
                Med
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateFilter('min_confidence', undefined)
                  updateFilter('max_confidence', 0.5)
                }}
                className="px-2 py-1 text-xs"
              >
                Low
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced filters - expandable */}
        {isExpanded && (
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-gray-700">Additional Classification</h4>
              {(filters.x_group || filters.a_group) && (
                <button
                  onClick={clearClassificationFilters}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear All Classification
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">X-Groups (Architecture)</label>
                <Select
                  multiple
                  placeholder="Select X-Groups..."
                  value={filters.x_group || []}
                  onChange={(value) => updateFilter('x_group', value.length > 0 ? value : undefined)}
                  options={hGroups.map(group => ({ value: group, label: group }))}
                  search
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">A-Groups (Fold)</label>
                <Select
                  multiple
                  placeholder="Select A-Groups..."
                  value={filters.a_group || []}
                  onChange={(value) => updateFilter('a_group', value.length > 0 ? value : undefined)}
                  options={['a.1', 'a.2', 'a.3', 'a.4', 'a.5'].map(group => ({ value: group, label: group }))}
                  search
                />
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3">Sequence Properties</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Min Sequence Length</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g., 50"
                    value={filters.sequence_length_min ?? ''}
                    onChange={(e) => updateFilter('sequence_length_min', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Sequence Length</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g., 1000"
                    value={filters.sequence_length_max ?? ''}
                    onChange={(e) => updateFilter('sequence_length_max', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active filters summary */}
        {activeFilterCount > 0 && (
          <div className="border-t pt-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(filters).map(([key, value]) => {
                if (value === undefined || value === null || value === '') return null

                let displayValue: string
                if (Array.isArray(value)) {
                  if (value.length === 0) return null
                  displayValue = value.length === 1 ? value[0] : `${value.length} selected`
                } else {
                  displayValue = String(value)
                }

                // Prettier key names with hierarchy indication
                const keyLabels: Record<string, string> = {
                  pdb_id: 'PDB',
                  chain_id: 'Chain',
                  t_group: 'T-Groups',
                  h_group: 'H-Groups',
                  x_group: 'X-Groups',
                  a_group: 'A-Groups',
                  min_confidence: 'Min Confidence',
                  max_confidence: 'Max Confidence',
                  sequence_length_min: 'Min Length',
                  sequence_length_max: 'Max Length'
                }

                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-sm border border-blue-200"
                  >
                    <span className="font-medium">{keyLabels[key] || key}:</span>
                    <span>{displayValue}</span>
                    <button
                      onClick={() => removeFilter(key as keyof DomainFilters)}
                      className="ml-1 hover:text-blue-900 hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
