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
}

interface CurationDecision {
  has_domain: boolean | null  // API expects has_domain (singular)
  domain_assigned_correctly: boolean | null  // API expects this field name
  boundaries_correct: boolean | null
  is_fragment: boolean | null  // API expects is_fragment (singular)
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

// Batch Selector Component (simplified for this example)
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

  useEffect(() => {
    // Simplified batch fetching - you'd implement the full logic here
    setTimeout(() => {
      setBatches([
        { id: 1, batch_name: "PDB Update 2024-03", batch_type: "pdb_hhsearch",
          total_items: 1000, completed_items: 850, status: "domain_partition_complete",
          ref_version: "develop291", actual_protein_count: 950, partition_count: 920 },
        { id: 2, batch_name: "Alt Rep Analysis", batch_type: "alt_rep",
          total_items: 500, completed_items: 500, status: "completed",
          ref_version: "develop291", actual_protein_count: 480, partition_count: 480 }
      ])
      setLoading(false)
    }, 500)
  }, [])

  if (loading) {
    return <div className="animate-pulse bg-gray-200 h-8 w-48 rounded-md"></div>
  }

  return (
    <select
      value={currentBatchId || ''}
      onChange={(e) => onBatchSelect(e.target.value ? parseInt(e.target.value) : null)}
      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
    >
      <option value="">Auto-Select Latest Batch</option>
      {batches.map(batch => (
        <option key={batch.id} value={batch.id}>
          {batch.batch_name} ({batch.partition_count.toLocaleString()} proteins) [{batch.batch_type}]
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
export default function ImprovedCurationInterface() {
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
    has_domain: null,  // API expects has_domain (singular)
    domain_assigned_correctly: null,  // API expects this field name
    boundaries_correct: null,  // API expects this field name
    is_fragment: null,  // API expects is_fragment (singular)
    is_repeat_protein: null,  // API expects this field name
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
      // Simulate API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mock session data
      const mockSession: CurationSession = {
        id: 1,
        curator_name: curatorName.trim(),
        target_batch_size: batchSize,
        proteins_reviewed: 0,
        current_protein_index: 0,
        status: 'in_progress',
        locked_proteins: [],
        created_at: new Date().toISOString(),
        session_metadata: {
          batch_id: selectedBatchId || 1,
          batch_name: 'PDB Update 2024-03',
          reference_version: 'develop291'
        }
      }

      // Mock proteins data - Create 10 proteins for full batch
      const mockProteins: CurationProtein[] = [
        {
          id: 1, source_id: '3hls_A', pdb_id: '3hls', chain_id: 'A', sequence_length: 284, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'A:1-150', start_pos: 1, end_pos: 150, color: '#2563EB' }],
          evidence: [{ evidence_id: 1, evidence_type: 'hhsearch', ecod_domain_id: 'e3hlsA1', source_id: 'e3hlsA1', hit_range: '1-150', query_range: '1-150', confidence: 0.95, evalue: 1e-20 }]
        },
        {
          id: 2, source_id: '1abc_B', pdb_id: '1abc', chain_id: 'B', sequence_length: 195, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'B:1-195', start_pos: 1, end_pos: 195, color: '#DC2626' }],
          evidence: [{ evidence_id: 2, evidence_type: 'blast', ecod_domain_id: 'e1abcB1', source_id: 'e1abcB1', hit_range: '1-195', query_range: '1-195', confidence: 0.88, evalue: 1e-15 }]
        },
        {
          id: 3, source_id: '2def_C', pdb_id: '2def', chain_id: 'C', sequence_length: 342, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'C:1-180', start_pos: 1, end_pos: 180, color: '#16A34A' }, { id: 'domain_2', pdb_range: 'C:181-342', start_pos: 181, end_pos: 342, color: '#9333EA' }],
          evidence: [{ evidence_id: 3, evidence_type: 'hhsearch', ecod_domain_id: 'e2defC1', source_id: 'e2defC1', hit_range: '1-180', query_range: '1-180', confidence: 0.92, evalue: 1e-18 }]
        },
        {
          id: 4, source_id: '4ghi_D', pdb_id: '4ghi', chain_id: 'D', sequence_length: 156, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'D:1-156', start_pos: 1, end_pos: 156, color: '#EA580C' }],
          evidence: [{ evidence_id: 4, evidence_type: 'blast', ecod_domain_id: 'e4ghiD1', source_id: 'e4ghiD1', hit_range: '1-156', query_range: '1-156', confidence: 0.76, evalue: 1e-8 }]
        },
        {
          id: 5, source_id: '5jkl_E', pdb_id: '5jkl', chain_id: 'E', sequence_length: 428, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'E:1-220', start_pos: 1, end_pos: 220, color: '#0891B2' }, { id: 'domain_2', pdb_range: 'E:221-428', start_pos: 221, end_pos: 428, color: '#DB2777' }],
          evidence: [{ evidence_id: 5, evidence_type: 'hhsearch', ecod_domain_id: 'e5jklE1', source_id: 'e5jklE1', hit_range: '1-220', query_range: '1-220', confidence: 0.97, evalue: 1e-25 }]
        },
        {
          id: 6, source_id: '6mno_F', pdb_id: '6mno', chain_id: 'F', sequence_length: 89, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'F:1-89', start_pos: 1, end_pos: 89, color: '#7C3AED' }],
          evidence: [{ evidence_id: 6, evidence_type: 'blast', ecod_domain_id: 'e6mnoF1', source_id: 'e6mnoF1', hit_range: '1-89', query_range: '1-89', confidence: 0.68, evalue: 1e-5 }]
        },
        {
          id: 7, source_id: '7pqr_G', pdb_id: '7pqr', chain_id: 'G', sequence_length: 267, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'G:1-267', start_pos: 1, end_pos: 267, color: '#059669' }],
          evidence: [{ evidence_id: 7, evidence_type: 'hhsearch', ecod_domain_id: 'e7pqrG1', source_id: 'e7pqrG1', hit_range: '1-267', query_range: '1-267', confidence: 0.89, evalue: 1e-12 }]
        },
        {
          id: 8, source_id: '8stu_H', pdb_id: '8stu', chain_id: 'H', sequence_length: 312, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'H:1-160', start_pos: 1, end_pos: 160, color: '#F59E0B' }, { id: 'domain_2', pdb_range: 'H:161-312', start_pos: 161, end_pos: 312, color: '#10B981' }],
          evidence: [{ evidence_id: 8, evidence_type: 'blast', ecod_domain_id: 'e8stuH1', source_id: 'e8stuH1', hit_range: '1-160', query_range: '1-160', confidence: 0.83, evalue: 1e-10 }]
        },
        {
          id: 9, source_id: '9vwx_I', pdb_id: '9vwx', chain_id: 'I', sequence_length: 203, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'I:1-203', start_pos: 1, end_pos: 203, color: '#EF4444' }],
          evidence: [{ evidence_id: 9, evidence_type: 'hhsearch', ecod_domain_id: 'e9vwxI1', source_id: 'e9vwxI1', hit_range: '1-203', query_range: '1-203', confidence: 0.91, evalue: 1e-16 }]
        },
        {
          id: 10, source_id: '1yz0_J', pdb_id: '1yz0', chain_id: 'J', sequence_length: 378, batch_id: 1,
          domains: [{ id: 'domain_1', pdb_range: 'J:1-190', start_pos: 1, end_pos: 190, color: '#8B5CF6' }, { id: 'domain_2', pdb_range: 'J:191-378', start_pos: 191, end_pos: 378, color: '#06B6D4' }],
          evidence: [{ evidence_id: 10, evidence_type: 'blast', ecod_domain_id: 'e1yz0J1', source_id: 'e1yz0J1', hit_range: '1-190', query_range: '1-190', confidence: 0.79, evalue: 1e-9 }]
        }
      ]

      setSession(mockSession)
      setProteins(mockProteins.slice(0, batchSize))  // Use selected batch size
      setCurrentIndex(0)
      setAllDecisions(new Array(batchSize).fill(null))  // Match batch size

      if (mockProteins.length > 0) {
        await loadProteinForCuration(mockProteins[0])
      }
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Failed to start curation session')
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
      // Simulate loading - replace with actual API calls
      await new Promise(resolve => setTimeout(resolve, 500))

      const processedDomains = processDomainDataCorrectly(protein.domains || [])
      const allEvidence = protein.evidence || []

      const proteinWithData = {
        ...protein,
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
        setSelectedEvidence(sortedEvidence[0])
      }

      // Reset decision for new protein
      setDecision({
        has_domains: null,
        domains_assigned_correctly: null,
        boundaries_correct: null,
        has_fragments: null,
        is_repeat_protein: null,
        confidence_level: 3,
        notes: '',
        flagged_for_review: false
      })

    } catch (error) {
      console.error('Error loading protein:', error)
      setStructureError(error instanceof Error ? error.message : 'Unknown error')
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

    try {
      // Simulate saving decision
      await new Promise(resolve => setTimeout(resolve, 300))

      // Update local state
      const newDecisions = [...allDecisions]
      newDecisions[currentIndex] = decision
      setAllDecisions(newDecisions)

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
      alert('Failed to save curation decision')
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
    return decision.has_domains !== null &&
           decision.domains_assigned_correctly !== null &&
           decision.boundaries_correct !== null &&
           decision.has_fragments !== null &&
           decision.is_repeat_protein !== null
  }

  // Complete batch
  const completeBatch = async (action: 'commit' | 'discard' | 'revisit') => {
    alert(`Batch ${action}ed successfully!`)

    // Reset state
    setSession(null)
    setProteins([])
    setCurrentProtein(null)
    setCurrentIndex(0)
    setAllDecisions([])
    setShowBatchSummary(false)
    setCuratorName('')
    setSelectedBatchId(null)
    setBatchSize(10)  // Reset to default
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
                {/* Question 1 - Updated to be protein-centric */}
                <div>
                  <p className="font-medium mb-2">1. Is there at least one domain in this protein?</p>
                  <p className="text-sm text-gray-600 mb-3">Consider the overall protein structure and domain predictions</p>
                  <div className="flex gap-4">
                    <Button
                      variant={decision.has_domains === true ? 'default' : 'outline'}
                      onClick={() => handleBooleanQuestion('has_domains', true)}
                    >
                      Yes
                    </Button>
                    <Button
                      variant={decision.has_domains === false ? 'default' : 'outline'}
                      onClick={() => handleBooleanQuestion('has_domains', false)}
                    >
                      No
                    </Button>
                  </div>
                </div>

                {/* Question 2 - Updated */}
                <div>
                  <p className="font-medium mb-2">2. Are the domains assigned correctly?</p>
                  <p className="text-sm text-gray-600 mb-3">Do the predicted domains match the structural reality?</p>
                  <div className="flex gap-4">
                    <Button
                      variant={decision.domains_assigned_correctly === true ? 'default' : 'outline'}
                      onClick={() => handleBooleanQuestion('domains_assigned_correctly', true)}
                    >
                      Yes
                    </Button>
                    <Button
                      variant={decision.domains_assigned_correctly === false ? 'default' : 'outline'}
                      onClick={() => handleBooleanQuestion('domains_assigned_correctly', false)}
                    >
                      No
                    </Button>
                  </div>
                </div>

                {/* Question 3 - Updated */}
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

                {/* Question 4 - Updated to be protein-centric */}
                <div>
                  <p className="font-medium mb-2">4. Is there a fragment defined in this protein?</p>
                  <p className="text-sm text-gray-600 mb-3">Is this protein or any of its domains incomplete?</p>
                  <div className="flex gap-4">
                    <Button
                      variant={decision.has_fragments === true ? 'default' : 'outline'}
                      onClick={() => handleBooleanQuestion('has_fragments', true)}
                    >
                      Yes
                    </Button>
                    <Button
                      variant={decision.has_fragments === false ? 'default' : 'outline'}
                      onClick={() => handleBooleanQuestion('has_fragments', false)}
                    >
                      No
                    </Button>
                  </div>
                </div>

                {/* Question 5 - Updated */}
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
