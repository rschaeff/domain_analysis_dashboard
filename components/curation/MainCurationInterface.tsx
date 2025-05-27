import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StructureViewer } from '@/components/visualization/StructureViewer'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Check,
  X,
  AlertTriangle,
  Clock,
  Save,
  Eye,
  FileText,
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react'

// Domain colors for consistency
const DOMAIN_COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#9333EA', '#EA580C', '#0891B2',
  '#DB2777', '#7C3AED', '#059669', '#DC2626', '#F59E0B', '#10B981'
]

interface CurationSession {
  id: number
  curator_name: string
  target_batch_size: number
  proteins_reviewed: number
  current_protein_index: number
  status: string
  locked_proteins: string[]
  created_at: string
  session_metadata?: {
    batch_id?: number
    batch_name?: string
    reference_version?: string
  }
}

interface CurationProtein {
  id: number
  source_id: string
  pdb_id: string
  chain_id: string
  sequence_length: number
  batch_id?: number
  batch_info?: {
    batch_id: number
    batch_name: string
    reference_version: string
  }
  domains: any[]
  evidence: any[]
}

interface CurationDecision {
  has_domain: boolean | null
  domain_assigned_correctly: boolean | null
  boundaries_correct: boolean | null
  is_fragment: boolean | null
  is_repeat_protein: boolean | null
  confidence_level: number
  notes: string
  flagged_for_review: boolean
}

interface CurationEvidence {
  evidence_id: number
  evidence_type: string
  ecod_domain_id: string | null
  source_id: string | null
  hit_range: string
  query_range: string
  confidence: number
  evalue: number
}

interface Batch {
  id: number
  batch_name: string
  batch_type: string
  total_items: number
  completed_items: number
  status: string
  ref_version: string
  actual_protein_count: number
  partition_count: number
}

// Batch Selector Component
function BatchSelector({
  onBatchSelect,
  currentBatchId,
  showStats = true
}: {
  onBatchSelect: (batchId: number | null) => void
  currentBatchId?: number | null
  showStats?: boolean
}) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBatches()
  }, [])

  const fetchBatches = async () => {
    try {
      setError(null)
      const response = await fetch('/api/batches')

      if (response.ok) {
        const data = await response.json()

        // Smart filtering for curation-ready batches
        const relevantBatches = (data.batches || [])
          .filter((b: Batch) => {
            // Must have partition data
            if (b.partition_count <= 0) return false

            // For pdb_hhsearch batches: only include completed or domain_partition_complete
            if (b.batch_type === 'pdb_hhsearch') {
              return ['completed', 'domain_partition_complete', 'domain_partition_complete_with_errors'].includes(b.status)
            }

            // For alt_rep batches: include processed or created
            if (b.batch_type === 'alt_rep') {
              return ['processed', 'created', 'completed'].includes(b.status)
            }

            return true
          })
          .sort((a: Batch, b: Batch) => {
            // Prioritize pdb_hhsearch batches first
            if (a.batch_type !== b.batch_type) {
              if (a.batch_type === 'pdb_hhsearch') return -1
              if (b.batch_type === 'pdb_hhsearch') return 1
            }
            return b.id - a.id // Latest first
          })

        console.log('📊 Curation-ready batches:', relevantBatches.map(b => ({
          id: b.id,
          name: b.batch_name,
          type: b.batch_type,
          status: b.status,
          partition_count: b.partition_count
        })))

        setBatches(relevantBatches)
      } else {
        throw new Error('Failed to fetch batches')
      }
    } catch (error) {
      console.error('Error fetching batches:', error)
      setError('Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">Batch Filter:</label>
        <div className="animate-pulse bg-gray-200 h-8 w-48 rounded-md"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-red-600">Batch Filter:</label>
        <span className="text-sm text-red-500">{error}</span>
        <Button size="sm" variant="outline" onClick={fetchBatches}>
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
    )
  }

  const selectedBatch = batches.find(b => b.id === currentBatchId)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'domain_partition_complete': return 'text-blue-600'
      case 'domain_partition_complete_with_errors': return 'text-yellow-600'
      case 'processed': return 'text-blue-600'
      case 'indexed': return 'text-gray-600'
      case 'created': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Batch Filter:</label>
        <select
          value={currentBatchId || ''}
          onChange={(e) => onBatchSelect(e.target.value ? parseInt(e.target.value) : null)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Available Batches (Auto-Select)</option>
          {batches.map(batch => (
            <option key={batch.id} value={batch.id}>
              {batch.batch_name}
              {showStats && batch.partition_count > 0 &&
                ` (${batch.partition_count.toLocaleString()} proteins)`
              }
              {` [${batch.batch_type}]`}
              {batch.status !== 'completed' && ` - ${batch.status}`}
            </option>
          ))}
        </select>
      </div>

      {/* Show selected batch details */}
      {selectedBatch && showStats && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 ml-20">
          <span>
            Type: <span className="font-medium">{selectedBatch.batch_type}</span>
          </span>
          <span>
            Status: <span className={`font-medium ${getStatusColor(selectedBatch.status)}`}>
              {selectedBatch.status}
            </span>
          </span>
          <span>
            Version: <span className="font-medium">{selectedBatch.ref_version}</span>
          </span>
          {selectedBatch.total_items > 0 && (
            <span>
              Progress: <span className="font-medium">
                {((selectedBatch.completed_items / selectedBatch.total_items) * 100).toFixed(1)}%
              </span>
            </span>
          )}
        </div>
      )}

      {/* Show batch type explanation */}
      {batches.length > 0 && (
        <div className="text-xs text-gray-500 ml-20">
          💡 <strong>pdb_hhsearch</strong>: Main domain analysis | <strong>alt_rep</strong>: Alternative representatives
        </div>
      )}
    </div>
  )
}

