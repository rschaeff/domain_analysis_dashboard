import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { DualStructureViewer } from '@/components/curation/DualStructureViewer'
import { SingleStructureTest } from '@/components/curation/SingleStructureTest'
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
  FileText
} from 'lucide-react'

interface CurationSession {
  id: number
  curator_name: string
  target_batch_size: number
  proteins_reviewed: number
  current_protein_index: number
  status: string
  locked_proteins: string[]
  created_at: string
}

interface CurationProtein {
  id: number
  source_id: string
  pdb_id: string
  chain_id: string
  sequence_length: number
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

// Utility function to safely parse ECOD domain ID
const parseEcodDomainId = (ecodDomainId: string | null | undefined): { pdbId: string | null, chainId: string | null } => {
  if (!ecodDomainId || typeof ecodDomainId !== 'string' || ecodDomainId.length < 6) {
    console.warn('Invalid ECOD domain ID:', ecodDomainId)
    return { pdbId: null, chainId: null }
  }

  try {
    // ECOD domain IDs typically follow the pattern: e1a0oA1
    // Where positions 1-4 are PDB ID and position 5 is chain ID
    const pdbId = ecodDomainId.substring(1, 5).toLowerCase()
    const chainId = ecodDomainId.charAt(5).toUpperCase()

    // Basic validation
    if (pdbId.length !== 4 || !chainId) {
      console.warn('Failed to parse ECOD domain ID:', ecodDomainId)
      return { pdbId: null, chainId: null }
    }

    return { pdbId, chainId }
  } catch (error) {
    console.error('Error parsing ECOD domain ID:', ecodDomainId, error)
    return { pdbId: null, chainId: null }
  }
}

// Utility function to get the best identifier from evidence
const getBestEvidenceId = (evidence: any): string | null => {
  // Try different possible field names for the reference ID
  return evidence.ecod_domain_id ||
         evidence.source_id ||
         evidence.domain_ref_id ||
         evidence.hit_id ||
         null
}

export default function MainCurationInterface() {
  // Session Management
  const [session, setSession] = useState<CurationSession | null>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [curatorName, setCuratorName] = useState('')

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
          batch_size: 10
        })
      })

      if (response.ok) {
        const data = await response.json()
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
        alert(`Failed to start session: ${error.error}`)
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
      // Get protein details with domains
      const domainsResponse = await fetch(`/api/proteins/${protein.source_id}/domains`)
      if (!domainsResponse.ok) {
        throw new Error('Failed to load protein domains')
      }
      const domainsData = await domainsResponse.json()

      // Get evidence for the protein
      const evidencePromises = domainsData.domains.map(async (domain: any) => {
        const evidenceResponse = await fetch(`/api/domains/${domain.id}/evidence`)
        if (evidenceResponse.ok) {
          const evidence = await evidenceResponse.json()
          return evidence.filter((e: any) =>
            getBestEvidenceId(e) && e.hit_range && e.confidence > 0.8
          )
        }
        return []
      })

      const evidenceArrays = await Promise.all(evidencePromises)
      const allEvidence = evidenceArrays.flat()

      console.log('Evidence loaded:', allEvidence.length, 'items')
      console.log('Sample evidence:', allEvidence[0])

      const proteinWithData = {
        ...protein,
        domains: domainsData.domains,
        evidence: allEvidence
      }

      setCurrentProtein(proteinWithData)

      // Auto-select best evidence for structure comparison
      if (allEvidence.length > 0) {
        const bestEvidence = allEvidence.reduce((best: any, current: any) =>
          current.confidence > best.confidence ? current : best
        )

        // Validate the selected evidence
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
          setSelectedEvidence(allEvidence[0]) // Fallback to first evidence
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
      console.error('Error loading protein:', error)
      setStructureError(`Failed to load protein data: ${error.message}`)
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
    if (!session) return

    try {
      const response = await fetch(`/api/curation/session/${session.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          final_notes: decision.notes
        })
      })

      if (response.ok) {
        alert(`Batch ${action}ed successfully!`)
        // Reset to start new session
        setSession(null)
        setProteins([])
        setCurrentProtein(null)
        setCurrentIndex(0)
        setAllDecisions([])
        setShowBatchSummary(false)
      }
    } catch (error) {
      console.error('Error completing batch:', error)
      alert('Failed to complete batch')
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
                    Start Curation (10 proteins)
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
              <p className="text-sm text-gray-600">Curator: {session.curator_name}</p>
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
          </Card>

          {/* Structure Comparison */}
            <SingleStructureTest
              pdbId={currentProtein.pdb_id}
              chainId={currentProtein.chain_id}
              domains={currentProtein.domains}
            />

          {/* Evidence Selection */}
          <Card className="p-4">
            <h4 className="font-medium mb-3">Evidence Selection</h4>
            <div className="space-y-2">
              {currentProtein.evidence.slice(0, 5).map((evidence, index) => {
                const evidenceId = getBestEvidenceId(evidence)
                const isSelected = selectedEvidence && getBestEvidenceId(selectedEvidence) === evidenceId

                return (
                  <button
                    key={evidence.id || index}
                    onClick={() => setSelectedEvidence(evidence)}
                    className={`w-full p-3 text-left rounded border ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
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
                          E-val: {evidence.evalue}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

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
