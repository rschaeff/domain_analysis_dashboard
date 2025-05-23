'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Database,
  Clock,
  Zap,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

interface ProteinSummary {
  id: string
  pdb_id: string
  chain_id: string
  source_id: string
  sequence_length: number
  batch_id: number
  reference_version: string
  is_classified: boolean

  // Domain summary - FIXED FIELD NAMES
  domain_count: number
  domains_classified: number  // ← This matches API response
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
  days_old?: number
  is_recent?: boolean
  confidence_level?: 'high' | 'medium' | 'low'
  classification_status?: string

  // Individual domains (loaded on expansion)
  domains?: DomainDetails[]
}

interface DomainDetails {
  id: string
  domain_number: number
  range: string
  confidence: number
  t_group: string | null
  h_group: string | null
  x_group: string | null
  a_group: string | null
  source: string
  evidence_count: number
}

interface PaginationParams {
  page: number
  size: number
  total: number
  totalPages?: number
}

interface ProteinTableProps {
  proteins: ProteinSummary[]
  pagination: PaginationParams
  onPageChange: (page: number) => void
  onProteinClick: (protein: ProteinSummary) => void
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  onSortChange?: (sortKey: string) => void
  loading?: boolean
}

export function ProteinTable({
  proteins,
  pagination,
  onPageChange,
  onProteinClick,
  sortBy = 'recent',
  sortDirection = 'desc',
  onSortChange,
  loading = false
}: ProteinTableProps) {
  const [expandedProteins, setExpandedProteins] = useState<Set<string>>(new Set())
  const [loadingDomains, setLoadingDomains] = useState<Set<string>>(new Set())

// In ProteinTable.tsx, update the toggleProteinExpansion function:

const toggleProteinExpansion = async (protein: ProteinSummary) => {
  const newExpanded = new Set(expandedProteins)

  if (newExpanded.has(protein.id)) {
    newExpanded.delete(protein.id)
  } else {
    newExpanded.add(protein.id)

    // Load domain details if not already loaded
    if (!protein.domains) {
      setLoadingDomains(prev => new Set([...prev, protein.id]))

      try {
        const response = await fetch(`/api/proteins/${protein.source_id}/domains`)
        if (response.ok) {
          const data = await response.json()

          // FIX: Use data.domains instead of expecting domains directly
          console.log('[PROTEIN TABLE] API response:', data)
          console.log('[PROTEIN TABLE] Domains array:', data.domains)

          // Update the protein object with domain details
          protein.domains = data.domains?.filter((d: any) => d.domain_type === 'putative') || []

          console.log('[PROTEIN TABLE] Filtered putative domains:', protein.domains)
        } else {
          console.error('[PROTEIN TABLE] API error:', response.status, response.statusText)
          protein.domains = []
        }
      } catch (error) {
        console.error('Failed to load domain details:', error)
        protein.domains = []
      } finally {
        setLoadingDomains(prev => {
          const newSet = new Set(prev)
          newSet.delete(protein.id)
          return newSet
        })
      }
    }
  }

  setExpandedProteins(newExpanded)
}

  const handleSort = (sortKey: string) => {
    if (onSortChange) {
      onSortChange(sortKey)
    }
  }

  const renderSortableHeader = (label: string, sortKey: string, className = '') => (
    <th className={`text-left py-3 px-4 font-medium text-gray-700 ${className}`}>
      <button
        onClick={() => handleSort(sortKey)}
        className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${
          sortBy === sortKey ? 'text-blue-600' : ''
        }`}
      >
        {label}
        {sortBy === sortKey && (
          sortDirection === 'desc' ?
            <ArrowDown className="w-4 h-4" /> :
            <ArrowUp className="w-4 h-4" />
        )}
      </button>
    </th>
  )

  const renderConfidenceBadge = (confidence: number | null) => {
    if (!confidence) return <Badge variant="outline">N/A</Badge>

    if (confidence >= 0.8) {
      return <Badge className="bg-green-100 text-green-800">{confidence.toFixed(2)}</Badge>
    } else if (confidence >= 0.5) {
      return <Badge className="bg-yellow-100 text-yellow-800">{confidence.toFixed(2)}</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-800">{confidence.toFixed(2)}</Badge>
    }
  }

  const renderClassificationStatus = (protein: ProteinSummary) => {
    if (!protein.is_classified) {
      return (
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-700">Unclassified</span>
        </div>
      )
    }

    if (protein.domains_classified === protein.domain_count && protein.domain_count > 0) {
      return (
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-green-700">Fully Classified</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-yellow-500" />
        <span className="text-yellow-700">
          Partially ({protein.domains_classified}/{protein.domain_count})
        </span>
      </div>
    )
  }

  const renderEvidenceIndicators = (protein: ProteinSummary) => {
    return (
      <div className="flex gap-1">
        <Badge
          variant={protein.has_chain_blast ? "default" : "outline"}
          className={`text-xs ${protein.has_chain_blast ? 'bg-blue-500' : 'text-gray-400'}`}
        >
          CB
        </Badge>
        <Badge
          variant={protein.has_domain_blast ? "default" : "outline"}
          className={`text-xs ${protein.has_domain_blast ? 'bg-purple-500' : 'text-gray-400'}`}
        >
          DB
        </Badge>
        <Badge
          variant={protein.has_hhsearch ? "default" : "outline"}
          className={`text-xs ${protein.has_hhsearch ? 'bg-green-500' : 'text-gray-400'}`}
        >
          HH
        </Badge>
      </div>
    )
  }

  const renderProcessingInfo = (protein: ProteinSummary) => {
    const daysOld = protein.days_old || 0
    const isRecent = protein.is_recent || daysOld < 7

    return (
      <div className="text-sm">
        <div className="flex items-center gap-1">
          <span className="font-medium">#{protein.batch_id}</span>
          {isRecent && <Zap className="w-3 h-3 text-green-500" title="Recent" />}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {daysOld === 0 ? 'Today' :
           daysOld === 1 ? '1 day ago' :
           daysOld < 7 ? `${daysOld} days ago` :
           daysOld < 30 ? `${Math.floor(daysOld / 7)} weeks ago` :
           `${Math.floor(daysOld / 30)} months ago`}
        </div>
      </div>
    )
  }

  const renderClassificationBadge = (value: string | null, type: string) => {
    if (!value) {
      return <Badge variant="outline" className="text-gray-400">Unassigned</Badge>
    }

    const colors = {
      't_group': 'bg-blue-100 text-blue-800',
      'h_group': 'bg-purple-100 text-purple-800',
      'x_group': 'bg-green-100 text-green-800',
      'a_group': 'bg-orange-100 text-orange-800'
    }

    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {value}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading proteins...</p>
      </Card>
    )
  }

  if (proteins.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <div className="text-gray-500 mb-4">No proteins found</div>
        <p className="text-sm text-gray-400">
          Try adjusting your filters or check if data is available in the database.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Protein Analysis Results
        </h3>
        <div className="flex gap-6 text-sm text-gray-600">
          <span>{proteins.length} proteins on this page</span>
          <span>•</span>
          <span>{pagination.total} total proteins</span>
          <span>•</span>
          <span>
            Sorted by {sortBy === 'recent' ? 'most recent' :
                     sortBy === 'batch' ? 'latest batch' :
                     sortBy === 'confidence' ? 'best confidence' :
                     sortBy === 'coverage' ? 'domain coverage' :
                     sortBy === 'domains' ? 'domain count' : sortBy}
          </span>
          <span>•</span>
          <span>{proteins.filter(p => p.is_recent).length} processed recently</span>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Protein</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Classification</th>
                {renderSortableHeader('Domains', 'domains')}
                {renderSortableHeader('Confidence', 'confidence')}
                {renderSortableHeader('Coverage', 'coverage')}
                <th className="text-left py-3 px-4 font-medium text-gray-700">Evidence</th>
                {renderSortableHeader('Processing', 'recent')}
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {proteins.map((protein, index) => (
                 <React.Fragment key={`${protein.source_id}-${protein.batch_id}-${index}`}>
                  {/* Main protein row */}
                  <tr key={`protein-${protein.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleProteinExpansion(protein)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {expandedProteins.has(protein.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onProteinClick(protein)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-lg"
                            >
                              {protein.pdb_id}_{protein.chain_id}
                            </button>
                            {protein.is_recent && (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Recent
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {protein.sequence_length} residues
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {renderClassificationStatus(protein)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {protein.domain_count}
                        </div>
                        <div className="text-xs text-gray-500">
                          {protein.domains_classified} classified
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Best:</span>
                          {renderConfidenceBadge(protein.best_confidence)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Avg:</span>
                          {renderConfidenceBadge(protein.avg_confidence)}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${
                          protein.coverage >= 0.8 ? 'text-green-600' :
                          protein.coverage >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {(protein.coverage * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-500">sequence</div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {renderEvidenceIndicators(protein)}
                        <div className="text-xs text-gray-500">
                          {protein.total_evidence_count} total
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {renderProcessingInfo(protein)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onProteinClick(protein)}
                          title="View protein details"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleProteinExpansion(protein)}
                          title="View domain breakdown"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded domain details */}
                  {expandedProteins.has(protein.id) && (
                    <tr key={`expanded-${protein.id}`}>
                      <td colSpan={8} className="py-0 bg-gray-50">
                        <div className="px-8 py-4">
                          {loadingDomains.has(protein.id) ? (
                            <div className="text-center py-4 text-gray-500">
                              Loading domain details...
                            </div>
                          ) : protein.domains && protein.domains.length > 0 ? (
                            <div className="space-y-3">
                              <h4 className="font-medium text-gray-700 mb-3">
                                Domain Breakdown ({protein.domains.length} domains)
                              </h4>
                              
                              <div className="grid gap-3">
                                {protein.domains.map((domain) => (
                                  <div key={domain.id} className="bg-white rounded border p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className="text-sm">
                                          <span className="font-medium">Domain {domain.domain_number}</span>
                                          <span className="text-gray-500 ml-2">({domain.range})</span>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                          {renderClassificationBadge(domain.t_group, 't_group')}
                                          {domain.h_group && renderClassificationBadge(domain.h_group, 'h_group')}
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <div className="text-sm text-gray-500">Confidence</div>
                                          {renderConfidenceBadge(domain.confidence)}
                                        </div>
                                        
                                        <div className="text-right">
                                          <div className="text-sm text-gray-500">Source</div>
                                          <Badge variant="outline" className="text-xs">
                                            {domain.source}
                                          </Badge>
                                        </div>
                                        
                                        <div className="text-right">
                                          <div className="text-sm text-gray-500">Evidence</div>
                                          <div className="text-sm font-medium">
                                            {domain.evidence_count} items
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              No domain details available
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > pagination.size && (
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((pagination.page - 1) * pagination.size) + 1} to {Math.min(pagination.page * pagination.size, pagination.total)} of {pagination.total} proteins
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {Math.ceil(pagination.total / pagination.size)}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.size)}
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
