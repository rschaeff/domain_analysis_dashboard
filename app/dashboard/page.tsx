'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DomainFilters, PaginationParams } from '@/lib/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { ProteinTable } from '@/components/tables/ProteinTable'
import { ArchitectureGroupedTable } from '@/components/tables/ArchitectureGroupedTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { AuditView } from '@/components/analysis/AuditView'
import MainCurationInterface from '@/components/curation/MainCurationInterface'
import { CurationStatsPanel } from '@/components/curation/CurationStatsPanel'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Eye, Download, BarChart3, Users, Table, Grid, Layers, List,
  AlertTriangle, CheckCircle, XCircle, AlertCircle, RefreshCw,
  TrendingUp, Database, Zap, Activity, Clock, Target, Star,
  FileText, Loader2, UserCheck, Edit3, Play, Settings,
  ArrowRight, TrendingDown, Award, Beaker
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

interface CurationStatistics {
  total_sessions: number
  committed_sessions: number
  active_sessions: number
  total_curators: number
  total_decisions: number
  proteins_with_domains: number
  fragments_identified: number
  repeat_proteins: number
  flagged_for_review: number
  avg_confidence_level: number
  avg_review_time_seconds: number
  proteins_curated: number
  total_curable_proteins: number
  completion_percentage: number
  remaining_proteins: number
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

// Enhanced view mode type
type ViewMode = 'proteins' | 'architecture' | 'audit' | 'curation'

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
      viewMode: (searchParams.get('view') || 'proteins') as ViewMode,
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

  // Curation-specific state
  const [curationStats, setCurationStats] = useState<CurationStatistics>({
    total_sessions: 0,
    committed_sessions: 0,
    active_sessions: 0,
    total_curators: 0,
    total_decisions: 0,
    proteins_with_domains: 0,
    fragments_identified: 0,
    repeat_proteins: 0,
    flagged_for_review: 0,
    avg_confidence_level: 0,
    avg_review_time_seconds: 0,
    proteins_curated: 0,
    total_curable_proteins: 0,
    completion_percentage: 0,
    remaining_proteins: 0
  })
  const [curationStatsLoading, setCurationStatsLoading] = useState(false)

  // Simplified audit state - just for the alert
  const [auditIssues, setAuditIssues] = useState(0)

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

  // Fetch curation statistics
  const fetchCurationStats = useCallback(async () => {
    setCurationStatsLoading(true)
    try {
      const response = await fetch('/api/curation/stats')
      if (response.ok) {
        const data = await response.json()

        const safeCurationStats: CurationStatistics = {
          total_sessions: Number(data.statistics?.total_sessions || 0),
          committed_sessions: Number(data.statistics?.committed_sessions || 0),
          active_sessions: Number(data.statistics?.active_sessions || 0),
          total_curators: Number(data.statistics?.total_curators || 0),
          total_decisions: Number(data.statistics?.total_decisions || 0),
          proteins_with_domains: Number(data.statistics?.proteins_with_domains || 0),
          fragments_identified: Number(data.statistics?.fragments_identified || 0),
          repeat_proteins: Number(data.statistics?.repeat_proteins || 0),
          flagged_for_review: Number(data.statistics?.flagged_for_review || 0),
          avg_confidence_level: Number(data.statistics?.avg_confidence_level || 0),
          avg_review_time_seconds: Number(data.statistics?.avg_review_time_seconds || 0),
          proteins_curated: Number(data.statistics?.proteins_curated || 0),
          total_curable_proteins: Number(data.statistics?.total_curable_proteins || 0),
          completion_percentage: Number(data.statistics?.completion_percentage || 0),
          remaining_proteins: Number(data.statistics?.remaining_proteins || 0)
        }

        setCurationStats(safeCurationStats)
      }
    } catch (err) {
      console.error('Error fetching curation stats:', err)
    } finally {
      setCurationStatsLoading(false)
    }
  }, [])

