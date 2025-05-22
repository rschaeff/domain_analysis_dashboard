// EvidenceTraceability.tsx - Shows which evidence contributed to each domain

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CheckCircle, XCircle, ArrowRight, Eye, AlertTriangle } from 'lucide-react'

interface EvidenceTraceabilityProps {
  pipelineDomains: any[]
  hitValidations: any[] // From hit-level validation
  coverageAnalysis: any[] // From domain summary parser
  sequenceLength: number
}

interface EvidenceContribution {
  evidence: any
  contribution_type: 'primary' | 'supporting' | 'boundary_adjustment' | 'unused' | 'conflicting'
  overlap_ratio: number
  boundary_influence: {
    start_influence: number // How much this evidence influenced the start boundary
    end_influence: number   // How much this evidence influenced the end boundary
  }
  confidence_contribution: number
  notes: string[]
}

interface DomainEvidence {
  domain: any
  contributing_evidence: EvidenceContribution[]
  confidence_breakdown: {
    evidence_count: number
    avg_significance: number
    boundary_confidence: number
    classification_confidence: number
  }
  decision_rationale: string[]
  potential_issues: string[]
}

export function EvidenceTraceability({
  pipelineDomains,
  hitValidations,
  coverageAnalysis,
  sequenceLength
}: EvidenceTraceabilityProps) {
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null)
  const [showUnusedEvidence, setShowUnusedEvidence] = useState(false)

  // Analyze how evidence contributed to each domain
  const analyzeDomainEvidence = (domain: any): DomainEvidence => {
    const domainStart = domain.start_pos || domain.start
    const domainEnd = domain.end_pos || domain.end
    const domainLength = domainEnd - domainStart + 1

    const contributions: EvidenceContribution[] = []
    let totalSignificance = 0
    let evidenceCount = 0

    // Analyze each piece of evidence
    hitValidations.forEach(validation => {
      const hit = validation.hit
      const overlapStart = Math.max(hit.query_start, domainStart)
      const overlapEnd = Math.min(hit.query_end, domainEnd)
      
      let contributionType: EvidenceContribution['contribution_type'] = 'unused'
      let overlapRatio = 0
      let confidenceContribution = 0
      const notes: string[] = []

      if (overlapStart <= overlapEnd) {
        const overlapLength = overlapEnd - overlapStart + 1
        overlapRatio = overlapLength / domainLength

        if (overlapRatio > 0.7) {
          contributionType = 'primary'
          confidenceContribution = 0.8
          notes.push('Primary evidence - high overlap with domain')
          evidenceCount++
          totalSignificance += hit.evalue ? -Math.log10(hit.evalue) : (hit.probability || 50) / 100
        } else if (overlapRatio > 0.3) {
          contributionType = 'supporting'
          confidenceContribution = 0.5
          notes.push('Supporting evidence - moderate overlap')
          evidenceCount++
          totalSignificance += (hit.evalue ? -Math.log10(hit.evalue) : (hit.probability || 50) / 100) * 0.5
        } else if (overlapRatio > 0.1) {
          contributionType = 'boundary_adjustment'
          confidenceContribution = 0.2
          notes.push('May have influenced boundary placement')
        }

        // Check for boundary influence
        const startDistance = Math.abs(hit.query_start - domainStart)
        const endDistance = Math.abs(hit.query_end - domainEnd)
        
        if (startDistance <= 5) {
          notes.push(`Likely influenced start boundary (±${startDistance} residues)`)
        }
        if (endDistance <= 5) {
          notes.push(`Likely influenced end boundary (±${endDistance} residues)`)
        }

      } else {
        // Check if evidence conflicts with domain boundaries
        if (hit.query_end < domainStart - 10 || hit.query_start > domainEnd + 10) {
          contributionType = 'unused'
          notes.push('No overlap - not used for this domain')
        } else {
          contributionType = 'conflicting'
          notes.push('Close to domain but not overlapping - potential boundary conflict')
        }
      }

      // Check classification match
      if (domain.source === hit.type) {
        notes.push(`Classification source match (${hit.type})`)
        confidenceContribution += 0.1
      }

      contributions.push({
        evidence: validation,
        contribution_type: contributionType,
        overlap_ratio: overlapRatio,
        boundary_influence: {
          start_influence: Math.max(0, 1 - Math.abs(hit.query_start - domainStart) / 10),
          end_influence: Math.max(0, 1 - Math.abs(hit.query_end - domainEnd) / 10)
        },
        confidence_contribution: confidenceContribution,
        notes
      })
    })

    // Generate decision rationale
    const decisionRationale: string[] = []
    const primaryEvidence = contributions.filter(c => c.contribution_type === 'primary')
    const supportingEvidence = contributions.filter(c => c.contribution_type === 'supporting')
    
    if (primaryEvidence.length > 0) {
      decisionRationale.push(`Domain boundaries primarily based on ${primaryEvidence.length} high-overlap evidence hit(s)`)
    }
    if (supportingEvidence.length > 0) {
      decisionRationale.push(`Supported by ${supportingEvidence.length} additional evidence hit(s)`)
    }
    
    decisionRationale.push(`Classification (${domain.t_group}) derived from ${domain.source} evidence`)
    decisionRationale.push(`Final confidence: ${((domain.confidence || 0) * 100).toFixed(0)}%`)

    // Identify potential issues
    const potentialIssues: string[] = []
    const conflictingEvidence = contributions.filter(c => c.contribution_type === 'conflicting')
    const unusedStrong = contributions.filter(c => 
      c.contribution_type === 'unused' && 
      c.evidence.validation_results?.is_usable_for_boundaries
    )

    if (conflictingEvidence.length > 0) {
      potentialIssues.push(`${conflictingEvidence.length} evidence hit(s) near domain but not used - potential boundary issues`)
    }
    if (unusedStrong.length > 0) {
      potentialIssues.push(`${unusedStrong.length} high-quality evidence hit(s) not incorporated`)
    }
    if (primaryEvidence.length === 0) {
      potentialIssues.push('No primary evidence - domain based on weak/supporting evidence only')
    }
    if (domainLength < 30) {
      potentialIssues.push('Very short domain - may be a fragment')
    }

    return {
      domain,
      contributing_evidence: contributions,
      confidence_breakdown: {
        evidence_count: evidenceCount,
        avg_significance: evidenceCount > 0 ? totalSignificance / evidenceCount : 0,
        boundary_confidence: Math.min(1, evidenceCount / 2), // Confidence based on evidence count
        classification_confidence: domain.confidence || 0
      },
      decision_rationale: decisionRationale,
      potential_issues: potentialIssues
    }
  }

  // Analyze all domains
  const domainEvidenceAnalyses = pipelineDomains.map(analyzeDomainEvidence)

  // Get unused evidence
  const allUsedEvidence = new Set()
  domainEvidenceAnalyses.forEach(analysis => {
    analysis.contributing_evidence.forEach(contrib => {
      if (contrib.contribution_type !== 'unused') {
        allUsedEvidence.add(contrib.evidence.hit.query_range)
      }
    })
  })

  const unusedEvidence = hitValidations.filter(v => 
    !allUsedEvidence.has(v.hit.query_range) && v.validation_results.is_usable_for_boundaries
  )

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Evidence Traceability</h3>
          <div className="flex items-center gap-2 text-sm">
            <span>Total Evidence Used: {hitValidations.length - unusedEvidence.length}/{hitValidations.length}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUnusedEvidence(!showUnusedEvidence)}
            >
              {showUnusedEvidence ? 'Hide' : 'Show'} Unused Evidence
            </Button>
          </div>
        </div>

        {/* Domain Evidence Breakdown */}
        <div className="space-y-4">
          {domainEvidenceAnalyses.map((analysis, domainIndex) => (
            <div key={domainIndex} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium">
                    Domain {analysis.domain.domain_number || (domainIndex + 1)}
                  </h4>
                  <Badge variant="outline" className="font-mono">
                    {analysis.domain.start_pos || analysis.domain.start}-{analysis.domain.end_pos || analysis.domain.end}
                  </Badge>
                  <Badge variant="secondary">
                    {analysis.contributing_evidence.filter(c => c.contribution_type !== 'unused').length} evidence hits used
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDomain(selectedDomain === domainIndex ? null : domainIndex)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {selectedDomain === domainIndex ? 'Hide' : 'Show'} Details
                </Button>
              </div>

              {/* Evidence Summary */}
              <div className="grid grid-cols-4 gap-4 mb-3 text-sm">
                <div className="text-center p-2 bg-blue-50 rounded">
                  <div className="font-bold text-blue-600">
                    {analysis.contributing_evidence.filter(c => c.contribution_type === 'primary').length}
                  </div>
                  <div className="text-blue-700">Primary</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="font-bold text-green-600">
                    {analysis.contributing_evidence.filter(c => c.contribution_type === 'supporting').length}
                  </div>
                  <div className="text-green-700">Supporting</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="font-bold text-yellow-600">
                    {analysis.contributing_evidence.filter(c => c.contribution_type === 'boundary_adjustment').length}
                  </div>
                  <div className="text-yellow-700">Boundary</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="font-bold text-red-600">
                    {analysis.contributing_evidence.filter(c => c.contribution_type === 'conflicting').length}
                  </div>
                  <div className="text-red-700">Conflicting</div>
                </div>
              </div>

              {/* Issues */}
              {analysis.potential_issues.length > 0 && (
                <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded">
                  <div className="flex items-center gap-2 text-orange-800 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Potential Issues:</span>
                  </div>
                  <ul className="mt-1 text-sm text-orange-700 list-disc list-inside">
                    {analysis.potential_issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detailed Evidence Breakdown */}
              {selectedDomain === domainIndex && (
                <div className="mt-4 border-t pt-4">
                  <h5 className="font-medium mb-3">Evidence Contributions</h5>
                  
                  <div className="space-y-2">
                    {analysis.contributing_evidence
                      .filter(c => c.contribution_type !== 'unused')
                      .sort((a, b) => b.confidence_contribution - a.confidence_contribution)
                      .map((contrib, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded text-sm">
                          <Badge variant={
                            contrib.contribution_type === 'primary' ? 'default' :
                            contrib.contribution_type === 'supporting' ? 'secondary' :
                            contrib.contribution_type === 'boundary_adjustment' ? 'outline' : 'destructive'
                          }>
                            {contrib.contribution_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          
                          <div className="flex-1">
                            <div className="font-medium">
                              {contrib.evidence.hit.type === 'hhsearch' ? 
                                contrib.evidence.hit.hit_id :
                                contrib.evidence.hit.domain_id || `${contrib.evidence.hit.pdb_id}_${contrib.evidence.hit.chain_id}`
                              }
                            </div>
                            <div className="text-gray-600 font-mono">
                              {contrib.evidence.hit.query_range} • {contrib.evidence.hit.alignment_length} res • {(contrib.overlap_ratio * 100).toFixed(0)}% overlap
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="font-medium">
                              {(contrib.confidence_contribution * 100).toFixed(0)}% contrib
                            </div>
                            {contrib.evidence.hit.type === 'hhsearch' ? (
                              <div className="text-xs text-gray-500">
                                P: {contrib.evidence.hit.probability.toFixed(0)}%
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">
                                E: {contrib.evidence.hit.evalue.toExponential(1)}
                              </div>
                            )}
                          </div>
                          
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                    ))}
                  </div>

                  {/* Decision Rationale */}
                  <div className="mt-4 p-3 bg-blue-50 rounded">
                    <h6 className="font-medium text-blue-800 mb-2">Decision Rationale</h6>
                    <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                      {analysis.decision_rationale.map((rationale, i) => (
                        <li key={i}>{rationale}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Unused Evidence */}
        {showUnusedEvidence && unusedEvidence.length > 0 && (
          <div className="mt-6 border-t pt-6">
            <h4 className="font-medium mb-3 text-gray-700">Unused High-Quality Evidence</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {unusedEvidence.map((validation, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">
                        {validation.hit.type === 'hhsearch' ? 
                          validation.hit.hit_id :
                          validation.hit.domain_id || `${validation.hit.pdb_id}_${validation.hit.chain_id}`
                        }
                      </div>
                      <div className="text-xs text-gray-600 font-mono">
                        {validation.hit.query_range} • {validation.hit.alignment_length} res
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      UNUSED
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    Why unused: No significant overlap with any predicted domain
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