// Utility functions
const getBestEvidenceId = (evidence: any): string | null => {
  // Check multiple possible fields for the evidence ID
  return evidence.ecod_domain_id ||
         evidence.source_id ||
         evidence.domain_ref_id ||
         evidence.hit_id ||
         evidence.domain_id ||
         null
}

const parsePdbRange = (pdbRange: string | null | undefined): {
  ranges: string[],
  displayRange: string,
  start: number | null,
  end: number | null
} => {
  if (!pdbRange || typeof pdbRange !== 'string') {
    console.warn('Invalid or missing pdb_range:', pdbRange)
    return { ranges: [], displayRange: 'undefined', start: null, end: null }
  }

  try {
    // Remove chain prefix if present
    let cleanRange = pdbRange
    if (pdbRange.includes(':')) {
      cleanRange = pdbRange.split(':')[1] || pdbRange
    }

    // Handle discontinuous ranges
    const segments = cleanRange.split(',').map(s => s.trim()).filter(s => s.length > 0)
    const validRanges: string[] = []
    let minStart = Infinity
    let maxEnd = -Infinity

    for (const segment of segments) {
      if (segment.includes('-')) {
        const [startStr, endStr] = segment.split('-')
        const start = parseInt(startStr?.trim())
        const end = parseInt(endStr?.trim())

        if (!isNaN(start) && !isNaN(end) && start <= end) {
          validRanges.push(`${start}-${end}`)
          minStart = Math.min(minStart, start)
          maxEnd = Math.max(maxEnd, end)
        }
      }
    }

    if (validRanges.length === 0) {
      return { ranges: [], displayRange: pdbRange, start: null, end: null }
    }

    return {
      ranges: validRanges,
      displayRange: validRanges.join(','),
      start: minStart === Infinity ? null : minStart,
      end: maxEnd === -Infinity ? null : maxEnd
    }
  } catch (error) {
    console.error('Error parsing pdb_range:', pdbRange, error)
    return { ranges: [], displayRange: pdbRange, start: null, end: null }
  }
}

