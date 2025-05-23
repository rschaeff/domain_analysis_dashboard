'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DomainFilters, PaginationParams } from '@/lib/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { ProteinTable } from '@/components/tables/ProteinTable'
import { ArchitectureGroupedTable } from '@/components/tables/ArchitectureGroupedTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AuditView } from '@/components/analysis/AuditView'
import {
  Eye, Download, BarChart3, Users, Table, Grid, Layers, List,
  AlertTriangle, CheckCircle, XCircle, AlertCircle, RefreshCw,
  TrendingUp, Database, Zap, Activity, Clock, Target, Star,
  FileText, Loader2
} from 'lucide-react'

// Enhanced statistics interface with all expected fields
interface DashboardStatistics {
  total_proteins: number
  total_domains: number
  classified_chains: number
  unclassified_chains: number
  classified_domains: number
  unclassified_domains: number
  avg_domain_coverage: number
  avg_confidence: number
  domains_with_evidence: number
  total_evidence_items: number
  error?: string
}

interface ProteinSummary {
  id: string
  pdb_id: string
  chain_id: string
  source_id: string
  sequence_length: number
  batch_id: number
  reference_version: string
  is_classified: boolean

  // Domain summary
  domain_count: number
  domains_classified: number
  avg_confidence: number
  best_confidence: number
  coverage: number

  // Evidence summary
  total_evidence_count: number
  evidence_types: string
  has_chain_blast: boolean
  has_domain_blast: boolean
  has_hhsearch: boolean

  // Processing info
  processing_date: string
  days_old: number
  is_recent: boolean
  confidence_level: 'high' | 'medium' | 'low'
  residues_assigned: number
  classification_status: string
  evidence_quality: string
}

interface AuditData {
  partitionAudit: PartitionAuditData[]
  evidenceConflicts: Array<{
    conflict_type: string
    tuning_suggestion: string
    case_count: number
    avg_final_confidence: number
    sample_cases: string[]
  }>
  chainBlastIssues: Array<{
    chain_blast_issue: string
    protein_count: number
    avg_chain_blast_hits: number
    sample_proteins: string[]
  }>
}

// Safe number formatting helper
const safeToLocaleString = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return '0'
  }
  return Number(value).toLocaleString()
}

// Safe percentage calculation helper
const safePercentage = (numerator: number | undefined | null, denominator: number | undefined | null): number => {
  if (!numerator || !denominator || denominator === 0) {
    return 0
  }
  return Math.round((Number(numerator) / Number(denominator)) * 100)
}

