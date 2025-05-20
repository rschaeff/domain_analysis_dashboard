'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DomainFilters, DomainSummary, PaginationParams } from '@/lib/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BoundaryVisualization } from '@/components/visualization/BoundaryVisualization'
import { Eye, Download, BarChart3 } from 'lucide-react'
import { useNavigation } from '@/lib/navigation'

// Enhanced API Response Type
interface DomainsResponse {
  data: DomainSummary[]
  pagination: PaginationParams
  statistics: {
    totalDomains: number
    classifiedDomains: number
    highConfidenceDomains: number
    avgConfidence: number
    domainsWithEvidence: number
  }
}



export default function DashboardPage() {
  const router = useRouter()
  const nav = useNavigation()
  const [domains, setDomains] = useState<DomainSummary[]>([])
  const [loading, setLoading] = useState(false) // Start with false to avoid hydration issues
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DomainFilters>({})
  const [pagination, setPagination] = useState<PaginationParams>({
    page: 1,
    size: 50,
    total: 0
  })
  const [statistics, setStatistics] = useState({
    totalDomains: 0,
    classifiedDomains: 0,
    highConfidenceDomains: 0,
    avgConfidence: 0,
    domainsWithEvidence: 0
  })
  const [selectedDomain, setSelectedDomain] = useState<DomainSummary | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'visualization'>('table')
  const [initialLoad, setInitialLoad] = useState(true) // Track initial load separately

  // Fetch domains data
  const fetchDomains = async (page = 1, newFilters?: DomainFilters) => {
    if (initialLoad) setInitialLoad(false)
    setLoading(true)
    setStatsLoading(true)
    setError(null)

    try {
      const filtersToUse = newFilters !== undefined ? newFilters : filters

      const params = new URLSearchParams({
        page: page.toString(),
        size: '50'
      })

      // Add filters to URL params with proper mapping
      Object.entries(filtersToUse).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            // Map frontend filter names to API parameter names
            let paramKey = key
            if (key === 't_group') paramKey = 't_groups'
            else if (key === 'h_group') paramKey = 'h_groups'
            else if (key === 'x_group') paramKey = 'x_groups'  // Add this line

            params.set(paramKey, value.join(','))
          } else if (!Array.isArray(value)) {
            params.set(key, value.toString())
          }
        }
      })

      const response = await fetch(`/api/domains?${params}`)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch domains: ${response.status} ${errorText}`)
      }

      const data = await response.json()

      // Update states
      setDomains(data.data || [])
      setPagination(data.pagination || { page, size: 50, total: 0 })

      // Handle statistics - support both new and old API format
      if (data.statistics) {
        setStatistics(data.statistics)
      } else {
        // Fallback for older API format
        const domains = data.data || []
        setStatistics({
          totalDomains: data.pagination?.total || 0,
          classifiedDomains: domains.filter((d: DomainSummary) => d.t_group).length,
          highConfidenceDomains: domains.filter((d: DomainSummary) => d.confidence && d.confidence >= 0.8).length,
          avgConfidence: domains.length > 0 ? domains.reduce((sum: number, d: DomainSummary) => sum + (d.confidence || 0), 0) / domains.length : 0,
          domainsWithEvidence: domains.filter((d: DomainSummary) => d.evidence_count > 0).length
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setStatsLoading(false)
    }
  }

  // Initial load and filter changes
  useEffect(() => {
    fetchDomains(1)
  }, []) // Only run on mount

  // Handle filter changes separately
  useEffect(() => {
    if (!initialLoad) { // Skip filter changes on initial load
      fetchDomains(1)
    }
  }, [filters, initialLoad])

  // Handle filter changes
  const handleFiltersChange = (newFilters: DomainFilters) => {
    setFilters(newFilters)
  }

  const handleResetFilters = () => {
    setFilters({})
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
    fetchDomains(page)
  }

  // Handle domain selection
  const handleDomainClick = (domain: DomainSummary) => {
    setSelectedDomain(domain)
  }

  const handleViewDomain = (domain: DomainSummary) => {
    router.push(`/domains/${domain.id}`)
  }

const handleViewProtein = (domain: DomainSummary) => {
  if (domain.pdb_id && domain.chain_id) {
    const sourceId = `${domain.pdb_id}_${domain.chain_id}`
    router.push(`/protein/${sourceId}`)
  } else {
    console.error('Missing pdb_id or chain_id for domain:', domain)
  }
}

  // Enhanced classification badge renderer
  const renderClassificationBadge = (
    value: string | null,
    filterKey: 'h_group' | 'x_group' | 'a_group' | 't_group',
    label: string
  ) => {
    const currentFilters = (filters[filterKey] as string[]) || []
    const isCurrentlyFiltered = currentFilters.includes(value || '')

    return (
      <button
        onClick={(e) => {
          e.stopPropagation() // Prevent row click
          if (value) {
            // Toggle the classification in the filter
            const newFilters = isCurrentlyFiltered
              ? currentFilters.filter(item => item !== value) // Remove if already selected
              : [...currentFilters, value] // Add if not selected

            handleFiltersChange({
              ...filters,
              [filterKey]: newFilters.length > 0 ? newFilters : undefined
            })
          }
        }}
        className={`px-2 py-1 rounded text-xs font-medium transition-all duration-200 ${
          value
            ? isCurrentlyFiltered
              ? 'bg-green-500 text-white hover:bg-green-600 ring-2 ring-green-300 cursor-pointer'
              : 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 cursor-pointer'
            : 'bg-gray-100 text-gray-500 cursor-default'
        }`}
        disabled={!value}
        title={value ? (
          isCurrentlyFiltered
            ? `Click to remove ${label} ${value} from filter`
            : `Click to add ${label} ${value} to filter`
        ) : undefined}
      >
        {value || 'Unclassified'}
        {isCurrentlyFiltered && <span className="ml-1">✓</span>}
      </button>
    )
  }

  // Enhanced export functionality
  const handleExport = async () => {
    try {
      // Export all filtered results, not just current page
      const params = new URLSearchParams({ size: '10000' })
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.set(key, value.join(','))
          } else {
            params.set(key, value.toString())
          }
        }
      })

      const response = await fetch(`/api/domains?${params}`)
      const data = await response.json()

      // Convert to CSV
      const csvData = data.data.map((domain: DomainSummary) => ({
        pdb_id: domain.pdb_id,
        chain_id: domain.chain_id,
        domain_number: domain.domain_number,
        range: domain.range,
        confidence: domain.confidence,
        t_group: domain.t_group,
        h_group: domain.h_group,
        evidence_count: domain.evidence_count,
        evidence_types: domain.evidence_types
      }))

      downloadAsCSV(csvData, `domains_export_${new Date().toISOString().split('T')[0]}.csv`)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Calculate active filter count
  const activeFilterCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof DomainFilters]
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return value !== undefined && value !== null && value !== ''
  }).length

  // Table columns configuration
  const columns = [
    {
      key: 'pdb_id',
      label: 'PDB ID',
      sortable: true,
      render: (value: string, domain: DomainSummary) => (
        <button
          onClick={() => handleViewProtein(domain)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          {value}_{domain.chain_id}
        </button>
      )
    },
    {
      key: 'domain_number',
      label: 'Domain',
      sortable: true,
      render: (value: number, domain: DomainSummary) => (
        <span className="font-mono">{value}</span>
      )
    },
    {
      key: 'range',
      label: 'Range',
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      )
    },
    {
      key: 'confidence',
      label: 'Confidence',
      sortable: true,
      render: (value: number | null) => {
        if (!value) return <span className="text-gray-400">N/A</span>
        const color = value >= 0.8 ? 'text-green-600' : value >= 0.5 ? 'text-yellow-600' : 'text-red-600'
        return <span className={`font-medium ${color}`}>{value.toFixed(3)}</span>
      }
    },
    {
      key: 'x_group',
      label: 'X-Group',
      render: (value: string | null) => renderClassificationBadge(value, 'x_group', 'X-group (Possible Homology)')
    },
    {
      key: 'h_group',
      label: 'H-Group',
      render: (value: string | null) => renderClassificationBadge(value, 'h_group', 'H-group (Homology)')
    },
    {
      key: 't_group',
      label: 'T-Group',
      render: (value: string | null) => renderClassificationBadge(value, 't_group', 'T-group (Topology)')
    },
    {
      key: 'evidence_count',
      label: 'Evidence',
      sortable: true,
      render: (value: number, domain: DomainSummary) => (
        <div className="text-center">
          <span className="font-medium">{value}</span>
          <div className="text-xs text-gray-500">{domain.evidence_types}</div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, domain: DomainSummary) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewDomain(domain)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDomainClick(domain)}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ]

  // Loading state component for statistics
  const StatCard = ({
    title,
    value,
    color,
    loading
  }: {
    title: string
    value: number | string
    color: string
    loading?: boolean
  }) => (
    <Card className="p-6">
      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      ) : (
        <>
          <div className={`text-2xl font-bold ${color}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          <div className="text-sm text-gray-600">{title}</div>
        </>
      )}
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Domain Analysis Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Analyze and compare putative domain boundaries with reference data
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
          >
            Table View
          </Button>
          <Button
            variant={viewMode === 'visualization' ? 'default' : 'outline'}
            onClick={() => setViewMode('visualization')}
          >
            Visualization
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Simplified Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Domains"
          value={statistics.totalDomains}
          color="text-blue-600"
          loading={statsLoading}
        />
        <StatCard
          title="Classified"
          value={`${statistics.classifiedDomains} (${statistics.totalDomains > 0 ? Math.round((statistics.classifiedDomains / statistics.totalDomains) * 100) : 0}%)`}
          color="text-green-600"
          loading={statsLoading}
        />
        <StatCard
          title="High Confidence (≥0.8)"
          value={statistics.highConfidenceDomains}
          color="text-purple-600"
          loading={statsLoading}
        />
        <StatCard
          title="Average Confidence"
          value={statistics.avgConfidence ? statistics.avgConfidence.toFixed(3) : 'N/A'}
          color="text-orange-600"
          loading={statsLoading}
        />
      </div>

      {/* Enhanced Filters with Active Filter Count and Badge Hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg">
        <FilterPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleResetFilters}
        />
        {activeFilterCount > 0 && (
          <div className="px-6 pb-4 text-sm text-blue-700">
            💡 <strong>Tip:</strong> Click on classification badges in the table below to quickly add or remove filters!
          </div>
        )}
      </div>

{/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <Card className="p-8 text-center">
              <LoadingSpinner />
              <p className="mt-4 text-gray-600">Loading domains...</p>
            </Card>
          ) : error ? (
            <Card className="p-8 text-center">
              <div className="text-red-600 mb-4">Error: {error}</div>
              <Button onClick={() => fetchDomains(pagination.page)}>Retry</Button>
            </Card>
          ) : domains.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-gray-500 mb-4">No domains found</div>
              <p className="text-sm text-gray-400">
                Try adjusting your filters or check if data is available in the database.
              </p>
              <Button
                onClick={() => fetchDomains(1)}
                className="mt-4"
                variant="outline"
              >
                Load Data
              </Button>
            </Card>
          ) : viewMode === 'table' ? (
            <div className="w-full min-w-0">
              <DataTable
                data={domains}
                columns={columns}
                pagination={pagination}
                onPageChange={handlePageChange}
                onRowClick={handleDomainClick}
                loading={loading}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group by protein for visualization */}
              {Object.entries(
                domains.reduce((acc, domain) => {
                  const key = `${domain.pdb_id}_${domain.chain_id}`
                  if (!acc[key]) acc[key] = []
                  acc[key].push(domain)
                  return acc
                }, {} as Record<string, DomainSummary[]>)
              ).map(([proteinKey, proteinDomains]) => {
                const firstDomain = proteinDomains[0]

                // Use actual sequence length from domain data, or estimate from ranges if not available
                let sequenceLength = firstDomain.protein_sequence_length

                if (!sequenceLength) {
                  // Fallback: estimate from maximum domain range
                  sequenceLength = Math.max(
                    ...proteinDomains.map(d => {
                      // Parse range to get maximum position
                      const rangeParts = d.range?.split(',') || []
                      let maxPos = 0
                      for (const part of rangeParts) {
                        // Handle ranges with chain prefixes like "A:1-100"
                        const withoutChain = part.includes(':') ? part.split(':')[1] : part
                        const endPos = parseInt(withoutChain.split('-')[1] || '0')
                        if (!isNaN(endPos)) {
                          maxPos = Math.max(maxPos, endPos)
                        }
                      }
                      return maxPos
                    })
                  )

                  // Add some padding to the estimated length
                  if (sequenceLength > 0) {
                    sequenceLength = Math.ceil(sequenceLength * 1.1) // Add 10% padding
                  }

                  // If we still don't have a length, use a default
                  if (!sequenceLength || sequenceLength <= 0) {
                    sequenceLength = 500
                  }
                }

                return (
                  <Card key={proteinKey} className="p-4">
                    {/* Protein header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold">
                          Protein: {firstDomain.pdb_id}_{firstDomain.chain_id}
                        </h3>
                        <div className="text-sm text-gray-600">
                          {proteinDomains.length} domain{proteinDomains.length !== 1 ? 's' : ''} | {sequenceLength} residues
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewProtein(firstDomain)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    </div>

                    {/* Domain stats for this protein */}
                    <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="font-medium text-blue-900">Total Domains</div>
                        <div className="text-xl font-bold text-blue-600">{proteinDomains.length}</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <div className="font-medium text-green-900">Classified</div>
                        <div className="text-xl font-bold text-green-600">
                          {proteinDomains.filter(d => d.t_group).length}
                        </div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded">
                        <div className="font-medium text-purple-900">With Evidence</div>
                        <div className="text-xl font-bold text-purple-600">
                          {proteinDomains.filter(d => d.evidence_count > 0).length}
                        </div>
                      </div>
                      <div className="bg-orange-50 p-3 rounded">
                        <div className="font-medium text-orange-900">Avg Confidence</div>
                        <div className="text-xl font-bold text-orange-600">
                          {proteinDomains.filter(d => d.confidence !== null).length > 0
                            ? (proteinDomains
                                .filter(d => d.confidence !== null)
                                .reduce((sum, d) => sum + (d.confidence || 0), 0) /
                              proteinDomains.filter(d => d.confidence !== null).length).toFixed(2)
                            : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Boundary visualization */}
                    <BoundaryVisualization
                      protein={{
                        id: firstDomain.protein_id,
                        pdb_id: firstDomain.pdb_id,
                        chain_id: firstDomain.chain_id,
                        sequence_length: sequenceLength
                      }}
                      domains={proteinDomains}
                      onDomainClick={handleDomainClick}
                    />

                    {/* Domain details list */}
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Domain Details</h4>
                      <div className="space-y-2">
                        {proteinDomains.map((domain, index) => (
                          <div
                            key={domain.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded border hover:bg-gray-100 cursor-pointer transition-colors"
                            onClick={() => handleDomainClick(domain)}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded border-2 opacity-80"
                                style={{
                                  backgroundColor: `hsl(${index * 137.5 % 360}, 70%, 50%)`,
                                  borderColor: `hsl(${index * 137.5 % 360}, 70%, 40%)`
                                }}
                              />
                              <div>
                                <div className="font-medium text-sm">
                                  Domain {domain.domain_number}
                                </div>
                                <div className="text-xs text-gray-600 font-mono">
                                  {domain.range}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              {domain.t_group && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {domain.t_group}
                                </span>
                              )}
                              {domain.confidence && (
                                <span className={`font-medium ${
                                  domain.confidence >= 0.8 ? 'text-green-600' :
                                  domain.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {domain.confidence.toFixed(2)}
                                </span>
                              )}
                              <span className="text-gray-500">
                                {domain.evidence_count} evidence
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Side Panel - Domain Details */}
        {selectedDomain && (
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Domain Details</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDomain(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                {/* Basic Information */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Protein</label>
                  <div className="text-sm font-mono">{selectedDomain.pdb_id}_{selectedDomain.chain_id}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Domain Number</label>
                  <div className="text-sm">{selectedDomain.domain_number}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Range</label>
                  <div className="text-sm font-mono">{selectedDomain.range}</div>
                </div>

                {/* Quality Metrics */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Quality Metrics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Confidence:</span>
                      <span className={`text-sm font-medium ${
                        selectedDomain.confidence && selectedDomain.confidence >= 0.8 ? 'text-green-600' :
                        selectedDomain.confidence && selectedDomain.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {selectedDomain.confidence ? selectedDomain.confidence.toFixed(3) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Evidence Count:</span>
                      <span className="text-sm font-medium">{selectedDomain.evidence_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Evidence Types:</span>
                      <span className="text-sm">{selectedDomain.evidence_types}</span>
                    </div>
                  </div>
                </div>

                {/* Classification */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Classification</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">T-Group:</span>
                      <span className={`text-sm px-2 py-1 rounded ${
                        selectedDomain.t_group ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {selectedDomain.t_group || 'Not assigned'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">H-Group:</span>
                      <span className={`text-sm px-2 py-1 rounded ${
                        selectedDomain.h_group ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {selectedDomain.h_group || 'Not assigned'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">X-Group:</span>
                      <span className={`text-sm px-2 py-1 rounded ${
                        selectedDomain.x_group ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {selectedDomain.x_group || 'Not assigned'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">A-Group:</span>
                      <span className={`text-sm px-2 py-1 rounded ${
                        selectedDomain.a_group ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {selectedDomain.a_group || 'Not assigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Processing Information */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Processing Info</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Batch:</span>
                      <span className="text-sm">{selectedDomain.batch_id || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Reference:</span>
                      <span className="text-sm">{selectedDomain.reference_version || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Timestamp:</span>
                      <span className="text-sm">
                        {selectedDomain.timestamp ? new Date(selectedDomain.timestamp).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t pt-4 space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => handleViewDomain(selectedDomain)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Full Details
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleViewProtein(selectedDomain)}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Protein
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// Utility function for CSV export
function downloadAsCSV(data: any[], filename: string) {
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(key => {
        const value = row[key]
        // Handle values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value || ''
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
