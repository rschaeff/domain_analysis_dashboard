// components/tables/ProteinTable.tsx - Enhanced with curation status
'use client'

import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { PaginationParams } from '@/lib/types'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  UserCheck,
  Clock,
  Star,
  Activity,
  Database,
  Flag,
  AlertTriangle,
  CheckCircle,
  User,
  Calendar
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
  processing_date: string
  days_old: number
  is_recent: boolean

  // Domain summary
  domain_count: number
  domains_classified: number
  avg_confidence: number
  best_confidence: number
  coverage: number
  confidence_level: 'high' | 'medium' | 'low'

  // Evidence summary
  total_evidence_count: number
  evidence_types: string
  has_chain_blast: boolean
  has_domain_blast: boolean
  has_hhsearch: boolean

  // NEW: Curation-related fields
  has_curation_decision?: boolean
  curation_decision_id?: number
  decision_type?: string
  curation_status?: string
  curator_name?: string
  decision_date?: string
  flagged_for_review?: boolean
  needs_review?: boolean
  curation_confidence?: number
  curation_notes?: string
}

interface ProteinTableProps {
  proteins: ProteinSummary[]
  pagination: PaginationParams
  onPageChange: (page: number) => void
  onProteinClick: (protein: ProteinSummary) => void
  loading?: boolean
  showCurationStatus?: boolean
}

// Helper function to format dates
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString()
}

// Helper function to get curation status badge
const getCurationBadge = (protein: ProteinSummary) => {
  if (!protein.has_curation_decision) {
    return (
      <Badge variant="outline" className="text-gray-600 border-gray-300">
        <User className="w-3 h-3 mr-1" />
        Not Curated
      </Badge>
    )
  }

  if (protein.flagged_for_review) {
    return (
      <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-300">
        <Flag className="w-3 h-3 mr-1" />
        Flagged
      </Badge>
    )
  }

  if (protein.needs_review) {
    return (
      <Badge variant="destructive" className="bg-yellow-100 text-yellow-800 border-yellow-300">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Needs Review
      </Badge>
    )
  }

  const statusColors = {
    approved: 'bg-green-100 text-green-800 border-green-300',
    pending: 'bg-blue-100 text-blue-800 border-blue-300',
    rejected: 'bg-red-100 text-red-800 border-red-300'
  }

  const statusClass = statusColors[protein.curation_status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-300'

  return (
    <Badge variant="outline" className={statusClass}>
      <UserCheck className="w-3 h-3 mr-1" />
      {protein.curation_status || 'Curated'}
    </Badge>
  )
}

// Helper function to get confidence badge
const getConfidenceBadge = (confidence: number, level: string) => {
  const colors = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800'
  }

  return (
    <Badge variant="outline" className={colors[level as keyof typeof colors]}>
      <Star className="w-3 h-3 mr-1" />
      {confidence.toFixed(2)}
    </Badge>
  )
}

export function ProteinTable({
  proteins,
  pagination,
  onPageChange,
  onProteinClick,
  loading = false,
  showCurationStatus = true
}: ProteinTableProps) {
  const totalPages = Math.ceil(pagination.total / pagination.size)

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
          <span className="ml-2 text-gray-600">Loading proteins...</span>
        </div>
      </Card>
    )
  }

  if (proteins.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No proteins found</h3>
          <p>Try adjusting your filters or search criteria.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table Header Info */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {proteins.length} of {pagination.total.toLocaleString()} proteins
        </div>
        <div className="flex items-center gap-4">
          {showCurationStatus && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Curation Status:</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                <span className="text-xs text-gray-500">Curated</span>
                <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded ml-2"></div>
                <span className="text-xs text-gray-500">Not Curated</span>
                <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded ml-2"></div>
                <span className="text-xs text-gray-500">Flagged</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Protein</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Domains</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Evidence</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Quality</th>
                {showCurationStatus && (
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Curation</th>
                )}
                <th className="text-left py-3 px-4 font-medium text-gray-900">Processing</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {proteins.map((protein) => (
                <tr
                  key={protein.source_id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Protein Info */}
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {protein.pdb_id}_{protein.chain_id}
                        </span>
                        {protein.is_recent && (
                          <Badge variant="default" className="text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {protein.sequence_length.toLocaleString()} residues
                      </div>
                      {protein.batch_id && (
                        <div className="text-xs text-blue-600">
                          Batch {protein.batch_id}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Domain Info */}
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {protein.domain_count}
                        </span>
                        {protein.domain_count > 0 && (
                          <Badge
                            variant={protein.is_classified ? "default" : "outline"}
                            className="text-xs"
                          >
                            {protein.domains_classified}/{protein.domain_count}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {(protein.coverage * 100).toFixed(1)}% coverage
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Evidence */}
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        {protein.total_evidence_count} items
                      </div>
                      <div className="flex gap-1">
                        {protein.has_chain_blast && (
                          <Badge variant="outline" className="text-xs">BLAST</Badge>
                        )}
                        {protein.has_hhsearch && (
                          <Badge variant="outline" className="text-xs">HHSearch</Badge>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Quality */}
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      {protein.best_confidence > 0 ? (
                        getConfidenceBadge(protein.best_confidence, protein.confidence_level)
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          No confidence
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Curation Status */}
                  {showCurationStatus && (
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {getCurationBadge(protein)}
                        {protein.curator_name && (
                          <div className="text-xs text-gray-500">
                            by {protein.curator_name}
                          </div>
                        )}
                        {protein.decision_date && (
                          <div className="text-xs text-gray-400">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {formatDate(protein.decision_date)}
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Processing Info */}
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="text-sm text-gray-600">
                        {protein.days_old === 0 ? 'Today' :
                         protein.days_old === 1 ? '1 day ago' :
                         `${protein.days_old} days ago`}
                      </div>
                      {protein.reference_version && (
                        <div className="text-xs text-gray-400">
                          {protein.reference_version}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onProteinClick(protein)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/protein/${protein.source_id}`, '_blank')}
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {pagination.page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            {/* Page numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, pagination.page - 2) + i
                if (pageNum > totalPages) return null

                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === pagination.page ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
