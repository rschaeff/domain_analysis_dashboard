import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  Info,
  ChevronUp,
  ChevronDown
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
  domain_count?: number
  total_evidence_items?: number
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
  probability?: number
  score?: number
  ref_t_group?: string
  ref_t_group_name?: string
  ref_h_group?: string
  ref_h_group_name?: string
  ref_x_group?: string
  ref_x_group_name?: string
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

// Simplified Batch Selector Component for curation interface
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
    const fetchBatches = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/batches')

        if (!response.ok) {
          throw new Error(`Failed to fetch batches: ${response.status}`)
        }

        const data = await response.json()

        // Transform and filter for curation-ready batches
        const transformedBatches: Batch[] = (data.batches || [])
          .filter((batch: any) => {
            // Only show batches with partition data ready for curation
            return batch.partition_count > 0 &&
                   ['pdb_hhsearch', 'domain_analysis'].includes(batch.batch_type) &&
                   ['completed', 'domain_partition_complete', 'domain_partition_complete_with_errors'].includes(batch.status)
          })
          .map((batch: any) => ({
            id: batch.id,
            batch_name: batch.batch_name,
            batch_type: batch.batch_type,
            total_items: batch.total_items,
            completed_items: batch.completed_items,
            status: batch.status,
            ref_version: batch.ref_version,
            actual_protein_count: batch.actual_protein_count,
            partition_count: batch.partition_count
          }))
          .sort((a, b) => b.id - a.id) // Latest first

        setBatches(transformedBatches)
        setError(null)
      } catch (err) {
        console.error('Error fetching batches:', err)
        setError(err instanceof Error ? err.message : 'Failed to load batches')
        setBatches([])
      } finally {
        setLoading(false)
      }
    }

    fetchBatches()
  }, [])

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-8 w-full rounded-md"></div>
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm p-2 bg-red-50 rounded-md">
        Error: {error}
      </div>
    )
  }

  return (
    <select
      value={currentBatchId || ''}
      onChange={(e) => onBatchSelect(e.target.value ? parseInt(e.target.value) : null)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="">Auto-Select Latest Batch</option>
      {batches.map(batch => (
        <option key={batch.id} value={batch.id}>
          {batch.batch_name} ({batch.partition_count.toLocaleString()} proteins)
        </option>
      ))}
    </select>
  )
}

// Utility functions
const getBestEvidenceId = (evidence: any): string | null => {
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
    return { ranges: [], displayRange: 'undefined', start: null, end: null }
  }

  try {
    let cleanRange = pdbRange
    if (pdbRange.includes(':')) {
      cleanRange = pdbRange.split(':')[1] || pdbRange
    }

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
    let parsedRange = parsePdbRange(domain.pdb_range)

    if (parsedRange.ranges.length === 0 && domain.range) {
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
      domain_type: 'putative'
    }
  })
}

