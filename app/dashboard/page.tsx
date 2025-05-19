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

export default function DashboardPage() {
  const router = useRouter()
  const [domains, setDomains] = useState<DomainSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DomainFilters>({})
  const [pagination, setPagination] = useState<PaginationParams>({
    page: 1,
    size: 50,
    total: 0
  })
  const [selectedDomain, setSelectedDomain] = useState<DomainSummary | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'visualization'>('table')

  // Fetch domains data
  const fetchDomains = async (page = 1, newFilters?: DomainFilters) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: pagination.size.toString()
      })

      const filtersToUse = newFilters || filters

      // Add filters to URL params
      Object.entries(filtersToUse).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.set(key, value.join(','))
          } else {
            params.set(key, value.toString())
          }
        }
      })

      const response = await fetch(`/api/domains?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch domains')
      }

      const data = await response.json()
      setDomains(data.data)
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and filter changes
  useEffect(() => {
    fetchDomains(1, filters)
  }, [filters])

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
    router.push(`/domain/${domain.id}`)
  }

  const handleViewProtein = (domain: DomainSummary) => {
    router.push(`/protein/${domain.protein_id}`)
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
      render: (value: string | null) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value ? 'bg-classification-t-group text-white' : 'bg-gray-100 text-gray-500'
        }`}>
          {value || 'Unclassified'}
        </span>
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

  // Summary statistics
  const totalDomains = pagination.total || 0
  const classifiedDomains = domains.filter(d => d.t_group).length
  const highConfidenceDomains = domains.filter(d => d.confidence && d.confidence >= 0.8).length
  const avgConfidence = domains.reduce((sum, d) => sum + (d.confidence || 0), 0) / domains.length

  return (
    <div className="w-screen px-4">
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
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-2xl font-bold text-blue-600">{totalDomains.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Domains</div>
        </Card>
        <Card className="p-6">
          <div className="text-2xl font-bold text-green-600">{classifiedDomains}</div>
          <div className="text-sm text-gray-600">Classified Domains</div>
        </Card>
        <Card className="p-6">
          <div className="text-2xl font-bold text-purple-600">{highConfidenceDomains}</div>
          <div className="text-sm text-gray-600">High Confidence (≥0.8)</div>
        </Card>
        <Card className="p-6">
          <div className="text-2xl font-bold text-orange-600">
            {avgConfidence ? avgConfidence.toFixed(3) : 'N/A'}
          </div>
          <div className="text-sm text-gray-600">Average Confidence</div>
        </Card>
      </div>

      {/* Filters */}
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
              <Button onClick={() => fetchDomains()}>Retry</Button>
            </Card>
          ) : viewMode === 'table' ? (
            <div className="w-full min-w-0">
              <DataTable
                data={domains}
                columns={columns}
                pagination={pagination}
                onPageChange={handlePageChange}
                onRowClick={handleDomainClick}
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
                    <div>T: {selectedDomain.t_group || 'N/A'}</div>
                    <div>H: {selectedDomain.h_group || 'N/A'}</div>
                    <div>X: {selectedDomain.x_group || 'N/A'}</div>
                    <div>A: {selectedDomain.a_group || 'N/A'}</div>
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
    </div>
  )
}