// URL State Management Hook
function useUrlState() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Parse current state from URL
  const currentState = useMemo(() => {
    const state = {
      page: parseInt(searchParams.get('page') || '1'),
      size: parseInt(searchParams.get('size') || '50'),
      sort: searchParams.get('sort') || 'recent',
      sortDirection: (searchParams.get('sort_dir') || 'desc') as 'asc' | 'desc',
      viewMode: (searchParams.get('view') || 'proteins') as 'proteins' | 'architecture' | 'audit',
      filters: {} as DomainFilters
    }

    // Parse filters from URL
    const filterKeys = [
      'pdb_id', 'chain_id', 'domain_number', 'batch_id',
      'min_confidence', 'max_confidence',
      'sequence_length_min', 'sequence_length_max',
      'min_evidence_count', 'evidence_types'
    ]

    filterKeys.forEach(key => {
      const value = searchParams.get(key)
      if (value) {
        if (key.includes('confidence') || key.includes('length') || key.includes('count')) {
          state.filters[key as keyof DomainFilters] = parseFloat(value)
        } else if (key === 'domain_number' || key === 'batch_id') {
          state.filters[key as keyof DomainFilters] = parseInt(value)
        } else {
          state.filters[key as keyof DomainFilters] = value
        }
      }
    })

    // Parse array filters
    const arrayFilters = ['t_groups', 'h_groups', 'x_groups', 'a_groups']
    arrayFilters.forEach(key => {
      const value = searchParams.get(key)
      if (value) {
        const filterKey = key.replace('s', '') as keyof DomainFilters
        state.filters[filterKey] = value.split(',')
      }
    })

    return state
  }, [searchParams])

  // Update URL with new state
  const updateUrl = useCallback((updates: Partial<typeof currentState>) => {
    const params = new URLSearchParams(searchParams.toString())

    // Update basic state
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }

    if (updates.size !== undefined && updates.size !== 50) {
      params.set('size', updates.size.toString())
    }

    if (updates.sort !== undefined) {
      if (updates.sort === 'recent') {
        params.delete('sort')
      } else {
        params.set('sort', updates.sort)
      }
    }

    if (updates.sortDirection !== undefined) {
      if (updates.sortDirection === 'desc') {
        params.delete('sort_dir')
      } else {
        params.set('sort_dir', updates.sortDirection)
      }
    }

    if (updates.viewMode !== undefined) {
      if (updates.viewMode === 'proteins') {
        params.delete('view')
      } else {
        params.set('view', updates.viewMode)
      }
    }

    // Update filters
    if (updates.filters !== undefined) {
      // Clear existing filter params
      const filterKeys = [
        'pdb_id', 'chain_id', 'domain_number', 'batch_id',
        'min_confidence', 'max_confidence',
        'sequence_length_min', 'sequence_length_max',
        'min_evidence_count', 'evidence_types',
        't_groups', 'h_groups', 'x_groups', 'a_groups'
      ]

      filterKeys.forEach(key => params.delete(key))

      // Set new filter params
      Object.entries(updates.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            const paramKey = key === 't_group' ? 't_groups' :
                            key === 'h_group' ? 'h_groups' :
                            key === 'x_group' ? 'x_groups' :
                            key === 'a_group' ? 'a_groups' : key
            params.set(paramKey, value.join(','))
          } else if (!Array.isArray(value)) {
            params.set(key, value.toString())
          }
        }
      })
    }

    // Update URL
    const newUrl = params.toString() ? `?${params.toString()}` : ''
    router.push(`/dashboard${newUrl}`, { scroll: false })
  }, [router, searchParams])

  return {
    state: currentState,
    updateUrl
  }
}

