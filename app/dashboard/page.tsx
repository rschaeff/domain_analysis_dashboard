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

  // Add debugging state
  const [debugInfo, setDebugInfo] = useState<string>('')

  // Fetch domains data with enhanced debugging
  const fetchDomains = async (page = 1, newFilters?: DomainFilters) => {
    console.log('🔍 fetchDomains called:', { page, newFilters, currentFilters: filters })

    setLoading(true)
    setError(null)
    setDebugInfo('Starting fetch...')

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

      const apiUrl = `/api/domains?${params}`
      console.log('🌐 API URL:', apiUrl)
      setDebugInfo(`Making request to: ${apiUrl}`)

      const response = await fetch(apiUrl)
      console.log('📡 Response status:', response.status)
      console.log('📡 Response ok:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ API Error:', response.status, errorText)
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('✅ API Response received:', {
        dataCount: data.data?.length,
        pagination: data.pagination,
        firstDomain: data.data?.[0]
      })

      setDebugInfo(`Received ${data.data?.length || 0} domains`)
      setDomains(data.data || [])
      setPagination(data.pagination || { page: 1, size: 50, total: 0 })

      if (data.data && data.data.length > 0) {
        console.log('🔍 Sample domain structure:', Object.keys(data.data[0]))
      }
    } catch (err) {
      console.error('💥 Fetch error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      setDebugInfo(`Error: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and filter changes
  useEffect(() => {
    console.log('🚀 useEffect triggered - calling fetchDomains')
    fetchDomains(1, filters)
  }, [filters])

  // Handle filter changes
  const handleFiltersChange = (newFilters: DomainFilters) => {
    console.log('🔧 Filters changed:', newFilters)
    setFilters(newFilters)
  }

  const handleResetFilters = () => {
    console.log('🔄 Resetting filters')
    setFilters({})
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    console.log('📄 Page changed to:', page)
    setPagination(prev => ({ ...prev, page }))
    fetchDomains(page)
  }

  // Handle domain selection
  const handleDomainClick = (domain: DomainSummary) => {
    console.log('👆 Domain clicked:', domain)
    setSelectedDomain(domain)
  }

  const handleViewDomain = (domain: DomainSummary) => {
    console.log('🔍 View domain:', domain.id, domain)
    router.push(`/domains/${domain.id}`)
  }

  const handleViewProtein = (domain: DomainSummary) => {
    console.log('🧬 View protein:', { protein_id: domain.protein_id, domain })

    if (domain.protein_id) {
      router.push(`/protein/${domain.protein_id}`)
    } else {
      console.error('❌ No protein_id found for domain:', domain)
      alert('Protein ID not available for this domain')
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
      render: (value: string | null) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
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
  const avgConfidence = domains.length > 0 ? domains.reduce((sum, d) => sum + (d.confidence || 0), 0) / domains.length : 0

  console.log('🎯 Render stats:', {
    totalDomains,
    domainsInState: domains.length,
    loading,
    error,
    debugInfo
  })

  return (
    <div className="space-y-6">
      {/* Debug Panel - Remove this in production */}
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <h3 className="font-semibold mb-2">🐛 Debug Info</h3>
        <div className="text-sm space-y-1">
          <div>Status: {loading ? 'Loading...' : error ? 'Error' : 'Ready'}</div>
          <div>Domains in state: {domains.length}</div>
          <div>Total from API: {totalDomains}</div>
          <div>Debug: {debugInfo}</div>
          {error && <div className="text-red-600">Error: {error}</div>}
        </div>
        <Button
          size="sm"
          onClick={() => fetchDomains(1)}
          className="mt-2"
        >
          Manual Refresh
        </Button>
      </Card>

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
              {/* Temporary: Simple table for debugging */}
              <div className="border rounded-lg bg-white overflow-hidden mb-4">
                <div className="p-4 bg-gray-50 border-b">
                  <h3 className="text-sm font-medium">🐛 Simple Debug Table (Domains: {domains.length})</h3>
                </div>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">PDB ID</th>
                        <th className="px-4 py-2 text-left">Chain</th>
                        <th className="px-4 py-2 text-left">Domain</th>
                        <th className="px-4 py-2 text-left">Range</th>
                        <th className="px-4 py-2 text-left">Confidence</th>
                        <th className="px-4 py-2 text-left">T-Group</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {domains.slice(0, 10).map((domain, index) => (
                        <tr key={domain.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{domain.pdb_id}</td>
                          <td className="px-4 py-2">{domain.chain_id}</td>
                          <td className="px-4 py-2">{domain.domain_number}</td>
                          <td className="px-4 py-2 font-mono">{domain.range}</td>
                          <td className="px-4 py-2">
                            {domain.confidence ? domain.confidence.toFixed(3) : 'N/A'}
                          </td>
                          <td className="px-4 py-2">{domain.t_group || 'None'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

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
