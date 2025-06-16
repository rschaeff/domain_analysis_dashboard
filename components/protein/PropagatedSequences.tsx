// components/protein/PropagatedSequencesTab.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Database,
  Activity,
  Star,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Copy,
  Eye
} from 'lucide-react'

interface PropagatedSequence {
  id: string
  pdb_id: string
  chain_id: string
  source_id: string
  sequence_length: number
  batch_id: number
  processing_date: string
  days_old: number
  is_recent: boolean
  domain_count: number
  domains_classified: number
  avg_confidence: number
  best_confidence: number
  coverage: number
  confidence_level: string
  evidence_count: number
  batch_name?: string
  batch_type?: string
}

interface PropagatedSequencesData {
  representative: {
    id: string
    pdb_id: string
    chain_id: string
    source_id: string
    sequence_md5: string
    process_version: string
    batch_id: number
    processing_date: string
  }
  propagated_sequences: PropagatedSequence[]
  pagination: {
    page: number
    size: number
    total: number
    totalPages: number
  }
  summary: {
    total_propagated: number
    classified_propagated: number
    classification_rate: number
    avg_best_confidence: number
    avg_coverage: number
    unique_batches: number
    earliest_processing: string
    latest_processing: string
    processing_span_days: number
  }
}

interface PropagatedSequencesTabProps {
  proteinSourceId: string
}

export function PropagatedSequencesTab({ proteinSourceId }: PropagatedSequencesTabProps) {
  const [data, setData] = useState<PropagatedSequencesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const fetchPropagatedSequences = useCallback(async (pageNum: number = 1) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/proteins/${proteinSourceId}/propagated?page=${pageNum}&size=20`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('This protein is not a representative or has no propagated sequences')
        }
        throw new Error(`Failed to fetch propagated sequences: ${response.status}`)
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [proteinSourceId])

  useEffect(() => {
    fetchPropagatedSequences(page)
  }, [fetchPropagatedSequences, page])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

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

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
          <span className="ml-2 text-gray-600">Loading propagated sequences...</span>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Propagated Sequences</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => fetchPropagatedSequences(page)} variant="outline">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Representative Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Representative: {data.representative.source_id}
            </h3>
            <p className="text-sm text-gray-600">
              Sequence MD5: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{data.representative.sequence_md5}</code>
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Algorithm Version</div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              {data.representative.process_version}
            </Badge>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{data.summary.total_propagated}</div>
            <div className="text-sm text-gray-600">Total Propagated</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{data.summary.classification_rate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Classification Rate</div>
            <div className="text-xs text-gray-500">{data.summary.classified_propagated} classified</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{data.summary.avg_best_confidence.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Avg Confidence</div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{data.summary.unique_batches}</div>
            <div className="text-sm text-gray-600">Unique Batches</div>
            {data.summary.processing_span_days > 0 && (
              <div className="text-xs text-gray-500">{data.summary.processing_span_days} day span</div>
            )}
          </div>
        </div>
      </Card>

      {/* Propagated Sequences Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Propagated Sequences
            </h4>
            <div className="text-sm text-gray-600">
              Showing {data.propagated_sequences.length} of {data.pagination.total}
            </div>
          </div>
        </div>

        {data.propagated_sequences.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No propagated sequences found</h3>
              <p>This representative has no propagated non-representative sequences.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Protein</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Domains</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Quality</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Processing</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.propagated_sequences.map((sequence) => (
                    <tr key={sequence.source_id} className="hover:bg-gray-50 transition-colors">
                      {/* Protein Info */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {sequence.pdb_id}_{sequence.chain_id}
                            </span>
                            {sequence.is_recent && (
                              <Badge variant="default" className="text-xs">New</Badge>
                            )}
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
                              Propagated
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-500">
                            {sequence.sequence_length.toLocaleString()} residues
                          </div>
                          <div className="text-xs text-blue-600">
                            Batch {sequence.batch_id}
                            {sequence.batch_name && ` (${sequence.batch_name})`}
                          </div>
                        </div>
                      </td>

                      {/* Domain Info */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{sequence.domain_count}</span>
                            {sequence.domain_count > 0 && (
                              <Badge
                                variant={sequence.domains_classified === sequence.domain_count ? "default" : "outline"}
                                className="text-xs"
                              >
                                {sequence.domains_classified}/{sequence.domain_count}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {(sequence.coverage * 100).toFixed(1)}% coverage
                            </span>
                          </div>
                          {sequence.evidence_count > 0 && (
                            <div className="text-xs text-gray-500">
                              {sequence.evidence_count} evidence items
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Quality */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {sequence.best_confidence > 0 ? (
                            getConfidenceBadge(sequence.best_confidence, sequence.confidence_level)
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              No confidence
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Processing Info */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {sequence.days_old === 0 ? 'Today' :
                             sequence.days_old === 1 ? '1 day ago' :
                             `${sequence.days_old} days ago`}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDate(sequence.processing_date)}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/protein/${sequence.source_id}`, '_blank')}
                            className="flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/protein/${sequence.source_id}`, '_blank')}
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

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.pagination.page - 1)}
                      disabled={data.pagination.page <= 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>

                    {/* Page numbers */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, data.pagination.page - 2) + i
                        if (pageNum > data.pagination.totalPages) return null

                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === data.pagination.page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
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
                      onClick={() => handlePageChange(data.pagination.page + 1)}
                      disabled={data.pagination.page >= data.pagination.totalPages}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Summary Info */}
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            <strong>Processing Timeline:</strong> {formatDate(data.summary.earliest_processing)} to {formatDate(data.summary.latest_processing)}
          </div>
          <div>
            <strong>Average Coverage:</strong> {(data.summary.avg_coverage * 100).toFixed(1)}%
          </div>
        </div>
      </Card>
    </div>
  )
}