const processDomainDataCorrectly = (domains: any[]): any[] => {
  return domains.map((domain, index) => {
    console.log(`🔍 Processing domain ${index + 1}:`, {
      id: domain.id,
      pdb_range: domain.pdb_range,
      range: domain.range,
      start_pos: domain.start_pos,
      end_pos: domain.end_pos
    })

    let parsedRange = parsePdbRange(domain.pdb_range)

    if (parsedRange.ranges.length === 0 && domain.range) {
      console.log(`⚠️ Domain ${index + 1}: pdb_range not available, trying range field`)
      parsedRange = parsePdbRange(domain.range)
    }

    if (parsedRange.ranges.length === 0) {
      const start = domain.start_pos || domain.start || 1
      const end = domain.end_pos || domain.end || 100

      if (start && end && start <= end) {
        parsedRange = {
          ranges: [`${start}-${end}`],
          displayRange: `${start}-${end}`,
          start: start,
          end: end
        }
      }
    }

    console.log(`✅ Domain ${index + 1} processed:`, {
      original_pdb_range: domain.pdb_range,
      parsed_ranges: parsedRange.ranges,
      display_range: parsedRange.displayRange,
      start: parsedRange.start,
      end: parsedRange.end
    })

    return {
      ...domain,
      id: domain.id || `domain_${index + 1}`,
      pdb_range: domain.pdb_range,
      range: domain.range,
      start_pos: domain.start_pos,
      end_pos: domain.end_pos,
      start: parsedRange.start || domain.start_pos || domain.start,
      end: parsedRange.end || domain.end_pos || domain.end,
      threeDMolRanges: parsedRange.ranges,
      displayRange: parsedRange.displayRange,
      color: domain.color || DOMAIN_COLORS[index % DOMAIN_COLORS.length],
      label: `Domain ${domain.domain_number || index + 1} (${parsedRange.displayRange})`,
      domain_type: 'putative' // Ensure this is set for StructureViewer filtering
    }
  })
}