export default function EnhancedDashboard() {
  const { state: urlState, updateUrl } = useUrlState()

  // Core data state
  const [proteins, setProteins] = useState<ProteinSummary[]>([])
  const [architectureGroups, setArchitectureGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statisticsLoading, setStatisticsLoading] = useState(true)

  // Pagination state (updated from API responses)
  const [pagination, setPagination] = useState<PaginationParams>({
    page: urlState.page,
    size: urlState.size,
    total: 0
  })

  // Initialize with safe defaults
  const [statistics, setStatistics] = useState<DashboardStatistics>({
    total_proteins: 0,
    total_domains: 0,
    classified_chains: 0,
    unclassified_chains: 0,
    classified_domains: 0,
    unclassified_domains: 0,
    avg_domain_coverage: 0,
    avg_confidence: 0,
    domains_with_evidence: 0,
    total_evidence_items: 0
  })

  // Audit state
    const [auditData, setAuditData] = useState<AuditData>({
      partitionAudit: [],
      evidenceConflicts: [],
      chainBlastIssues: []
    })

  const [auditLoading, setAuditLoading] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null)

  // URL state derived values
  const filters = urlState.filters
  const sortBy = urlState.sort
  const sortDirection = urlState.sortDirection
  const viewMode = urlState.viewMode

  // Fetch dashboard stats with proper error handling
  const fetchDashboardStats = useCallback(async () => {
    setStatisticsLoading(true)
    try {
      const response = await fetch('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()

        // Ensure all required fields exist with safe defaults
        const safeStats: DashboardStatistics = {
          total_proteins: Number(data.total_proteins || 0),
          total_domains: Number(data.total_domains || 0),
          classified_chains: Number(data.classified_chains || 0),
          unclassified_chains: Number(data.unclassified_chains || 0),
          classified_domains: Number(data.classified_domains || 0),
          unclassified_domains: Number(data.unclassified_domains || 0),
          avg_domain_coverage: Number(data.avg_domain_coverage || 0),
          avg_confidence: Number(data.avg_confidence || 0),
          domains_with_evidence: Number(data.domains_with_evidence || 0),
          total_evidence_items: Number(data.total_evidence_items || 0),
          error: data.error
        }

        setStatistics(safeStats)

        if (data.error) {
          console.warn('Dashboard stats API returned with error:', data.error)
        }
      } else {
        console.error('Failed to fetch dashboard stats:', response.status)
        setError('Failed to load dashboard statistics')
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard statistics')
    } finally {
      setStatisticsLoading(false)
    }
  }, [])

  // Fetch protein-centric data
  const fetchProteins = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: urlState.page.toString(),
        size: urlState.size.toString(),
        sort: urlState.sort,
        sort_dir: urlState.sortDirection
      })

      // Add filters
      Object.entries(urlState.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            let paramKey = key
            if (key === 't_group') paramKey = 't_groups'
            else if (key === 'h_group') paramKey = 'h_groups'
            else if (key === 'x_group') paramKey = 'x_groups'
            else if (key === 'a_group') paramKey = 'a_groups'
            params.set(paramKey, value.join(','))
          } else if (!Array.isArray(value)) {
            params.set(key, value.toString())
          }
        }
      })

      console.log('Fetching with URL:', `/api/proteins/summary?${params}`)

      const response = await fetch(`/api/proteins/summary?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch proteins: ${response.status}`)
      }

      const data = await response.json()
      setProteins(data.data || [])

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0
      }))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [urlState])

  // Fetch architecture data
  const fetchArchitectureData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      Object.entries(urlState.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            let paramKey = key
            if (key === 't_group') paramKey = 't_groups'
            else if (key === 'h_group') paramKey = 'h_groups'
            else if (key === 'x_group') paramKey = 'x_groups'
            else if (key === 'a_group') paramKey = 'a_groups'
            params.set(paramKey, value.join(','))
          } else if (!Array.isArray(value)) {
            params.set(key, value.toString())
          }
        }
      })

      const response = await fetch(`/api/proteins/by-architecture?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch architecture data: ${response.status}`)
      }

      const data = await response.json()
      setArchitectureGroups(data.architectures || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [urlState.filters])

  // Run comprehensive audit
const runAudit = useCallback(async (batchId?: number) => {
  setAuditLoading(true)
  setError(null)

  try {
    const batchParam = batchId ? `?batch_id=${batchId}` : ''

    const [partitionResponse, evidenceResponse, chainBlastResponse] = await Promise.all([
      fetch(`/api/audit/missing-partitions${batchParam}`),
      fetch(`/api/audit/evidence-analysis${batchParam}`),
      fetch('/api/audit/chain-blast-diagnostic')
    ])

    if (!partitionResponse.ok || !evidenceResponse.ok || !chainBlastResponse.ok) {
      throw new Error('One or more audit requests failed')
    }

    const [partitionData, evidenceData, chainBlastData] = await Promise.all([
      partitionResponse.json(),
      evidenceResponse.json(),
      chainBlastResponse.json()
    ])

    // Update auditData structure
    setAuditData({
      partitionAudit: partitionData.partition_audit || [],
      evidenceConflicts: evidenceData.evidence_analysis || [],
      chainBlastIssues: chainBlastData.chain_blast_diagnostic || []
    })
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Audit failed')
  } finally {
    setAuditLoading(false)
  }
}, [])

  // URL state change handlers
  const handleFiltersChange = useCallback((newFilters: DomainFilters) => {
    updateUrl({
      filters: newFilters,
      page: 1 // Reset to first page when filters change
    })
  }, [updateUrl])

  const handleResetFilters = useCallback(() => {
    updateUrl({
      filters: {},
      page: 1
    })
  }, [updateUrl])

  const handlePageChange = useCallback((page: number) => {
    updateUrl({ page })
  }, [updateUrl])

  const handleSortChange = useCallback((newSort: string, newDirection?: 'asc' | 'desc') => {
    const direction = newDirection || (newSort === sortBy && sortDirection === 'desc' ? 'asc' : 'desc')
    updateUrl({
      sort: newSort,
      sortDirection: direction,
      page: 1 // Reset to first page when sorting changes
    })
  }, [updateUrl, sortBy, sortDirection])

  const handleViewModeChange = useCallback((mode: 'proteins' | 'architecture' | 'audit') => {
    updateUrl({
      viewMode: mode,
      page: 1 // Reset page when changing views
    })
  }, [updateUrl])

  const handleProteinClick = useCallback((protein: ProteinSummary) => {
    // Open in new tab to preserve dashboard state
    window.open(`/protein/${protein.source_id}`, '_blank')
  }, [])

  // Trigger fetches when URL state changes
  useEffect(() => {
    if (urlState.viewMode === 'proteins') {
      fetchProteins()
    } else if (urlState.viewMode === 'architecture') {
      fetchArchitectureData()
    } else if (urlState.viewMode === 'audit') {
      runAudit(selectedBatch || undefined)
    }
  }, [urlState.viewMode, urlState.page, urlState.size, urlState.sort, urlState.sortDirection, urlState.filters, fetchProteins, fetchArchitectureData, runAudit, selectedBatch])

  // Initial load
  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  // Calculate audit summary