  // Quick audit check for alert
  const checkAuditIssues = useCallback(async () => {
    try {
      const response = await fetch('/api/audit/missing-partitions')
      if (response.ok) {
        const data = await response.json()
        const partitionIssues = data.partition_audit?.reduce((sum: number, batch: any) =>
          sum + batch.proteins_missing_partitions + Math.max(0, batch.actual_proteins_in_batch - batch.partitions_attempted), 0
        ) || 0
        setAuditIssues(partitionIssues)
      }
    } catch (err) {
      console.error('Error checking audit issues:', err)
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

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    updateUrl({
      viewMode: mode,
      page: 1 // Reset page when changing views
    })
  }, [updateUrl])

  const handleProteinClick = useCallback((protein: ProteinSummary) => {
    // Open in new tab to preserve dashboard state
    window.open(`/protein/${protein.source_id}`, '_blank')
  }, [])

  // Quick start curation handler
  const handleQuickStartCuration = useCallback(async () => {
    try {
      const response = await fetch('/api/curation/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curator_name: 'Dashboard User', // Could get from user context
          batch_size: 10
        })
      })

      if (response.ok) {
        handleViewModeChange('curation')
      } else {
        const error = await response.json()
        alert(`Failed to start curation session: ${error.error}`)
      }
    } catch (err) {
      console.error('Error starting curation:', err)
      alert('Failed to start curation session')
    }
  }, [handleViewModeChange])

  // Trigger fetches when URL state changes
  useEffect(() => {
    if (urlState.viewMode === 'proteins') {
      fetchProteins()
    } else if (urlState.viewMode === 'architecture') {
      fetchArchitectureData()
    }
  }, [urlState.viewMode, urlState.page, urlState.size, urlState.sort, urlState.sortDirection, urlState.filters, fetchProteins, fetchArchitectureData])

  // Initial load
  useEffect(() => {
    fetchDashboardStats()
    checkAuditIssues()
    fetchCurationStats()
  }, [fetchDashboardStats, checkAuditIssues, fetchCurationStats])

  // Auto-refresh curation stats
  useEffect(() => {
    const interval = setInterval(fetchCurationStats, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [fetchCurationStats])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Enhanced Header with Curation */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Domain Analysis Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Analyze protein domain architectures, classifications, and perform manual curation
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
                variant={viewMode === 'curation' ? 'default' : 'outline'}
                onClick={() => handleViewModeChange('curation')}
                className="flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                Curation
                {curationStats.active_sessions > 0 && (
                  <Badge variant="default" className="ml-1 bg-green-600">
                    {curationStats.active_sessions}
                  </Badge>
                )}
                {curationStats.remaining_proteins > 0 && viewMode !== 'curation' && (
                  <Badge variant="outline" className="ml-1">
                    {curationStats.remaining_proteins.toLocaleString()} pending
                  </Badge>
                )}
              </Button>

              <Button
                variant={viewMode === 'audit' ? 'default' : 'outline'}
                onClick={() => handleViewModeChange('audit')}
                className="flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Audit
                {auditIssues > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {auditIssues}
                  </Badge>
                )}
              </Button>

              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  fetchDashboardStats()
                  checkAuditIssues()
                  fetchCurationStats()
                }}
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

          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Core Statistics Cards */}
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
                  <div className="text-xl font-bold text-purple-600">
                    {statisticsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
                    ) : (
                      `${safePercentage(statistics.classified_chains, statistics.total_proteins)}%`
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Classified</div>
                  <div className="text-xs text-gray-500">
                    {safeToLocaleString(statistics.classified_chains)} of {safeToLocaleString(statistics.total_proteins)}
                  </div>
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

            {/* Curation Statistics Cards */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {curationStatsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    ) : (
                      safeToLocaleString(curationStats.proteins_curated)
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Curated</div>
                  {curationStats.completion_percentage > 0 && (
                    <div className="text-xs text-gray-500">
                      {curationStats.completion_percentage.toFixed(1)}% complete
                    </div>
                  )}
                </div>
                <UserCheck className="w-8 h-8 text-emerald-600 opacity-20" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-cyan-600">
                    {curationStatsLoading ? (
                      <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div>
                    ) : (
                      curationStats.active_sessions
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Active Sessions</div>
                  {curationStats.active_sessions > 0 && (
                    <div className="flex items-center mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                      <span className="text-xs text-green-600">
                        {curationStats.total_curators} curator{curationStats.total_curators > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                <Edit3 className="w-8 h-8 text-cyan-600 opacity-20" />
              </div>
            </Card>
          </div>

          {/* Curation Quick Actions */}
          {viewMode !== 'curation' && (
            <>
              {curationStats.active_sessions === 0 && curationStats.remaining_proteins > 0 && (
                <Card className="p-4 border-green-200 bg-green-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserCheck className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="font-medium text-green-800">
                          Ready for Curation
                        </div>
                        <div className="text-sm text-green-700">
                          {curationStats.remaining_proteins.toLocaleString()} proteins available for manual review
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleViewModeChange('curation')}
                        className="border-green-300 text-green-700 hover:bg-green-100"
                      >
                        View Curation
                      </Button>
                      <Button
                        onClick={handleQuickStartCuration}
                        className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start Session
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {curationStats.active_sessions > 0 && (
                <Card className="p-4 border-blue-200 bg-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Edit3 className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-blue-800">
                          {curationStats.active_sessions} Active Curation Session{curationStats.active_sessions > 1 ? 's' : ''}
                        </div>
                        <div className="text-sm text-blue-700">
                          {curationStats.total_curators} curator{curationStats.total_curators > 1 ? 's' : ''} currently reviewing proteins
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleViewModeChange('curation')}
                      className="border-blue-300 text-blue-700 hover:bg-blue-100 flex items-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Join Curation
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Audit Alert (only show if there are issues and not in audit view) */}
          {viewMode !== 'audit' && auditIssues > 0 && (
            <Card className="p-4 border-orange-200 bg-orange-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="font-medium text-orange-800">
                      {auditIssues} partition issues detected
                    </div>
                    <div className="text-sm text-orange-700">
                      Some proteins may not have been processed correctly
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

          {/* Main Content */}
          {viewMode === 'curation' ? (
            <div className="space-y-4">
              {/* Curation Stats Panel */}
              <CurationStatsPanel />

              {/* Main Curation Interface */}
              <MainCurationInterface />
            </div>
          ) : (
            <>
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

              {/* Content based on view mode */}
              {loading && viewMode === 'proteins' ? (
                <Card className="p-8 text-center">
                  <LoadingSpinner />
                  <p className="mt-4 text-gray-600">Loading protein data...</p>
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
                loading ? (
                  <Card className="p-8 text-center">
                    <LoadingSpinner />
                    <p className="mt-4 text-gray-600">Loading architecture data...</p>
                  </Card>
                ) : (
                  <ArchitectureGroupedTable
                    architectureGroups={architectureGroups}
                    onProteinClick={handleProteinClick}
                    onDomainClick={() => {}} // TODO: implement
                    renderClassificationBadge={() => <></>} // TODO: implement
                    loading={loading}
                  />
                )
              ) : (
                <AuditView />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