// Main Component
export default function MainCurationInterface() {
  // Session Management
  const [session, setSession] = useState<CurationSession | null>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [curatorName, setCuratorName] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)

  // Current Protein & Curation State
  const [currentProtein, setCurrentProtein] = useState<CurationProtein | null>(null)
  const [proteins, setProteins] = useState<CurationProtein[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoadingProtein, setIsLoadingProtein] = useState(false)

  // Curation Decision State
  const [decision, setDecision] = useState<CurationDecision>({
    has_domain: null,
    domain_assigned_correctly: null,
    boundaries_correct: null,
    is_fragment: null,
    is_repeat_protein: null,
    confidence_level: 3,
    notes: '',
    flagged_for_review: false
  })

  // Evidence and Structure State
  const [selectedEvidence, setSelectedEvidence] = useState<CurationEvidence | null>(null)
  const [structuresLoaded, setStructuresLoaded] = useState(false)
  const [structureError, setStructureError] = useState<string | null>(null)

  // UI State
  const [reviewStartTime, setReviewStartTime] = useState<Date | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [showBatchSummary, setShowBatchSummary] = useState(false)
  const [allDecisions, setAllDecisions] = useState<CurationDecision[]>([])
  const [showProteinDetails, setShowProteinDetails] = useState(false)

  // Start new curation session
  const startCurationSession = async () => {
    if (!curatorName.trim()) {
      alert('Please enter your name to start curation')
      return
    }

    setIsStartingSession(true)
    try {
      const response = await fetch('/api/curation/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curator_name: curatorName.trim(),
          batch_size: 10,
          batch_id: selectedBatchId
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('📊 Session started successfully:', {
          session: data.session,
          proteinCount: data.proteins?.length,
          firstProtein: data.proteins?.[0],
          batchSummary: data.batch_summary
        })

        setSession(data.session)
        setProteins(data.proteins)
        setCurrentIndex(0)
        setAllDecisions(new Array(data.proteins.length).fill(null))

        // Load first protein
        if (data.proteins.length > 0) {
          await loadProteinForCuration(data.proteins[0])
        }
      } else {
        const error = await response.json()
        console.error('Session start failed:', error)
        alert(`Failed to start session: ${error.error || error.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Failed to start curation session')
    } finally {
      setIsStartingSession(false)
    }
  }

  // Load protein data for curation with batch awareness
  const loadProteinForCuration = async (protein: any) => {
    setIsLoadingProtein(true)
    setStructuresLoaded(false)
    setStructureError(null)
    setReviewStartTime(new Date())

    try {
      // Validate source_id format
      if (!protein.source_id || !protein.source_id.includes('_')) {
        throw new Error(`Invalid protein source_id format: ${protein.source_id}. Expected format: PDB_CHAIN (e.g., 3hls_A)`)
      }

      // Include batch_id if available to ensure we get the right domains
      const url = protein.batch_id
        ? `/api/proteins/${protein.source_id}/domains?batch_id=${protein.batch_id}`
        : `/api/proteins/${protein.source_id}/domains`

      console.log('🔍 Loading protein domains:', {
        protein,
        url,
        source_id: protein.source_id,
        batch_id: protein.batch_id
      })

      const domainsResponse = await fetch(url)

      if (!domainsResponse.ok) {
        const errorText = await domainsResponse.text()
        let errorMessage = `Failed to load protein domains: ${domainsResponse.status} ${domainsResponse.statusText}`

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorJson.message || errorMessage
          console.error('API Error:', errorJson)
        } catch (e) {
          console.error('API Error (text):', errorText)
        }

        throw new Error(errorMessage)
      }

      const domainsData = await domainsResponse.json()

      // Check for batch warning
      if (domainsData.metadata?.warning) {
        console.warn('⚠️ Batch warning:', domainsData.metadata.warning)

        if (domainsData.metadata.available_batches) {
          console.log('Available batches:', domainsData.metadata.available_batches)
        }
      }

      console.log('📊 Domain data loaded:', {
        source_id: domainsData.protein.source_id,
        batch_id: domainsData.protein.batch_id,
        batch_name: domainsData.protein.batch_name,
        batch_type: domainsData.protein.batch_type,
        reference_version: domainsData.protein.reference_version,
        domainCount: domainsData.domains?.length,
        warning: domainsData.metadata?.warning
      })

      // Process domains for StructureViewer compatibility
      const processedDomains = processDomainDataCorrectly(domainsData.domains || [])

      console.log('🔍 Original domains from API:', domainsData.domains)
      console.log('🔍 Processed domains for viewer:', processedDomains)

      // Evidence is already included in the response
      const allEvidence = processedDomains.flatMap(d => d.evidence || [])

      console.log('Evidence loaded:', allEvidence.length, 'items')
      if (allEvidence.length > 0) {
        console.log('Sample evidence:', allEvidence[0])
      }

      const proteinWithData = {
        ...protein,
        ...domainsData.protein,
        domains: processedDomains,
        evidence: allEvidence
      }

      setCurrentProtein(proteinWithData)

      // Auto-select best evidence
      if (allEvidence.length > 0) {
        const sortedEvidence = [...allEvidence].sort((a, b) => {
          if (a.confidence !== b.confidence) {
            return b.confidence - a.confidence
          }
          return a.evalue - b.evalue
        })

        const bestEvidence = sortedEvidence[0]

        if (bestEvidence) {
          const bestId = getBestEvidenceId(bestEvidence)
          if (bestId) {
            const validatedEvidence = {
              ...bestEvidence,
              ecod_domain_id: bestId,
              source_id: bestId
            }
            setSelectedEvidence(validatedEvidence)
            console.log('Selected evidence:', validatedEvidence)
          } else {
            console.warn('No valid evidence ID found in best evidence:', bestEvidence)
            setSelectedEvidence(allEvidence[0])
          }
        }
      }

      // Reset decision for new protein
      setDecision({
        has_domain: null,
        domain_assigned_correctly: null,
        boundaries_correct: null,
        is_fragment: null,
        is_repeat_protein: null,
        confidence_level: 3,
        notes: '',
        flagged_for_review: false
      })

    } catch (error) {
      console.error('❌ Error loading protein:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setStructureError(errorMessage)

      // Show user-friendly error in UI
      alert(`Failed to load protein data:\n\n${errorMessage}\n\nPlease check the console for more details.`)
    } finally {
      setIsLoadingProtein(false)
    }
  }

  // Auto-save decision
  const autoSaveDecision = useCallback(async () => {
    if (!session || !currentProtein || !decision) return

    setIsAutoSaving(true)
    try {
      const response = await fetch(`/api/curation/session/${session.id}/auto-save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_protein_index: currentIndex,
          decisions: allDecisions.map((d, i) => ({
            protein_source_id: proteins[i]?.source_id,
            decision: d,
            completed: d !== null
          })),
          notes: decision.notes
        })
      })

      if (!response.ok) {
        console.error('Auto-save failed')
      }
    } catch (error) {
      console.error('Auto-save error:', error)
    } finally {
      setIsAutoSaving(false)
    }
  }, [session, currentProtein, decision, currentIndex, allDecisions, proteins])

  // Complete current protein review
  const completeCurrentReview = async () => {
    if (!currentProtein || !selectedEvidence) {
      alert('Please select evidence and complete all questions')
      return
    }

    // Calculate review time
    const reviewTime = reviewStartTime
      ? Math.round((Date.now() - reviewStartTime.getTime()) / 1000)
      : 0

    // Get the best evidence ID for saving
    const evidenceId = getBestEvidenceId(selectedEvidence)

    // Save decision to API
    try {
      const response = await fetch('/api/curation/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session?.id,
          protein_source_id: currentProtein.source_id,
          decisions: decision,
          evidence_used: {
            primary_evidence_type: selectedEvidence.evidence_type,
            primary_evidence_source_id: evidenceId,
            reference_domain_id: evidenceId,
            evidence_confidence: selectedEvidence.confidence,
            evidence_evalue: selectedEvidence.evalue
          },
          review_time_seconds: reviewTime
        })
      })

      if (response.ok) {
        // Update local state
        const newDecisions = [...allDecisions]
        newDecisions[currentIndex] = decision
        setAllDecisions(newDecisions)

        // Auto-save
        await autoSaveDecision()

        // Move to next protein or show summary
        if (currentIndex < proteins.length - 1) {
          const nextIndex = currentIndex + 1
          setCurrentIndex(nextIndex)
          await loadProteinForCuration(proteins[nextIndex])
        } else {
          setShowBatchSummary(true)
        }
      } else {
        const error = await response.json()
        alert(`Failed to save decision: ${error.error}`)
      }
    } catch (error) {
      console.error('Error saving decision:', error)
      alert('Failed to save curation decision')
    }
  }

  // Navigation functions
  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      loadProteinForCuration(proteins[prevIndex])
    }
  }

  const goToNext = () => {
    if (currentIndex < proteins.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      loadProteinForCuration(proteins[nextIndex])
    }
  }

  // Question handlers
  const handleBooleanQuestion = (field: keyof CurationDecision, value: boolean) => {
    setDecision(prev => ({ ...prev, [field]: value }))
  }

  const handleConfidenceChange = (value: number) => {
    setDecision(prev => ({ ...prev, confidence_level: value }))
  }

  const handleNotesChange = (value: string) => {
    setDecision(prev => ({ ...prev, notes: value }))
  }

  // Check if all required questions are answered
  const isDecisionComplete = () => {
    return decision.has_domain !== null &&
           decision.domain_assigned_correctly !== null &&
           decision.boundaries_correct !== null &&
           decision.is_fragment !== null &&
           decision.is_repeat_protein !== null
  }

  // Complete batch and commit
