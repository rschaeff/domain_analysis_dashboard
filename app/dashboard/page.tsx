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

      // Add filters to URL params with debugging
      Object.entries(filtersToUse).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            // Map frontend filter names to API parameter names
            const paramKey = key === 't_group' ? 't_groups' : key === 'h_group' ? 'h_groups' : key
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
    if (domain.protein_id) {
      router.push(`/protein/${domain.protein_id}`)
    } else {
      console.error('No protein_id found for domain:', domain)
    }
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
      key: 't_group',
      label: 'T-Group',
      render: (value: string | null, domain: DomainSummary) => (
        <button
          onClick={(e) => {
            e.stopPropagation() // Prevent row click
            if (value) {
              // Set filter to this T-group
              handleFiltersChange({ ...filters, t_group: [value] })
            }
          }}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            value
              ? 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
              : 'bg-gray-100 text-gray-500 cursor-default'
          }`}
          disabled={!value}
          title={value ? `Filter by T-group ${value}` : undefined}
        >
          {value || 'Unclassified'}
        </button>
      )
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

      {/* Enhanced Filters with Active Filter Count */}
      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

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
                return (
                  <BoundaryVisualization
                    key={proteinKey}
                    protein={{
                      id: firstDomain.protein_id,
                      pdb_id: firstDomain.pdb_id,
                      chain_id: firstDomain.chain_id,
                      sequence_length: 500 // This would come from the actual data
                    }}
                    domains={proteinDomains}
                    onDomainClick={handleDomainClick}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Side Panel - Domain Details */}
        {selectedDomain && (
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Domain Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Protein</label>
                  <div className="text-sm">{selectedDomain.pdb_id}_{selectedDomain.chain_id}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Domain Number</label>
                  <div className="text-sm">{selectedDomain.domain_number}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Range</label>
                  <div className="text-sm font-mono">{selectedDomain.range}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Confidence</label>
                  <div className="text-sm">
                    {selectedDomain.confidence ? selectedDomain.confidence.toFixed(3) : 'N/A'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Classification</label>
                  <div className="text-sm space-y-1">
                    <div>T: {selectedDomain.t_group || 'Not assigned'}</div>
                    <div>H: {selectedDomain.h_group || 'Not assigned'}</div>
                    <div>X: {selectedDomain.x_group || 'Not assigned'}</div>
                    <div>A: {selectedDomain.a_group || 'Not assigned'}</div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Evidence</label>
                  <div className="text-sm">
                    <div>Count: {selectedDomain.evidence_count}</div>
                    <div>Types: {selectedDomain.evidence_types}</div>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button
                    className="w-full"
                    onClick={() => handleViewDomain(selectedDomain)}
                  >
                    View Full Details
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