const auditSummary = useMemo(() => {
  const partitionIssues = auditData.partitionAudit?.reduce((sum, batch) =>
    sum + batch.proteins_missing_partitions + Math.max(0, batch.actual_proteins_in_batch - batch.partitions_attempted), 0
  ) || 0

  const evidenceIssues = auditData.evidenceConflicts?.reduce((sum, conflict) =>
    sum + conflict.case_count, 0
  ) || 0

  const chainBlastIssues = auditData.chainBlastIssues?.reduce((sum, issue) =>
    sum + issue.protein_count, 0
  ) || 0

  const criticalBatches = auditData.partitionAudit?.filter(batch =>
    batch.proteins_missing_partitions > 50 || batch.overall_success_rate < 50
  ).length || 0

  return {
    totalIssues: partitionIssues + evidenceIssues + chainBlastIssues,
    criticalIssues: criticalBatches,
    chainBlastProblems: chainBlastIssues,
    partitionIssues
  }
}, [auditData])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Domain Analysis Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Analyze protein domain architectures, classifications, and pipeline health
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={viewMode === 'proteins' ? 'default' : 'outline'}
                onClick={() => handleViewModeChange('proteins')}
                className="flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                Proteins
                {viewMode === 'proteins' && (
                  <Badge variant="secondary" className="ml-1">
                    {pagination.total.toLocaleString()}
                  </Badge>
                )}
              </Button>
              <Button
                variant={viewMode === 'architecture' ? 'default' : 'outline'}
                onClick={() => handleViewModeChange('architecture')}
                className="flex items-center gap-2"
              >
                <Layers className="w-4 h-4" />
                Architecture
              </Button>
              <Button
                variant={viewMode === 'audit' ? 'default' : 'outline'}
                onClick={() => handleViewModeChange('audit')}
                className="flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Audit
                {auditSummary.totalIssues > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {auditSummary.totalIssues}
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={fetchDashboardStats}
                disabled={statisticsLoading}
              >
                <RefreshCw className={`w-4 h-4 ${statisticsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Card className="p-4 border-red-200 bg-red-50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-800">Error</div>
                  <div className="text-sm text-red-700">{error}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setError(null)}
                  className="ml-auto"
                >
                  Dismiss
                </Button>
              </div>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      safeToLocaleString(statistics.total_proteins)
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Total Proteins</div>
                  {statistics.error && (
                    <div className="text-xs text-red-500 mt-1">Data may be incomplete</div>
                  )}
                </div>
                <Database className="w-8 h-8 text-blue-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      safeToLocaleString(statistics.total_domains)
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Total Domains</div>
                </div>
                <Layers className="w-8 h-8 text-green-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
                    ) : (
                      `${safeToLocaleString(statistics.classified_chains)} (${safePercentage(statistics.classified_chains, statistics.total_proteins)}%)`
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Classified Proteins</div>
                </div>
                <CheckCircle className="w-8 h-8 text-purple-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                    ) : (
                      `${(statistics.avg_domain_coverage * 100).toFixed(1)}%`
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Avg Coverage</div>
                </div>
                <Activity className="w-8 h-8 text-orange-600 opacity-20" />
              </div>
            </Card>
          </div>

          {/* Additional Statistics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-indigo-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                    ) : (
                      safeToLocaleString(statistics.classified_domains)
                    )}
                  </div>
                  <div className="text-xs text-gray-600">Classified Domains</div>
                </div>
                <Target className="w-6 h-6 text-indigo-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-teal-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                    ) : (
                      safeToLocaleString(statistics.domains_with_evidence)
                    )}
                  </div>
                  <div className="text-xs text-gray-600">Domains with Evidence</div>
                </div>
                <FileText className="w-6 h-6 text-teal-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-cyan-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-12 rounded"></div>
                    ) : (
                      `${(statistics.avg_confidence * 100).toFixed(1)}%`
                    )}
                  </div>
                  <div className="text-xs text-gray-600">Avg Confidence</div>
                </div>
                <Star className="w-6 h-6 text-cyan-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-emerald-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                    ) : (
                      safeToLocaleString(statistics.total_evidence_items)
                    )}
                  </div>
                  <div className="text-xs text-gray-600">Evidence Items</div>
                </div>
                <BarChart3 className="w-6 h-6 text-emerald-600 opacity-20" />
              </div>
            </Card>
          </div>

          {/* Audit Alert (only show if there are issues) */}
            {viewMode !== 'audit' && auditSummary.partitionIssues > 0 && (
              <Card className="p-4 border-orange-200 bg-orange-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <div>
                      <div className="font-medium text-orange-800">
                        {auditSummary.partitionIssues} partition issues detected
                      </div>
                      <div className="text-sm text-orange-700">
                        {auditSummary.criticalIssues} critical batches • {auditSummary.chainBlastProblems} chain BLAST problems
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewModeChange('audit')}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    View Audit
                  </Button>
                </div>
              </Card>
            )}

          {/* Filters and Sorting (hide for audit view) */}
          {viewMode !== 'audit' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg">
                <FilterPanel
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onReset={handleResetFilters}
                  loading={loading}
                  showAppliedCount={true}
                />
              </div>

              {/* Sorting Controls for Protein View */}
              {viewMode === 'proteins' && (
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-700">Sort by:</span>
                      <div className="flex gap-2">
                        {[
                          { key: 'recent', label: 'Most Recent', icon: Clock },
                          { key: 'batch', label: 'Latest Batch', icon: Grid },
                          { key: 'confidence', label: 'Confidence', icon: Star },
                          { key: 'coverage', label: 'Coverage', icon: Activity },
                          { key: 'domains', label: 'Domains', icon: Layers }
                        ].map(({ key, label, icon: IconComponent }) => (
                          <Button
                            key={key}
                            size="sm"
                            variant={sortBy === key ? 'default' : 'outline'}
                            onClick={() => handleSortChange(key)}
                            className="flex items-center gap-1"
                            disabled={loading}
                          >
                            <IconComponent className="w-4 h-4" />
                            {label}
                            {sortBy === key && (
                              <span className="ml-1">
                                {sortDirection === 'desc' ? '↓' : '↑'}
                              </span>
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      Showing page {pagination.page} of {Math.ceil(pagination.total / pagination.size)}
                      {loading && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading...
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Main Content */}
          {loading && viewMode === 'proteins' ? (
            <Card className="p-8 text-center">
              <LoadingSpinner />
              <p className="mt-4 text-gray-600">Loading data...</p>
            </Card>
          ) : viewMode === 'proteins' ? (
            <ProteinTable
              proteins={proteins}
              pagination={pagination}
              onPageChange={handlePageChange}
              onProteinClick={handleProteinClick}
              loading={loading}
            />
          ) : viewMode === 'architecture' ? (
            <ArchitectureGroupedTable
              architectureGroups={architectureGroups}
              onProteinClick={handleProteinClick}
              onDomainClick={() => {}} // TODO: implement
              renderClassificationBadge={() => <></> } // TODO: implement
              loading={loading}
            />
          ) : (
            <AuditView
              auditData={auditData}
              loading={auditLoading}
              selectedBatch={selectedBatch}
              onBatchChange={setSelectedBatch}
              onRefresh={() => runAudit(selectedBatch || undefined)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Audit View Component
interface AuditViewProps {
  auditData: AuditData
  loading: boolean
  selectedBatch: number | null
  onBatchChange: (batchId: number | null) => void
  onRefresh: () => void
}

function AuditView({ auditData, loading, selectedBatch, onBatchChange, onRefresh }: AuditViewProps) {
  if (loading) {
    return (
      <Card className="p-8 text-center">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">Running pipeline audit...</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Audit Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Pipeline Audit</h3>
            <select
              value={selectedBatch || ''}
              onChange={(e) => onBatchChange(e.target.value ? parseInt(e.target.value) : null)}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="">All Batches</option>
              {/* TODO: Add batch options from API */}
            </select>
          </div>
          <Button onClick={onRefresh} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh Audit
          </Button>
        </div>
      </Card>

      {/* Missing Partitions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          Missing Partitions
        </h3>

        {auditData.missingPartitions.length === 0 ? (
          <div className="text-green-600 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            No missing partitions detected
          </div>
        ) : (
          <div className="space-y-4">
            {auditData.missingPartitions.map((batch) => (
              <div key={batch.batch_id} className="border rounded p-4 bg-red-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{batch.batch_name}</h4>
                    <div className="text-sm text-gray-600">Batch ID: {batch.batch_id}</div>
                  </div>
                  <Badge variant="destructive">{batch.missing_proteins} missing</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div className="text-center">
                    <div className="font-semibold text-red-600">{batch.proteins_without_domains}</div>
                    <div className="text-xs text-gray-600">No Domains</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-orange-600">{batch.domains_without_evidence}</div>
                    <div className="text-xs text-gray-600">No Evidence</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-yellow-600">{batch.classification_failures}</div>
                    <div className="text-xs text-gray-600">Classification Failed</div>
                  </div>
                </div>

                {batch.sample_issues.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700">Sample Issues:</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {batch.sample_issues.slice(0, 5).join(', ')}
                      {batch.sample_issues.length > 5 && ` and ${batch.sample_issues.length - 5} more...`}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Evidence Conflicts */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Evidence Conflicts & Tuning Suggestions
        </h3>

        {auditData.evidenceConflicts.length === 0 ? (
          <div className="text-green-600 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            No evidence conflicts detected
          </div>
        ) : (
          <div className="space-y-4">
            {auditData.evidenceConflicts.map((conflict, index) => (
              <div key={index} className="border rounded p-4 bg-orange-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{conflict.conflict_type.replace(/_/g, ' ')}</h4>
                    <div className="text-sm text-orange-700">{conflict.tuning_suggestion.replace(/_/g, ' ')}</div>
                  </div>
                  <Badge variant="outline">{conflict.case_count} cases</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div className="text-center">
                    <div className="font-semibold">{conflict.avg_final_confidence?.toFixed(3)}</div>
                    <div className="text-xs text-gray-600">Avg Final Confidence</div>
                  </div>
                </div>

                {conflict.sample_cases.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700">Sample Cases:</div>
                    <div className="text-xs text-gray-600 mt-1 font-mono">
                      {conflict.sample_cases.slice(0, 3).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Chain BLAST Issues */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Chain BLAST Issues
        </h3>

        {auditData.chainBlastIssues.length === 0 ? (
          <div className="text-green-600 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            No chain BLAST issues detected
          </div>
        ) : (
          <div className="space-y-4">
            {auditData.chainBlastIssues.map((issue, index) => (
              <div key={index} className="border rounded p-4 bg-yellow-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{issue.chain_blast_issue.replace(/_/g, ' ')}</h4>
                  </div>
                  <Badge variant="outline">{issue.protein_count} proteins</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div className="text-center">
                    <div className="font-semibold">{issue.avg_chain_blast_hits?.toFixed(1)}</div>
                    <div className="text-xs text-gray-600">Avg Chain BLAST Hits</div>
                  </div>
                </div>

                {issue.sample_proteins.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700">Sample Proteins:</div>
                    <div className="text-xs text-gray-600 mt-1 font-mono">
                      {issue.sample_proteins.slice(0, 3).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