const completeBatch = async (action: 'commit' | 'discard' | 'revisit') => {
  if (!session) {
    console.error('No session available for completion')
    alert('No active session found')
    return
  }

  console.log(`🎯 Attempting to ${action} batch for session ${session.id}`)

  try {
    const requestData = {
      action,
      final_notes: decision.notes || ''
    }

    console.log('Request data:', requestData)

    const response = await fetch(`/api/curation/session/${session.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    })

    console.log('Response status:', response.status)

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Batch completion result:', result)

      // Show detailed success message
      const message = action === 'commit'
        ? `Successfully committed ${result.committed_proteins || 0} protein decisions!`
        : `Batch ${action}ed successfully!`

      alert(message)

      // Reset to start new session
      setSession(null)
      setProteins([])
      setCurrentProtein(null)
      setCurrentIndex(0)
      setAllDecisions([])
      setShowBatchSummary(false)
      setCuratorName('')
      setSelectedBatchId(null)

      console.log('🔄 Session state reset completed')
    } else {
      // Handle non-200 responses
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('❌ Batch completion failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })

      alert(`Failed to ${action} batch: ${errorData.error || response.statusText}`)
    }
  } catch (error) {
    console.error('❌ Error completing batch:', error)
    alert(`Failed to ${action} batch: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
  // Render session startup
  if (!session) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Start Domain Curation Session</h2>
            <p className="text-gray-600">
              Review protein domain predictions and evidence to improve classification algorithms
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Your Name</label>
                <input
                  type="text"
                  value={curatorName}
                  onChange={(e) => setCuratorName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter your name"
                  disabled={isStartingSession}
                />
              </div>

              <BatchSelector
                onBatchSelect={setSelectedBatchId}
                currentBatchId={selectedBatchId}
                showStats={true}
              />

              <Button
                onClick={startCurationSession}
                disabled={!curatorName.trim() || isStartingSession}
                className="w-full"
              >
                {isStartingSession ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Starting Session...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Curation {selectedBatchId ? `(Batch ${selectedBatchId})` : '(Latest Batch)'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Render batch summary
  if (showBatchSummary) {
    const completedCount = allDecisions.filter(d => d !== null).length
    const flaggedCount = allDecisions.filter(d => d?.flagged_for_review).length

    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-6">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Batch Review Complete</h2>
              <p className="text-gray-600">Review your curation decisions before committing</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                <div className="text-sm text-green-700">Proteins Reviewed</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{flaggedCount}</div>
                <div className="text-sm text-yellow-700">Flagged for Review</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{proteins.length}</div>
                <div className="text-sm text-blue-700">Total in Batch</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Decisions Summary:</h3>
              {allDecisions.map((decision, index) => (
                decision && (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="font-mono text-sm">{proteins[index]?.source_id}</span>
                    <div className="flex gap-2">
                      {decision.has_domain && <Badge variant="default">Has Domain</Badge>}
                      {decision.is_fragment && <Badge variant="secondary">Fragment</Badge>}
                      {decision.flagged_for_review && <Badge variant="outline">Flagged</Badge>}
                    </div>
                  </div>
                )
              ))}
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => completeBatch('commit')} className="bg-green-600">
                <Check className="w-4 h-4 mr-2" />
                Commit Batch
              </Button>
              <Button onClick={() => completeBatch('revisit')} variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                Revisit Later
              </Button>
              <Button onClick={() => completeBatch('discard')} variant="outline" className="text-red-600">
                <X className="w-4 h-4 mr-2" />
                Discard Batch
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Main curation interface
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Session Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold">Curation Session</h2>
              <p className="text-sm text-gray-600">
                Curator: {session.curator_name}
                {session.session_metadata?.batch_name && (
                  <span className="ml-2">| Batch: {session.session_metadata.batch_name}</span>
                )}
              </p>
            </div>
            <Badge variant="outline" className="bg-blue-50">
              {currentIndex + 1} of {proteins.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {isAutoSaving && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Save className="w-3 h-3 animate-pulse" />
                Auto-saving...
              </div>
            )}
            <Badge variant={session.status === 'in_progress' ? 'default' : 'secondary'}>
              {session.status}
            </Badge>
          </div>
        </div>
      </Card>

      {isLoadingProtein ? (
        <Card className="p-6">
          <div className="flex items-center justify-center">
            <LoadingSpinner className="mr-2" />
            Loading protein data...
          </div>
        </Card>
      ) : currentProtein ? (
        <>
          {/* Protein Info */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{currentProtein.source_id}</h3>
                <p className="text-sm text-gray-600">
                  Length: {currentProtein.sequence_length} residues |
                  Domains: {currentProtein.domains.length} |
                  Evidence: {currentProtein.evidence.length} items
                  {currentProtein.batch_name && (
                    <span className="ml-2">| Batch: {currentProtein.batch_name}</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowProteinDetails(!showProteinDetails)}
                >
                  <Info className="w-4 h-4 mr-1" />
                  {showProteinDetails ? 'Hide' : 'Show'} Details
                </Button>
                <Button
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                  variant="outline"
                  size="sm"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  onClick={goToNext}
                  disabled={currentIndex === proteins.length - 1}
                  variant="outline"
                  size="sm"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Protein Details */}
            {showProteinDetails && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <strong>Protein Information:</strong>
                    <div className="mt-1 space-y-1">
                      <div>PDB ID: {currentProtein.pdb_id}</div>
                      <div>Chain: {currentProtein.chain_id}</div>
                      <div>Source ID: {currentProtein.source_id}</div>
                      <div>Length: {currentProtein.sequence_length} residues</div>
                    </div>
                  </div>
                  <div>
                    <strong>Batch Information:</strong>
                    <div className="mt-1 space-y-1">
                      <div>Batch ID: {currentProtein.batch_id}</div>
                      <div>Batch Name: {currentProtein.batch_name}</div>
                      <div>Batch Type: {currentProtein.batch_type}</div>
                      <div>Reference: {currentProtein.reference_version}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Structure Viewer */}
          {structureError ? (
            <Card className="p-4 border-red-200 bg-red-50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-red-800">Error Loading Structure</h4>
                  <p className="text-red-700 text-sm mt-1">{structureError}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() => loadProteinForCuration(currentProtein)}
                      size="sm"
                      variant="outline"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Retry Loading
                    </Button>
                    <a
                      href={`https://www.rcsb.org/structure/${currentProtein.pdb_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      Check PDB <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <StructureViewer
              pdb_id={currentProtein.pdb_id}
              chain_id={currentProtein.chain_id}
              domains={currentProtein.domains}
              onDomainClick={(domain) => {
                console.log('Domain clicked for curation context:', domain)
                // You can implement domain-specific curation actions here
              }}
            />
          )}

          {/* Evidence Selection */}
          <Card className="p-4">
            <h4 className="font-medium mb-3">Evidence Selection</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentProtein.evidence.slice(0, 10).map((evidence, index) => {
                const evidenceId = getBestEvidenceId(evidence)
                const isSelected = selectedEvidence && getBestEvidenceId(selectedEvidence) === evidenceId

                return (
                  <button
                    key={evidence.id || index}
                    onClick={() => setSelectedEvidence(evidence)}
                    className={`w-full p-3 text-left rounded border transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono text-sm">{evidenceId || 'Unknown ID'}</div>
                        <div className="text-xs text-gray-600">
                          Query: {evidence.query_range} | Hit: {evidence.hit_range}
                        </div>
                        <div className="text-xs text-gray-500">
                          Type: {evidence.evidence_type}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          Conf: {(evidence.confidence * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-600">
                          E-val: {evidence.evalue < 1e-10 ? evidence.evalue.toExponential(1) : evidence.evalue.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Selected Evidence Details */}
          {selectedEvidence && (
            <Card className="p-4 bg-blue-50">
              <h4 className="font-medium text-blue-800 mb-3">Selected Evidence Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Type:</span>
                  <div>{selectedEvidence.evidence_type}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Source:</span>
                  <div className="font-mono text-xs">{selectedEvidence.source_id}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Confidence:</span>
                  <div>{(selectedEvidence.confidence * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">E-value:</span>
                  <div>{selectedEvidence.evalue < 1e-10 ? selectedEvidence.evalue.toExponential(2) : selectedEvidence.evalue.toFixed(4)}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Query Range:</span>
                  <div>{selectedEvidence.query_range}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Hit Range:</span>
                  <div>{selectedEvidence.hit_range}</div>
                </div>
                {selectedEvidence.ref_t_group && (
                  <div className="col-span-2">
                    <span className="font-medium text-blue-700">Classification:</span>
                    <div className="text-xs">
                      {selectedEvidence.ref_t_group_name || selectedEvidence.ref_t_group}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Curation Questions */}
          <Card className="p-6">
            <h4 className="font-medium mb-4">Curation Questions</h4>
            <div className="space-y-6">
              {/* Question 1 */}
              <div>
                <p className="font-medium mb-2">1. Is there a domain in this structure?</p>
                <div className="flex gap-4">
                  <Button
                    variant={decision.has_domain === true ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('has_domain', true)}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={decision.has_domain === false ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('has_domain', false)}
                  >
                    No
                  </Button>
                </div>
              </div>

              {/* Question 2 */}
              <div>
                <p className="font-medium mb-2">2. Is the domain assigned correctly?</p>
                <div className="flex gap-4">
                  <Button
                    variant={decision.domain_assigned_correctly === true ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('domain_assigned_correctly', true)}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={decision.domain_assigned_correctly === false ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('domain_assigned_correctly', false)}
                  >
                    No
                  </Button>
                </div>
              </div>

              {/* Question 3 */}
              <div>
                <p className="font-medium mb-2">3. Does the domain have correct boundaries?</p>
                <div className="flex gap-4">
                  <Button
                    variant={decision.boundaries_correct === true ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('boundaries_correct', true)}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={decision.boundaries_correct === false ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('boundaries_correct', false)}
                  >
                    No
                  </Button>
                </div>
              </div>

              {/* Question 4 */}
              <div>
                <p className="font-medium mb-2">4. Is this a fragment?</p>
                <div className="flex gap-4">
                  <Button
                    variant={decision.is_fragment === true ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('is_fragment', true)}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={decision.is_fragment === false ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('is_fragment', false)}
                  >
                    No
                  </Button>
                </div>
              </div>

              {/* Question 5 */}
              <div>
                <p className="font-medium mb-2">5. Is this an internal repeat protein (LRR/CTPR/Bprop)?</p>
                <div className="flex gap-4">
                  <Button
                    variant={decision.is_repeat_protein === true ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('is_repeat_protein', true)}
                  >
                    Yes
                  </Button>
                  <Button
                    variant={decision.is_repeat_protein === false ? 'default' : 'outline'}
                    onClick={() => handleBooleanQuestion('is_repeat_protein', false)}
                  >
                    No
                  </Button>
                </div>
              </div>

              {/* Confidence Level */}
              <div>
                <p className="font-medium mb-2">Confidence Level (1-5)</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(level => (
                    <Button
                      key={level}
                      variant={decision.confidence_level === level ? 'default' : 'outline'}
                      onClick={() => handleConfidenceChange(level)}
                      className="w-12"
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-medium mb-2">Notes (optional)</label>
                <textarea
                  value={decision.notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Any additional observations..."
                />
              </div>

              {/* Flag for Review */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="flag-review"
                  checked={decision.flagged_for_review}
                  onChange={(e) => setDecision(prev => ({
                    ...prev,
                    flagged_for_review: e.target.checked
                  }))}
                  className="w-4 h-4"
                />
                <label htmlFor="flag-review" className="text-sm">
                  Flag this protein for detailed review
                </label>
              </div>
            </div>
          </Card>

          {/* Complete Review Button */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {reviewStartTime && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    {Math.round((Date.now() - reviewStartTime.getTime()) / 1000)}s
                  </div>
                )}
              </div>
              
              <Button
                onClick={completeCurrentReview}
                disabled={!isDecisionComplete() || !selectedEvidence}
                className="bg-green-600"
              >
                <Check className="w-4 h-4 mr-2" />
                Complete Review
                {currentIndex === proteins.length - 1 ? ' & Finish Batch' : ''}
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-6">
          <div className="text-center text-gray-600">
            No protein data available
          </div>
        </Card>
      )}
    </div>
  )
}
