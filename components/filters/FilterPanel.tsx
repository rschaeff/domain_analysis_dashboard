import React, { useState, useCallback, useEffect, useRef } from 'react'
import { DomainFilters } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { ChevronDown, ChevronUp, Filter, X, Search, Loader } from 'lucide-react'

interface FilterPanelProps {
  filters: DomainFilters
  onFiltersChange: (filters: DomainFilters) => void
  onReset: () => void
  className?: string
}

interface GroupOption {
  value: string
  label: string
  count: number
}

interface AutocompleteProps {
  type: 'x_group' | 'h_group' | 't_group' | 'a_group'
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  label: string
}

// Autocomplete component for classification groups
function ClassificationAutocomplete({ type, value, onChange, placeholder, label }: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Fetch options from API
  const fetchOptions = useCallback(async (searchTerm: string = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type,
        limit: '20'
      })
      if (searchTerm) {
        params.set('search', searchTerm)
      }

      const response = await fetch(`/api/filter-options?${params}`)
      if (!response.ok) throw new Error('Failed to fetch options')

      const data = await response.json()
      setOptions(data.options || [])
      setHasMore(data.hasMore || false)
    } catch (error) {
      console.error('Error fetching filter options:', error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [type])

  // Debounced search
  const debouncedSearch = useCallback((searchTerm: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchOptions(searchTerm)
    }, 300)
  }, [fetchOptions])

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value
    setSearch(searchTerm)
    debouncedSearch(searchTerm)
  }

  // Initial load
  useEffect(() => {
    if (isOpen && options.length === 0) {
      fetchOptions()
    }
  }, [isOpen, fetchOptions, options.length])

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Toggle option selection
  const toggleOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue]
    onChange(newValue)
  }

  // Remove selected option
  const removeOption = (optionValue: string) => {
    onChange(value.filter(v => v !== optionValue))
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium mb-2">
        {label}
        {value.length > 0 && (
          <span className="ml-2 text-xs text-gray-500">
            ({value.length} selected)
          </span>
        )}
      </label>

      {/* Selected values */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {value.map(val => (
            <span
              key={val}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
            >
              {val}
              <button
                onClick={() => removeOption(val)}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input field */}
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={search}
          onChange={handleSearchChange}
          onFocus={() => setIsOpen(true)}
          className="pr-10"
        />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2"
        >
          {loading ? (
            <Loader className="w-4 h-4 animate-spin text-gray-500" />
          ) : (
            <Search className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 && !loading ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {search ? 'No matching groups found' : 'Start typing to search...'}
            </div>
          ) : (
            <>
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                    value.includes(option.value) ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={value.includes(option.value)}
                      readOnly
                      className="w-4 h-4"
                    />
                    {option.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {option.count.toLocaleString()}
                  </span>
                </button>
              ))}
              {hasMore && (
                <div className="px-3 py-2 text-xs text-gray-500 border-t">
                  Type to search for more groups...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function FilterPanel({
  filters,
  onFiltersChange,
  onReset,
  className = ''
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

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
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return value !== undefined && value !== null && value !== ''
  }).length

  // Quick clear functions
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
        {/* Header */}
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

        {/* Primary filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <label className="block text-sm font-medium mb-2">Domain Number</label>
            <Input
              type="number"
              min="1"
              placeholder="e.g., 1"
              value={filters.domain_number ?? ''}
              onChange={(e) => updateFilter('domain_number', e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* Confidence range */}
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
                High (≥0.8)
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
                Medium
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
                Low (<0.5)
              </Button>
            </div>
          </div>
        </div>

        {/* ECOD Classification - always visible with autocomplete */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-gray-700">ECOD Classification</h4>
            {(filters.t_group?.length || filters.h_group?.length || filters.x_group?.length || filters.a_group?.length) && (
              <button
                onClick={clearClassificationFilters}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear All Classification
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ClassificationAutocomplete
              type="x_group"
              value={filters.x_group || []}
              onChange={(value) => updateFilter('x_group', value.length > 0 ? value : undefined)}
              placeholder="Search X-Groups (Architecture)..."
              label="X-Groups (Architecture)"
            />

            <ClassificationAutocomplete
              type="h_group"
              value={filters.h_group || []}
              onChange={(value) => updateFilter('h_group', value.length > 0 ? value : undefined)}
              placeholder="Search H-Groups (Homology)..."
              label="H-Groups (Homology)"
            />

            <ClassificationAutocomplete
              type="t_group"
              value={filters.t_group || []}
              onChange={(value) => updateFilter('t_group', value.length > 0 ? value : undefined)}
              placeholder="Search T-Groups (Topology)..."
              label="T-Groups (Topology)"
            />

            <ClassificationAutocomplete
              type="a_group"
              value={filters.a_group || []}
              onChange={(value) => updateFilter('a_group', value.length > 0 ? value : undefined)}
              placeholder="Search A-Groups (Fold)..."
              label="A-Groups (Fold)"
            />
          </div>
        </div>

        {/* Advanced filters - expandable */}
        {isExpanded && (
          <div className="border-t pt-6 space-y-4">
            <h4 className="text-md font-medium text-gray-700">Additional Filters</h4>

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

              <div>
                <label className="block text-sm font-medium mb-2">Min Evidence Count</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 1"
                  value={filters.min_evidence_count ?? ''}
                  onChange={(e) => updateFilter('min_evidence_count', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Evidence Types</label>
                <Input
                  placeholder="e.g., blast,hhsearch"
                  value={filters.evidence_types || ''}
                  onChange={(e) => updateFilter('evidence_types', e.target.value || undefined)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Comma-separated: blast, hhsearch, domain_blast
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
                if (Array.isArray(value) && value.length === 0) return null

                let displayValue: string
                if (Array.isArray(value)) {
                  displayValue = value.length === 1 ? value[0] : `${value.length} selected`
                } else {
                  displayValue = String(value)
                }

                const keyLabels: Record<string, string> = {
                  pdb_id: 'PDB',
                  chain_id: 'Chain',
                  domain_number: 'Domain #',
                  t_group: 'T-Groups',
                  h_group: 'H-Groups',
                  x_group: 'X-Groups',
                  a_group: 'A-Groups',
                  min_confidence: 'Min Confidence',
                  max_confidence: 'Max Confidence',
                  sequence_length_min: 'Min Length',
                  sequence_length_max: 'Max Length',
                  min_evidence_count: 'Min Evidence',
                  evidence_types: 'Evidence Types'
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
