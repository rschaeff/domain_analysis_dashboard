'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProteinOverview, PaginationParams } from '@/lib/types'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Eye, Download, Search, Filter, BarChart3, Users } from 'lucide-react'

// Filters for proteins
interface ProteinFilters {
  pdb_id?: string
  chain_id?: string
  unp_acc?: string
  min_length?: number
  max_length?: number
  is_classified?: boolean
  batch_id?: number
}

// Enhanced API Response Type
interface ProteinsResponse {
  data: ProteinOverview[]
  pagination: PaginationParams
  statistics: {
    totalProteins: number
    classifiedProteins: number
    unclassifiedProteins: number
    avgDomainsPerProtein: number
    avgSequenceLength: number
  }
}

export default function ProteinsPage() {
  const router = useRouter()
  const [proteins, setProteins] = useState<ProteinOverview[]>([])
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ProteinFilters>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [pagination, setPagination] = useState<PaginationParams>({
    page: 1,
    size: 50,
    total: 0
  })
  const [statistics, setStatistics] = useState({
    totalProteins: 0,
    classifiedProteins: 0,
    unclassifiedProteins: 0,
    avgDomainsPerProtein: 0,
    avgSequenceLength: 0
  })
  const [initialLoad, setInitialLoad] = useState(true)
  const [showUnclassified, setShowUnclassified] = useState(true)

  // Add this component to app/protein/page.tsx
    const UnclassifiedReason = ({ reason }: { reason: string }) => {
      let label = 'Unknown'
      let color = 'bg-gray-100 text-gray-800'
      let description = 'No classification information available'

      switch (reason) {
        case 'too_short':
          label = 'Too Short'
          color = 'bg-amber-100 text-amber-800'
          description = 'Peptide-length sequence (< 30 residues)'
          break
        case 'unstructured':
          label = 'Unstructured'
          color = 'bg-purple-100 text-purple-800'
          description = 'Unstructured or disordered region'
          break
        case 'poly_sequence':
          label = 'Poly-Sequence'
          color = 'bg-blue-100 text-blue-800'
          description = 'Repetitive poly-X or poly-A sequence'
          break
        case 'technical_issue':
          label = 'Technical Issue'
          color = 'bg-red-100 text-red-800'
          description = 'Technical issue prevented classification'
          break
      }

      return (
        <Tooltip content={description}>
          <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
            {label}
          </span>
        </Tooltip>
      )
    }

  // Fetch proteins data
  const fetchProteins = async (page = 1, newFilters?: ProteinFilters, search?: string) => {
    if (initialLoad) setInitialLoad(false)
    setLoading(true)
    setStatsLoading(true)
    setError(null)

    try {
      const filtersToUse = newFilters !== undefined ? newFilters : filters
      const searchToUse = search !== undefined ? search : searchTerm

      // Use search endpoint if there's a search term
      if (searchToUse.trim()) {
        const response = await fetch('/api/proteins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            search_term: searchToUse,
            search_fields: ['pdb_id', 'chain_id', 'unp_acc'],
            page,
            size: 50,
            filters: filtersToUse
          })
        })

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`)
        }

        const data = await response.json()
        setProteins(data.data || [])
        setPagination({ page, size: 50, total: data.data?.length || 0 })
        
        // Calculate basic statistics for search results
        const searchProteins = data.data || []
        setStatistics({
          totalProteins: searchProteins.length,
          classifiedProteins: searchProteins.filter((p: ProteinOverview) => p.is_classified).length,
          unclassifiedProteins: searchProteins.filter((p: ProteinOverview) => !p.is_classified).length,
          avgDomainsPerProtein: searchProteins.length > 0 ? 
            searchProteins.reduce((sum: number, p: ProteinOverview) => sum + p.domain_count, 0) / searchProteins.length : 0,
          avgSequenceLength: searchProteins.length > 0 ? 
            searchProteins.reduce((sum: number, p: ProteinOverview) => sum + p.sequence_length, 0) / searchProteins.length : 0
        })
      } else {
        // Use regular GET endpoint with filters
        const params = new URLSearchParams({
          page: page.toString(),
          size: '50'
        })

        // Add filters to URL params
        Object.entries(filtersToUse).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.set(key, value.toString())
          }
        })

        params.set('include_unclassified', showUnclassified.toString())

        const response = await fetch(`/api/proteins?${params}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch proteins: ${response.status}`)
        }

        const data = await response.json()
        setProteins(data.data || [])
        setPagination(data.pagination || { page, size: 50, total: 0 })

        if (data.statistics) {
          setStatistics(data.statistics)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setStatsLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchProteins(1)
  }, [])

  // Handle filter changes
  useEffect(() => {
    if (!initialLoad) {
      fetchProteins(1)
    }
  }, [filters, initialLoad])

  // Handle search
  const handleSearch = () => {
    fetchProteins(1, filters, searchTerm)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('')
    fetchProteins(1, filters, '')
  }

  // Handle filter changes
  const handleFilterChange = (key: keyof ProteinFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleResetFilters = () => {
    setFilters({})
    setSearchTerm('')
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
    fetchProteins(page)
  }

  // Handle protein navigation
  const handleProteinClick = (protein: ProteinOverview) => {
    const sourceId = protein.source_id || `${protein.pdb_id}_${protein.chain_id}`
    router.push(`/protein/${sourceId}`)
  }

  // Export functionality
  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ size: '10000' })
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, value.toString())
        }
      })

      const response = await fetch(`/api/proteins?${params}`)
      const data = await response.json()

      const csvData = data.data.map((protein: ProteinOverview) => ({
        pdb_id: protein.pdb_id,
        chain_id: protein.chain_id,
        source_id: protein.source_id,
        unp_acc: protein.unp_acc,
        sequence_length: protein.sequence_length,
        domain_count: protein.domain_count,
        classified_domains: protein.fully_classified_domains,
        coverage: protein.coverage,
        batch_id: protein.batch_id
      }))

      downloadAsCSV(csvData, `proteins_export_${new Date().toISOString().split('T')[0]}.csv`)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Table columns configuration
  const columns = [
    {
      key: 'source_id',
      label: 'Protein ID',
      sortable: true,
      render: (value: string, protein: ProteinOverview) => (
        <button
          onClick={() => handleProteinClick(protein)}
          className="font-mono text-blue-600 hover:text-blue-800 hover:underline"
        >
          {value || `${protein.pdb_id}_${protein.chain_id}`}
        </button>
      )
    },
    {
      key: 'unp_acc',
      label: 'UniProt',
      render: (value: string | null) => (
        <span className={`text-sm ${value ? 'font-mono' : 'text-gray-400'}`}>
          {value || 'N/A'}
        </span>
      )
    },
    {
      key: 'sequence_length',
      label: 'Length',
      sortable: true,
      render: (value: number) => (
        <span className="font-mono">{value.toLocaleString()}</span>
      )
    },
    {
      key: 'domain_count',
      label: 'Domains',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">{value}</span>
      )
    },
    {
      key: 'fully_classified_domains',
      label: 'Classified',
      sortable: true,
      render: (value: number, protein: ProteinOverview) => (
        <div className="text-center">
          <span className="font-medium">{value}</span>
          <div className="text-xs text-gray-500">
            {protein.domain_count > 0 ? Math.round((value / protein.domain_count) * 100) : 0}%
          </div>
        </div>
      )
    },
    {
      key: 'coverage',
      label: 'Coverage',
      sortable: true,
      render: (value: number) => {
        const percentage = Math.round(value * 100)
        const color = percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
        return <span className={`font-medium ${color}`}>{percentage}%</span>
      }
    },
    {
      key: 'is_classified',
      label: 'Status',
      render: (value: boolean) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
        }`}>
          {value ? 'Classified' : 'Unclassified'}
        </span>
      )
    },
    {
      key: 'batch_id',
      label: 'Batch',
      render: (value: number | null) => (
        <span className="text-sm">{value || 'N/A'}</span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, protein: ProteinOverview) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleProteinClick(protein)}
            title="View protein details"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: any, protein: ProteinOverview) => (
      protein.is_classified ?
      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
        Classified
      </span> :
      <UnclassifiedReason reason={protein.unclassified_reason || 'unknown'} />
      )
    }
  ]

  // Statistics cards
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
          <h1 className="text-3xl font-bold text-gray-900">Protein Browser</h1>
          <p className="text-gray-600 mt-1">
            Browse and analyze protein chains with domain classifications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="Total Proteins"
          value={statistics.totalProteins}
          color="text-blue-600"
          loading={statsLoading}
        />
        <StatCard
          title="Classified"
          value={`${statistics.classifiedProteins} (${statistics.totalProteins > 0 ? Math.round((statistics.classifiedProteins / statistics.totalProteins) * 100) : 0}%)`}
          color="text-green-600"
          loading={statsLoading}
        />
        <StatCard
          title="Unclassified"
          value={statistics.unclassifiedProteins}
          color="text-gray-600"
          loading={statsLoading}
        />
        <StatCard
          title="Avg Domains/Protein"
          value={statistics.avgDomainsPerProtein ? statistics.avgDomainsPerProtein.toFixed(1) : 'N/A'}
          color="text-purple-600"
          loading={statsLoading}
        />
        <StatCard
          title="Avg Length"
          value={statistics.avgSequenceLength ? Math.round(statistics.avgSequenceLength) : 'N/A'}
          color="text-orange-600"
          loading={statsLoading}
        />
      </div>

      {/* Search and Filters */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by PDB ID, chain ID, or UniProt accession..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <Switch
                id="show-unclassified"
                checked={showUnclassified}
                onCheckedChange={setShowUnclassified}
              />
              <Label htmlFor="show-unclassified">Show unclassified proteins</Label>
            </div>
            <Button onClick={handleSearch}>
              Search
            </Button>
            {searchTerm && (
              <Button variant="outline" onClick={handleClearSearch}>
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PDB ID
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., 1abc"
                    value={filters.pdb_id || ''}
                    onChange={(e) => handleFilterChange('pdb_id', e.target.value || undefined)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chain ID
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., A"
                    value={filters.chain_id || ''}
                    onChange={(e) => handleFilterChange('chain_id', e.target.value || undefined)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Length
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.min_length || ''}
                    onChange={(e) => handleFilterChange('min_length', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Length
                  </label>
                  <Input
                    type="number"
                    placeholder="10000"
                    value={filters.max_length || ''}
                    onChange={(e) => handleFilterChange('max_length', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classification Status
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={filters.is_classified === undefined ? '' : filters.is_classified.toString()}
                    onChange={(e) => handleFilterChange('is_classified', 
                      e.target.value === '' ? undefined : e.target.value === 'true')}
                  >
                    <option value="">All</option>
                    <option value="true">Classified</option>
                    <option value="false">Unclassified</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={handleResetFilters}>
                  Reset Filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Main Content */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading proteins...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 mb-4">Error: {error}</div>
            <Button onClick={() => fetchProteins(pagination.page)}>Retry</Button>
          </div>
        ) : proteins.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <div className="text-gray-500 mb-4">No proteins found</div>
            <p className="text-sm text-gray-400">
              Try adjusting your search terms or filters.
            </p>
          </div>
        ) : (
          <DataTable
            data={proteins}
            columns={columns}
            pagination={pagination}
            onPageChange={handlePageChange}
            onRowClick={handleProteinClick}
            loading={loading}
          />
        )}
      </Card>
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
