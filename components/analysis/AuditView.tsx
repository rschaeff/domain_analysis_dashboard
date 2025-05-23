// components/analysis/AuditView.tsx
import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Database, FileText
} from 'lucide-react'

interface PartitionAuditData {
  batch_id: number
  batch_name: string
  batch_type: string
  ref_version: string
  batch_status: string

  // Expectations vs Reality
  batch_reported_total: number
  batch_reported_completed: number
  actual_proteins_in_batch: number
  proteins_reported_done: number

  // Partition Results
  partitions_attempted: number
  partitions_classified: number
  partitions_unclassified: number
  partitions_peptide: number
  total_domains_found: number
  total_evidence_items: number

  // Gaps and Issues
  proteins_missing_partitions: number
  partition_gap: number
  batch_definition_gap: number

  // File Status
  fasta_files_exist: number
  blast_files_exist: number
  hhsearch_files_exist: number
  partition_files_exist: number

  // Samples
  stages_present: string[]
  sample_unclassified: string[]
  sample_classified: string[]
  sample_missing_proteins: string[]

  // Quality Metrics
  partition_attempt_rate: number
  classification_success_rate: number
  overall_success_rate: number
}

interface BatchOption {
  id: number
  batch_name: string
  batch_type: string
  total_items: number
  status: string
}

// Helper function to safely format numbers
const safeNumber = (value: any, defaultValue: number = 0): number => {
  const num = Number(value)
  return isNaN(num) ? defaultValue : num
}

// Helper function to safely format integers with locale string
const safeToLocaleString = (value: any, defaultValue: number = 0): string => {
  return safeNumber(value, defaultValue).toLocaleString()
}

