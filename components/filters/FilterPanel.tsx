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

  // Available options (these would typically come from API)
  const tGroups = ['2001.1.1', '2002.1.1', '2003.1.1', '2004.1.1'] // Example
  const hGroups = ['2001', '2002', '2003', '2004'] // Example
  const xGroups = ['2001', '2002', '2003', '2004'] // Example
  const aGroups = ['a.1', 'a.2', 'a.3', 'a.4'] // Example

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

  const activeFilterCount = Object.keys(filters).length

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-medium">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
              {activeFilterCount}
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
              Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Quick filters - always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">PDB ID</label>
          <div className="relative">
            <Input
              placeholder="e.g., 1abc"
              value={filters.pdb_id || ''}
              onChange={(e) => updateFilter('pdb_id', e.target.value || undefined)}
            />
            {filters.pdb_id && (
              <button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => removeFilter('pdb_id')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Chain ID</label>
          <div className="relative">
            <Input
              placeholder="e.g., A"
              value={filters.chain_id || ''}
              onChange={(e) => updateFilter('chain_id', e.target.value || undefined)}
            />
            {filters.chain_id && (
              <button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => removeFilter('chain_id')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Min Confidence</label>
          <Input
            type="number"
            min="0"
            max="1"
            step="0.1"
            placeholder="0.0"
            value={filters.min_confidence ?? ''}
            onChange={(e) => updateFilter('min_confidence', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Max Confidence</label>
          <Input
            type="number"
            min="0"
            max="1"
            step="0.1"
            placeholder="1.0"
            value={filters.max_confidence ?? ''}
            onChange={(e) => updateFilter('max_confidence', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Advanced filters - expandable */}
      {isExpanded && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3 text-gray-700">Classification Groups</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">T-Groups</label>
              <Select
                multiple
                placeholder="Select T-Groups"
                value={filters.t_group || []}
                onChange={(value) => updateFilter('t_group', value.length > 0 ? value : undefined)}
                options={tGroups.map(group => ({ value: group, label: group }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">H-Groups</label>
              <Select
                multiple
                placeholder="Select H-Groups"
                value={filters.h_group || []}
                onChange={(value) => updateFilter('h_group', value.length > 0 ? value : undefined)}
                options={hGroups.map(group => ({ value: group, label: group }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">X-Groups</label>
              <Select
                multiple
                placeholder="Select X-Groups"
                value={filters.x_group || []}
                onChange={(value) => updateFilter('x_group', value.length > 0 ? value : undefined)}
                options={xGroups.map(group => ({ value: group, label: group }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">A-Groups</label>
              <Select
                multiple
                placeholder="Select A-Groups"
                value={filters.a_group || []}
                onChange={(value) => updateFilter('a_group', value.length > 0 ? value : undefined)}
                options={aGroups.map(group => ({ value: group, label: group }))}
              />
            </div>
          </div>

          <h4 className="text-sm font-medium mb-3 text-gray-700">Protein Properties</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Min Sequence Length</label>
              <Input
                type="number"
                min="1"
                placeholder="e.g., 50"
                value={filters.sequence_length_min ?? ''}
                onChange={(e) => updateFilter('sequence_length_min', e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Max Sequence Length</label>
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
      )}

      {/* Active filters summary */}
      {activeFilterCount > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              if (value === undefined || value === null) return null
              
              let displayValue: string
              if (Array.isArray(value)) {
                displayValue = value.join(', ')
              } else {
                displayValue = String(value)
              }

              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  <span className="font-medium">{key}:</span>
                  <span>{displayValue}</span>
                  <button
                    onClick={() => removeFilter(key as keyof DomainFilters)}
                    className="ml-1 hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
