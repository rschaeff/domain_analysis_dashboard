// Enhanced Dashboard with Fixed Statistics
// app/dashboard/page.tsx

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
    setLoading(true)
    setStatsLoading(true)
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

      // Check if response includes statistics (new format) or use fallback
      if (data.statistics) {
        setDomains(data.data)
        setPagination(data.pagination)
        setStatistics(data.statistics)
      } else {
        // Fallback for API that doesn't return statistics yet
        setDomains(data.data)
        setPagination(data.pagination)

        // Calculate basic statistics from current data as fallback
        const domains = data.data
        setStatistics({
          totalDomains: data.pagination.total || 0,
          classifiedDomains: domains.filter((d: DomainSummary) => d.t_group).length,
          highConfidenceDomains: domains.filter((d: DomainSummary) => d.confidence && d.confidence >= 0.8).length,
          avgConfidence: domains.length > 0 ? domains.reduce((sum: number, d: DomainSummary) => sum + (d.confidence || 0), 0) / domains.length : 0,
          domainsWithEvidence: domains.filter((d: DomainSummary) => d.evidence_count > 0).length
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
      setStatsLoading(false)
    }
  }

  // Initial fetch on mount
  useEffect(() => {
    fetchDomains(1)
  }, [])

  // Filter changes (skip initial if already loading)
  useEffect(() => {
    if (loading) return // Skip if already loading from initial mount
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

  // Table columns configuration (unchanged)
  const columns = [
    // ... (existing column configuration)
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

      {/* Enhanced Summary Cards with Loading States */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="Total Domains"
          value={statistics.totalDomains}
          color="text-blue-600"
          loading={statsLoading}
        />
        <StatCard
          title="Classified Domains"
          value={statistics.classifiedDomains}
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
          title="With Evidence"
          value={statistics.domainsWithEvidence}
          color="text-orange-600"
          loading={statsLoading}
        />
        <StatCard
          title="Average Confidence"
          value={statistics.avgConfidence ? statistics.avgConfidence.toFixed(3) : 'N/A'}
          color="text-teal-600"
          loading={statsLoading}
        />
      </div>

      {/* Enhanced Filters with Active Filter Count */}
      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      {/* Rest of the component remains the same */}
      {/* ... */}
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