// Main Component
export default function MainCurationInterface() {
  // Refs for scroll management
  const mainContentRef = useRef<HTMLDivElement>(null)
  const evidenceRef = useRef<HTMLDivElement>(null)

  // Session Management
  const [session, setSession] = useState<CurationSession | null>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [curatorName, setCuratorName] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
  const [batchSize, setBatchSize] = useState(10)

  // Current Protein & Curation State
  const [currentProtein, setCurrentProtein] = useState<CurationProtein | null>(null)
  const [proteins, setProteins] = useState<CurationProtein[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoadingProtein, setIsLoadingProtein] = useState(false)

  // Curation Decision State - Updated to match API expectations
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
  const [evidenceExpanded, setEvidenceExpanded] = useState(true)

  // Scroll to main content area
  const scrollToMainContent = () => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }
  }

  // Start new curation session
  const startCurationSession = async () => {
    if (!curatorName.trim()) {
      alert('Please enter your name to start curation')
      return
    }

    setIsStartingSession(true)
    try {
      // Call the real curation session start API
      const response = await fetch('/api/curation/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          curator_name: curatorName.trim(),
          batch_size: batchSize,
          batch_id: selectedBatchId || undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      // Create session object from API response
      const apiSession: CurationSession = {
        id: data.session.id,
        curator_name: data.session.curator_name,
        target_batch_size: data.session.target_batch_size,
        proteins_reviewed: 0,
        current_protein_index: 0,
        status: 'in_progress',
        locked_proteins: data.session.locked_proteins || [],
        created_at: data.session.created_at,
        session_metadata: data.batch_summary ? {
          batch_id: data.batch_summary.batch_id,
          batch_name: data.batch_summary.batch_name,
          reference_version: 'develop291'
        } : undefined
      }

      // Transform API proteins to CurationProtein format
      const apiProteins: CurationProtein[] = data.proteins.map((protein: any, index: number) => ({
        id: protein.id,
        source_id: protein.source_id,
        pdb_id: protein.pdb_id,
        chain_id: protein.chain_id,
        sequence_length: protein.sequence_length,
        batch_id: data.batch_summary?.batch_id,
        batch_info: data.batch_summary,
        domains: [], // Will be loaded when protein is selected
        evidence: [] // Will be loaded when protein is selected
      }))

      setSession(apiSession)
      setProteins(apiProteins)
      setCurrentIndex(0)
      setAllDecisions(new Array(apiProteins.length).fill(null))

      // Load the first protein for curation
      if (apiProteins.length > 0) {
        await loadProteinForCuration(apiProteins[0])
      }

    } catch (error) {
      console.error('Error starting session:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to start curation session: ${errorMessage}`)
    } finally {
      setIsStartingSession(false)
    }
  }

  // Load protein data for curation
  const loadProteinForCuration = async (protein: any) => {
    setIsLoadingProtein(true)
    setStructuresLoaded(false)
    setStructureError(null)
    setReviewStartTime(new Date())

    try {
      // Fetch detailed protein data with domains and evidence
      const response = await fetch(`/api/proteins/${protein.source_id}/domains`)

      if (!response.ok) {
        throw new Error(`Failed to load protein data: ${response.status}`)
      }

      const data = await response.json()

      // Process domains from the API response
      const processedDomains = processDomainDataCorrectly(data.domains || [])

      // Extract evidence from domains
      const allEvidence = data.domains?.flatMap((domain: any) =>
        (domain.evidence || []).map((evidence: any) => ({
          evidence_id: evidence.id || Math.random(),
          evidence_type: evidence.evidence_type,
          ecod_domain_id: evidence.source_id,
          source_id: evidence.source_id,
          hit_range: evidence.hit_range,
          query_range: evidence.query_range,
          confidence: evidence.confidence || 0,
          evalue: evidence.evalue || 0,
          probability: evidence.probability,
          score: evidence.score,
          ref_t_group: evidence.ref_t_group,
          ref_t_group_name: evidence.ref_t_group_name,
          ref_h_group: evidence.ref_h_group,
          ref_h_group_name: evidence.ref_h_group_name,
          ref_x_group: evidence.ref_x_group,
          ref_x_group_name: evidence.ref_x_group_name
        }))
      ) || []

      const proteinWithData = {
        ...protein,
        ...data.protein, // Merge any additional protein metadata
        domains: processedDomains,
        evidence: allEvidence,
        domain_count: processedDomains.length,
        total_evidence_items: allEvidence.length
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
        setSelectedEvidence(sortedEvidence[0])
      } else {
        setSelectedEvidence(null)
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
      console.error('Error loading protein:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setStructureError(errorMessage)

      // Set fallback protein data if API fails
      setCurrentProtein({
        ...protein,
        domains: [],
        evidence: [],
        domain_count: 0,
        total_evidence_items: 0
      })
      setSelectedEvidence(null)
    } finally {
      setIsLoadingProtein(false)
    }
  }

  // Complete current protein review
  const completeCurrentReview = async () => {
    if (!currentProtein || !selectedEvidence) {
      alert('Please select evidence and complete all questions')
      return
    }

    if (!session) {
      alert('No active curation session')
      return
    }

    try {
      const reviewTimeSeconds = reviewStartTime
        ? Math.round((Date.now() - reviewStartTime.getTime()) / 1000)
        : 0

      // Save decision via API
      const response = await fetch('/api/curation/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: session.id,
          protein_source_id: currentProtein.source_id,
          decisions: decision,
          evidence_used: {
            primary_evidence_type: selectedEvidence.evidence_type,
            primary_evidence_source_id: selectedEvidence.source_id,
            reference_domain_id: selectedEvidence.ecod_domain_id,
            evidence_confidence: selectedEvidence.confidence,
            evidence_evalue: selectedEvidence.evalue
          },
          review_time_seconds: reviewTimeSeconds
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // Update local state
      const newDecisions = [...allDecisions]
      newDecisions[currentIndex] = decision
      setAllDecisions(newDecisions)

      // Auto-save session progress
      if (session) {
        try {
          await fetch(`/api/curation/session/${session.id}/auto-save`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              current_protein_index: currentIndex + 1,
              decisions: newDecisions,
              notes: decision.notes
            })
          })
        } catch (autoSaveError) {
          console.warn('Auto-save failed:', autoSaveError)
          // Don't block the main flow for auto-save failures
        }
      }

      // Move to next protein or show summary
      if (currentIndex < proteins.length - 1) {
        const nextIndex = currentIndex + 1
        setCurrentIndex(nextIndex)
        await loadProteinForCuration(proteins[nextIndex])

        // Scroll back to main content after loading next protein
        setTimeout(scrollToMainContent, 100)
      } else {
        setShowBatchSummary(true)
      }

    } catch (error) {
      console.error('Error saving decision:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to save curation decision: ${errorMessage}`)
    }
  }

  // Navigation functions
  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      loadProteinForCuration(proteins[prevIndex])
      setTimeout(scrollToMainContent, 100)
    }
  }

  const goToNext = () => {
    if (currentIndex < proteins.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      loadProteinForCuration(proteins[nextIndex])
      setTimeout(scrollToMainContent, 100)
    }
  }

  // Question handlers
  const handleBooleanQuestion = (field: keyof CurationDecision, value: boolean) => {
    setDecision(prev => ({ ...prev, [field]: value }))
  }

  // Check if all required questions are answered
  const isDecisionComplete = () => {
    return decision.has_domain !== null &&
           decision.domain_assigned_correctly !== null &&
           decision.boundaries_correct !== null &&
           decision.is_fragment !== null &&
           decision.is_repeat_protein !== null
  }

  // Complete batch
  const completeBatch = async (action: 'commit' | 'discard' | 'revisit') => {
    if (!session) {
      alert('No active session to complete')
      return
    }

    try {
      const response = await fetch(`/api/curation/session/${session.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          final_notes: `Batch ${action}ed from curation interface`
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      // Show success message with statistics
      if (action === 'commit') {
        alert(`Batch committed successfully!\n\nStatistics:\n- ${result.statistics.total_decisions} decisions saved\n- ${result.statistics.has_domain_count} proteins with domains\n- ${result.statistics.flagged_count} flagged for review\n- Average confidence: ${result.statistics.avg_confidence}/5`)
      } else {
        alert(`Batch ${action}ed successfully!`)
      }

      // Reset state
      setSession(null)
      setProteins([])
      setCurrentProtein(null)
      setCurrentIndex(0)
      setAllDecisions([])
      setShowBatchSummary(false)
      setCuratorName('')
      setSelectedBatchId(null)
      setBatchSize(10)
      setSelectedEvidence(null)
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
      console.error('Error completing batch:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to ${action} batch: ${errorMessage}`)
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

              <div>
                <label className="block text-sm font-medium mb-2">Batch Selection</label>
                <BatchSelector
                  onBatchSelect={setSelectedBatchId}
                  currentBatchId={selectedBatchId}
                  showStats={true}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Batch Size</label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={isStartingSession}
                >
                  <option value={5}>5 proteins (Quick session)</option>
                  <option value={10}>10 proteins (Standard)</option>
                  <option value={15}>15 proteins (Extended)</option>
                  <option value={20}>20 proteins (Long session)</option>
                </select>
              </div>

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
                    Start Curation ({batchSize} proteins)
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

  // Main curation interface with improved layout
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

            {showProteinDetails && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <strong>Protein Information:</strong>
                    <div className="mt-1 space-y-1">
                      <div>PDB ID: {currentProtein.pdb_id}</div>
                      <div>Chain: {currentProtein.chain_id}</div>
                      <div>Length: {currentProtein.sequence_length} residues</div>
                    </div>
                  </div>
                  <div>
                    <strong>Batch Information:</strong>
                    <div className="mt-1 space-y-1">
                      <div>Batch ID: {currentProtein.batch_id}</div>
                      <div>Reference: {session.session_metadata?.reference_version}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Main Content - Two Column Layout */}
          <div ref={mainContentRef} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left Column: Structure Viewer */}
            <div className="space-y-4">
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
                    console.log('Domain clicked:', domain)
                  }}
                />
              )}
            </div>

            {/* Right Column: Curation Questions */}
            <Card className="p-6">
              <h4 className="font-medium mb-4">Protein Assessment Questions</h4>
              <div className="space-y-6">
                {/* Question 1 */}
                <div>
                  <p className="font-medium mb-2">1. Is there at least one domain in this protein?</p>
                  <p className="text-sm text-gray-600 mb-3">Consider the overall protein structure and domain predictions</p>
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
                  <p className="font-medium mb-2">2. Are the domains assigned correctly?</p>
                  <p className="text-sm text-gray-600 mb-3">Do the predicted domains match the structural reality?</p>
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
                  <p className="font-medium mb-2">3. Do the domains have correct boundaries?</p>
                  <p className="text-sm text-gray-600 mb-3">Are the start and end positions accurate?</p>
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
                  <p className="font-medium mb-2">4. Is there a fragment defined in this protein?</p>
                  <p className="text-sm text-gray-600 mb-3">Is this protein or any of its domains incomplete?</p>
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
                  <p className="font-medium mb-2">5. Is this protein an internal repeat protein?</p>
                  <p className="text-sm text-gray-600 mb-3">LRR/CTPR/Bprop or similar repetitive structures</p>
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
                  <p className="text-sm text-gray-600 mb-3">How confident are you in your assessment?</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(level => (
                      <Button
                        key={level}
                        variant={decision.confidence_level === level ? 'default' : 'outline'}
                        onClick={() => setDecision(prev => ({ ...prev, confidence_level: level }))}
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
                    onChange={(e) => setDecision(prev => ({ ...prev, notes: e.target.value }))}
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

                {/* Complete Review Button */}
                <div className="pt-4 border-t">
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
                      {currentIndex === proteins.length - 1 ? ' & Finish' : ''}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Evidence Section - Full Width Below */}
          <div ref={evidenceRef} className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Evidence Selection</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                >
                  {evidenceExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {evidenceExpanded && (
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
              )}
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
                </div>
              </Card>
            )}
          </div>
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