export function AuditView() {
  const [partitionAudit, setPartitionAudit] = useState<PartitionAuditData[]>([])
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([])
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null)

  const [auditLoading, setAuditLoading] = useState(false)
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load available batches
  const loadBatches = useCallback(async () => {
    setBatchesLoading(true)
    try {
      const response = await fetch('/api/batches')
      if (response.ok) {
        const data = await response.json()
        setBatchOptions(data.batches || [])
      }
    } catch (error) {
      console.error('Failed to load batches:', error)
      setError('Failed to load batch list')
    } finally {
      setBatchesLoading(false)
    }
  }, [])

  // Run partition audit only
  const runAudit = useCallback(async (batchId?: number) => {
    setAuditLoading(true)
    setError(null)

    try {
      const batchParam = batchId ? `?batch_id=${batchId}` : ''
      const response = await fetch(`/api/audit/missing-partitions${batchParam}`)

      if (!response.ok) {
        throw new Error('Partition audit request failed')
      }

      const data = await response.json()
      setPartitionAudit(data.partition_audit || [])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed')
    } finally {
      setAuditLoading(false)
    }
  }, [])

  // Load data on mount and when batch changes
  useEffect(() => {
    loadBatches()
  }, [loadBatches])

  useEffect(() => {
    runAudit(selectedBatch || undefined)
  }, [selectedBatch, runAudit])

  // Calculate summary statistics
  const auditSummary = React.useMemo(() => {
    const totalProteins = partitionAudit.reduce((sum, batch) => sum + (batch.actual_proteins_in_batch ?? 0), 0)
    const totalAttempted = partitionAudit.reduce((sum, batch) => sum + (batch.partitions_attempted ?? 0), 0)
    const totalClassified = partitionAudit.reduce((sum, batch) => sum + (batch.partitions_classified ?? 0), 0)
    const totalMissing = partitionAudit.reduce((sum, batch) => sum + (batch.proteins_missing_partitions ?? 0), 0)
    const criticalBatches = partitionAudit.filter(batch =>
      (batch.proteins_missing_partitions ?? 0) > 50 || (batch.overall_success_rate ?? 0) < 50
    ).length

    return {
      totalProteins,
      totalAttempted,
      totalClassified,
      totalMissing,
      criticalBatches,
      overallAttemptRate: totalProteins > 0 ? (totalAttempted / totalProteins) * 100 : 0,
      overallSuccessRate: totalAttempted > 0 ? (totalClassified / totalAttempted) * 100 : 0
    }
  }, [partitionAudit])

  const handleRefresh = useCallback(() => {
    runAudit(selectedBatch || undefined)
  }, [selectedBatch, runAudit])

  const handleBatchChange = useCallback((batchId: number | null) => {
    setSelectedBatch(batchId)
  }, [])

  if (auditLoading && partitionAudit.length === 0) {
    return (
      <Card className="p-8 text-center">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">Running partition audit...</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <div className="font-medium text-red-800">Audit Error</div>
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

      {/* Audit Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Partition Pipeline Audit</h3>
            <select
              value={selectedBatch || ''}
              onChange={(e) => handleBatchChange(e.target.value ? parseInt(e.target.value) : null)}
              className="border rounded px-3 py-1 text-sm min-w-48"
              disabled={batchesLoading}
            >
              <option value="">All Batches</option>
              {batchOptions.map(batch => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_name} ({batch.batch_type}) - {batch.total_items} proteins
                </option>
              ))}
            </select>
          </div>
          <Button onClick={handleRefresh} className="flex items-center gap-2" disabled={auditLoading}>
            <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
            Refresh Audit
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {safeToLocaleString(auditSummary.totalProteins)}
              </div>
              <div className="text-sm text-gray-600">Total Proteins</div>
              <div className="text-xs text-gray-500">
                {safeNumber(auditSummary.overallAttemptRate).toFixed(1)}% attempted
              </div>
            </div>
            <Database className="w-8 h-8 text-blue-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {safeToLocaleString(auditSummary.totalClassified)}
              </div>
              <div className="text-sm text-gray-600">Classified</div>
              <div className="text-xs text-gray-500">
                {safeNumber(auditSummary.overallSuccessRate).toFixed(1)}% success rate
              </div>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-red-600">
                {safeToLocaleString(auditSummary.totalMissing)}
              </div>
              <div className="text-sm text-gray-600">Missing Partitions</div>
              <div className="text-xs text-gray-500">
                Never attempted
              </div>
            </div>
            <XCircle className="w-8 h-8 text-red-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {safeToLocaleString(auditSummary.criticalBatches)}
              </div>
              <div className="text-sm text-gray-600">Critical Batches</div>
              <div className="text-xs text-gray-500">
                Need attention
              </div>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Partition Audit Results */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Partition Pipeline Results
        </h3>

        {partitionAudit.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {auditLoading ? 'Loading audit data...' : 'No partition audit data available'}
          </div>
        ) : (
          <div className="space-y-4">
            {partitionAudit.map((batch) => (
              <Card key={batch.batch_id} className="p-6">
                <div className="space-y-4">
                  {/* Batch Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-semibold">{batch.batch_name}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span>ID: {batch.batch_id}</span>
                        <span>Type: {batch.batch_type}</span>
                        <span>Version: {batch.ref_version}</span>
                        <Badge variant={batch.batch_status === 'completed' ? 'default' : 'secondary'}>
                          {batch.batch_status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {safeNumber(batch.overall_success_rate).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Overall Success</div>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {safeToLocaleString(batch.actual_proteins_in_batch)}
                      </div>
                      <div className="text-xs text-gray-600">In Batch</div>
                    </div>

                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">
                        {safeToLocaleString(batch.partitions_attempted)}
                      </div>
                      <div className="text-xs text-gray-600">Attempted</div>
                      <div className="text-xs text-gray-500">
                        {safeNumber(batch.partition_attempt_rate).toFixed(1)}%
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-600">
                        {safeToLocaleString(batch.partitions_classified)}
                      </div>
                      <div className="text-xs text-gray-600">Classified</div>
                      <div className="text-xs text-gray-500">
                        {safeNumber(batch.classification_success_rate).toFixed(1)}%
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-xl font-bold text-yellow-600">
                        {safeToLocaleString(batch.partitions_unclassified)}
                      </div>
                      <div className="text-xs text-gray-600">Unclassified</div>
                    </div>

                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">
                        {safeToLocaleString(batch.proteins_missing_partitions)}
                      </div>
                      <div className="text-xs text-gray-600">Missing</div>
                    </div>

                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">
                        {safeToLocaleString(batch.total_domains_found)}
                      </div>
                      <div className="text-xs text-gray-600">Domains</div>
                    </div>
                  </div>

                  {/* Issues and Gaps */}
                  {(safeNumber(batch.proteins_missing_partitions) > 0 || safeNumber(batch.partition_gap) > 0 || safeNumber(batch.batch_definition_gap) > 0) && (
                    <div className="border-t pt-4">
                      <h5 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Issues Detected
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {safeNumber(batch.proteins_missing_partitions) > 0 && (
                          <div className="bg-red-50 p-3 rounded">
                            <div className="font-semibold text-red-800">
                              {safeToLocaleString(batch.proteins_missing_partitions)} Missing Partitions
                            </div>
                            <div className="text-sm text-red-700">
                              Proteins in batch but no partition results
                            </div>
                          </div>
                        )}

                        {safeNumber(batch.partition_gap) > 0 && (
                          <div className="bg-orange-50 p-3 rounded">
                            <div className="font-semibold text-orange-800">
                              {safeToLocaleString(batch.partition_gap)} Partition Gap
                            </div>
                            <div className="text-sm text-orange-700">
                              Difference between expected and attempted
                            </div>
                          </div>
                        )}

                        {safeNumber(batch.batch_definition_gap) > 0 && (
                          <div className="bg-yellow-50 p-3 rounded">
                            <div className="font-semibold text-yellow-800">
                              {safeToLocaleString(batch.batch_definition_gap)} Definition Gap
                            </div>
                            <div className="text-sm text-yellow-700">
                              Reported total vs actual proteins
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Status */}
                  <div className="border-t pt-4">
                    <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      File Status
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">{safeToLocaleString(batch.fasta_files_exist)}</div>
                        <div className="text-xs text-gray-600">FASTA</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-600">{safeToLocaleString(batch.blast_files_exist)}</div>
                        <div className="text-xs text-gray-600">BLAST</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-purple-600">{safeToLocaleString(batch.hhsearch_files_exist)}</div>
                        <div className="text-xs text-gray-600">HHSearch</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-orange-600">{safeToLocaleString(batch.partition_files_exist)}</div>
                        <div className="text-xs text-gray-600">Partitions</div>
                      </div>
                    </div>
                  </div>

                  {/* Sample Cases */}
                  {(batch.sample_missing_proteins?.length > 0 || batch.sample_unclassified?.length > 0) && (
                    <div className="border-t pt-4">
                      <h5 className="font-medium text-gray-700 mb-2">Sample Cases</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {batch.sample_missing_proteins?.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-red-700">Missing Partitions:</div>
                            <div className="text-xs text-gray-600 font-mono mt-1">
                              {batch.sample_missing_proteins.join(', ')}
                            </div>
                          </div>
                        )}

                        {batch.sample_unclassified?.length > 0 && (
                          <div>
                            <div className="text-sm font-medium text-yellow-700">Unclassified:</div>
                            <div className="text-xs text-gray-600 font-mono mt-1">
                              {batch.sample_unclassified.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Process Stages */}
                  {batch.stages_present?.length > 0 && (
                    <div className="border-t pt-4">
                      <h5 className="font-medium text-gray-700 mb-2">Process Stages Present</h5>
                      <div className="flex gap-2 flex-wrap">
                        {batch.stages_present.map(stage => (
                          <Badge key={stage} variant="outline" className="text-xs">
                            {stage}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
