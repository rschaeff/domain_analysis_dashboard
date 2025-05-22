// Complete reorganized HitLevelEvidenceValidator.tsx

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import {
  AlertTriangle, CheckCircle, XCircle, Eye, FileText, Activity,
  Search, ArrowRight, AlertCircle, Info
} from 'lucide-react'
import { DomainSummaryParser } from '@/components/analysis/DomainSummaryParser'
import { StructureViewer } from '@/components/visualization/StructureViewer'

interface EvidenceContribution {
  evidence: any
  contribution_type: 'primary' | 'supporting' | 'boundary_adjustment' | 'unused' | 'conflicting'
  overlap_ratio: number
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

interface HitLevelEvidenceValidatorProps {
  proteinId: string
  pipelineDomains: any[]
  sequenceLength: number
  sequence?: string
}

export function HitLevelEvidenceValidator({
  proteinId,
  pipelineDomains,
  sequenceLength,
  sequence
}: HitLevelEvidenceValidatorProps) {
  // Core state
  const [filesystemEvidence, setFilesystemEvidence] = useState<any>(null)
  const [summaryData, setSummaryData] = useState<any>(null)
  const [hitValidations, setHitValidations] = useState<any[]>([])
  const [coverageAnalysis, setCoverageAnalysis] = useState<any[]>([])

  // UI state
  const [selectedHit, setSelectedHit] = useState<number | null>(null)
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence_analysis' | 'traceability'>('overview')

  // Fetch filesystem evidence
  useEffect(() => {
    const fetchFilesystemEvidence = async () => {
      try {
        const response = await fetch(`/api/proteins/${proteinId}/filesystem`)
        if (response.ok) {
          const data = await response.json()
          setFilesystemEvidence(data)
        }
      } catch (err) {
        console.error('Error fetching filesystem evidence:', err)
      }
    }
    fetchFilesystemEvidence()
  }, [proteinId])

  // Handle analysis completion from DomainSummaryParser
  const handleAnalysisComplete = (analysis: any[], summary: any) => {
    setSummaryData(summary)
    setCoverageAnalysis(analysis)

    try {
      // Convert coverage analysis to hit validations format and add usage tracking
      const validations = analysis.map(coverageItem => {
        const validation = {
          hit: coverageItem.hit,
          evidence_type: coverageItem.hit.type,
          validation_results: {
            sequence_indexing: 'valid',
            query_coverage: coverageItem.hit.query_coverage,
            reference_coverage: coverageItem.hit.hit_coverage,
            coverage_quality: coverageItem.coverage_quality,
            is_usable_for_boundaries: !coverageItem.is_fragment && coverageItem.coverage_quality !== 'poor'
          },
          issues: coverageItem.issues.map((issue: string) => ({
            type: 'coverage',
            severity: 'warning',
            message: issue,
            suggestion: 'Review evidence quality'
          })),
          boundary_impact: {
            would_create_fragment: coverageItem.is_fragment,
            boundary_quality: coverageItem.coverage_quality === 'fragment' ? 'poor' :
                             coverageItem.coverage_quality === 'poor' ? 'questionable' : 'reliable',
            recommended_action: coverageItem.recommendations[0] || 'Use for boundary determination'
          }
        }

        // Determine if this hit was used by the pipeline
        validation.contributes_to_pipeline_domains = checkIfHitWasUsed(validation.hit, pipelineDomains)

        return validation
      })

      setHitValidations(validations)
    } catch (err) {
      console.error('Error processing validations:', err)
    }
  }

  // Check if a hit was used by the pipeline (overlap with any domain)
  const checkIfHitWasUsed = (hit: any, domains: any[]): boolean => {
    return domains.some(domain => {
      const domainStart = domain.start_pos || domain.start
      const domainEnd = domain.end_pos || domain.end
      const overlapStart = Math.max(hit.query_start, domainStart)
      const overlapEnd = Math.min(hit.query_end, domainEnd)

      if (overlapStart <= overlapEnd) {
        const overlapLength = overlapEnd - overlapStart + 1
        const domainLength = domainEnd - domainStart + 1
        const overlapRatio = overlapLength / domainLength
        return overlapRatio > 0.3 // Significant overlap threshold
      }
      return false
    })
  }

  // Calculate evidence metrics
  const evidenceMetrics = {
    total_hits: hitValidations.length,
    usable_hits: hitValidations.filter(h => h.validation_results?.is_usable_for_boundaries).length,
    used_hits: hitValidations.filter(h => h.contributes_to_pipeline_domains).length,
    unused_usable_hits: hitValidations.filter(h =>
      h.validation_results?.is_usable_for_boundaries && !h.contributes_to_pipeline_domains
    ).length,
    fragments: hitValidations.filter(h => h.validation_results?.coverage_quality === 'fragment').length,
    poor_quality: hitValidations.filter(h => h.validation_results?.coverage_quality === 'poor').length
  }

  // Evidence traceability functions
  const analyzeDomainEvidence = (domain: any): DomainEvidence => {
    const domainStart = domain.start_pos || domain.start
    const domainEnd = domain.end_pos || domain.end
    const domainLength = domainEnd - domainStart + 1

    const contributions: EvidenceContribution[] = []
    let totalSignificance = 0
    let evidenceCount = 0

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
        } else if (overlapRatio > 0.3) {
          contributionType = 'supporting'
          confidenceContribution = 0.5
          notes.push('Supporting evidence - moderate overlap')
          evidenceCount++
        } else if (overlapRatio > 0.1) {
          contributionType = 'boundary_adjustment'
          confidenceContribution = 0.2
          notes.push('May have influenced boundary placement')
        }

        const startDistance = Math.abs(hit.query_start - domainStart)
        const endDistance = Math.abs(hit.query_end - domainEnd)

        if (startDistance <= 5) {
          notes.push(`Likely influenced start boundary (±${startDistance} residues)`)
        }
        if (endDistance <= 5) {
          notes.push(`Likely influenced end boundary (±${endDistance} residues)`)
        }
      } else {
        if (hit.query_end < domainStart - 10 || hit.query_start > domainEnd + 10) {
          contributionType = 'unused'
          notes.push('No overlap - not used for this domain')
        } else {
          contributionType = 'conflicting'
          notes.push('Close to domain but not overlapping - potential boundary conflict')
        }
      }

      if (domain.source === hit.type) {
        notes.push(`Classification source match (${hit.type})`)
        confidenceContribution += 0.1
      }

      contributions.push({
        evidence: validation,
        contribution_type: contributionType,
        overlap_ratio: overlapRatio,
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

    decisionRationale.push(`Classification (${domain.t_group || 'unclassified'}) derived from ${domain.source} evidence`)
    decisionRationale.push(`Final confidence: ${((domain.confidence || 0) * 100).toFixed(0)}%`)

    // Identify potential issues
    const potentialIssues: string[] = []
    const conflictingEvidence = contributions.filter(c => c.contribution_type === 'conflicting')
    const unusedStrong = contributions.filter(c =>
      c.contribution_type === 'unused' &&
      c.evidence.validation_results?.is_usable_for_boundaries
    )

    if (conflictingEvidence.length > 0) {
      potentialIssues.push(`${conflictingEvidence.length} evidence hit(s) near domain but not used`)
    }
    if (unusedStrong.length > 0) {
      potentialIssues.push(`${unusedStrong.length} high-quality evidence hit(s) not incorporated`)
    }
    if (primaryEvidence.length === 0) {
      potentialIssues.push('No primary evidence - domain based on weak evidence only')
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
        boundary_confidence: Math.min(1, evidenceCount / 2),
        classification_confidence: domain.confidence || 0
      },
      decision_rationale: decisionRationale,
      potential_issues: potentialIssues
    }
  }

  const getUnusedEvidence = () => {
    return hitValidations.filter(v =>
      v.validation_results?.is_usable_for_boundaries && !v.contributes_to_pipeline_domains
    )
  }

  const tabs = [
    {
      id: 'overview',
      label: 'Pipeline Domains',
      icon: Eye,
      description: 'Current domain predictions with 3D visualization'
    },
    {
      id: 'evidence_analysis',
      label: 'Evidence Analysis',
      icon: Search,
      description: 'Parse evidence files and analyze quality and usage',
      badge: evidenceMetrics.unused_usable_hits > 0 ? evidenceMetrics.unused_usable_hits : undefined
    },
    {
      id: 'traceability',
      label: 'Domain Traceability',
      icon: Activity,
      description: 'Which evidence contributed to each domain prediction'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Evidence Summary - Only show after successful parsing */}
      {hitValidations.length > 0 && (
        <Card className="p-6 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-green-800">Evidence Analysis Complete</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{evidenceMetrics.total_hits}</div>
              <div className="text-gray-600">Total Evidence Hits</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{evidenceMetrics.usable_hits}</div>
              <div className="text-gray-600">Usable for Boundaries</div>
              <div className="text-xs text-gray-500">Good quality coordinates</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600">{evidenceMetrics.used_hits}</div>
              <div className="text-gray-600">Used by Pipeline</div>
              <div className="text-xs text-gray-500">Contributed to domains</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-orange-600">{evidenceMetrics.unused_usable_hits}</div>
              <div className="text-gray-600">Unused but Usable</div>
              <div className="text-xs text-gray-500">Potential missed evidence</div>
            </div>
          </div>

          {/* Key Issues Alert */}
          {evidenceMetrics.unused_usable_hits > 0 && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">
                  {evidenceMetrics.unused_usable_hits} high-quality evidence hits were not used by the pipeline
                </span>
              </div>
              <div className="text-sm text-orange-700 mt-1">
                This may indicate missed domain boundaries or classification opportunities
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Navigation Tabs */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    {tab.label}
                    {tab.badge && tab.badge > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {tab.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </Card>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Pipeline Domains Overview */}
          {pipelineDomains && pipelineDomains.length > 0 ? (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Current Pipeline Domains</h3>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{pipelineDomains.length}</div>
                  <div className="text-gray-600">Domains</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {pipelineDomains.reduce((sum, d) => sum + ((d.end_pos || d.end) - (d.start_pos || d.start) + 1), 0)}
                  </div>
                  <div className="text-gray-600">Total Residues</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round((pipelineDomains.reduce((sum, d) => sum + ((d.end_pos || d.end) - (d.start_pos || d.start) + 1), 0) / sequenceLength) * 100)}%
                  </div>
                  <div className="text-gray-600">Coverage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {pipelineDomains.filter(d => d.t_group).length}
                  </div>
                  <div className="text-gray-600">Classified</div>
                </div>
              </div>

              {/* Domains Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-medium">Domain</th>
                      <th className="text-left p-3 font-medium">Range</th>
                      <th className="text-left p-3 font-medium">Length</th>
                      <th className="text-left p-3 font-medium">Classification</th>
                      <th className="text-left p-3 font-medium">Source</th>
                      <th className="text-left p-3 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineDomains.map((domain, index) => {
                      const domainStart = domain.start_pos || domain.start
                      const domainEnd = domain.end_pos || domain.end
                      const domainLength = domainEnd - domainStart + 1

                      return (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium">{domain.domain_number || (index + 1)}</div>
                            <div className="text-xs text-gray-500">{domain.domain_id}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-mono">{domainStart}-{domainEnd}</div>
                            {domain.pdb_range && (
                              <div className="text-xs text-gray-500">PDB: {domain.pdb_range}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className={`font-medium ${
                              domainLength >= 50 ? 'text-green-600' :
                              domainLength >= 30 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {domainLength} res
                            </div>
                          </td>
                          <td className="p-3">
                            {domain.t_group ? (
                              <div>
                                <div className="font-medium text-sm">{domain.t_group_name || domain.t_group}</div>
                                <div className="text-xs text-gray-500">
                                  {domain.h_group} • {domain.x_group} • {domain.a_group}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-400">Unclassified</div>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge variant={
                              domain.source === 'hhsearch' ? 'default' :
                              domain.source === 'domain_blast' ? 'secondary' : 'outline'
                            }>
                              {domain.source?.toUpperCase() || 'UNKNOWN'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className={`font-medium ${
                              (domain.confidence || 0) >= 0.8 ? 'text-green-600' :
                              (domain.confidence || 0) >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {domain.confidence ? (domain.confidence * 100).toFixed(0) + '%' : 'N/A'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <div className="text-gray-500">
                <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Pipeline Domains Found</h3>
                <p className="text-gray-600 mb-4">
                  This protein has no domain predictions in the current pipeline results.
                </p>
                <p className="text-sm text-gray-500">
                  You can still analyze evidence files to understand why no domains were predicted.
                </p>
              </div>
            </Card>
          )}

          {/* Structure Viewer */}
          {pipelineDomains && pipelineDomains.length > 0 && (
            <StructureViewer
              pdb_id={proteinId.split('_')[0]}
              chain_id={proteinId.split('_')[1]}
              domains={pipelineDomains.map((domain, index) => ({
                id: domain.id?.toString() || `domain_${index}`,
                chainId: proteinId.split('_')[1],
                domain_type: 'putative',
                start: domain.start_pos || domain.start,
                end: domain.end_pos || domain.end,
                label: `Domain ${domain.domain_number || (index + 1)}`,
                color: ['#FF0000', '#0066FF', '#00CC00', '#FF6600', '#9900CC'][index % 5],
                source: domain.source,
                confidence: domain.confidence,
                t_group: domain.t_group
              }))}
              onDomainClick={(domain) => {
                console.log('Domain clicked:', domain)
              }}
            />
          )}
        </div>
      )}

      {activeTab === 'evidence_analysis' && (
        <div className="space-y-6">
          {/* Domain Summary Parser - Always visible in this tab */}
          <DomainSummaryParser
            proteinId={proteinId}
            filesystemEvidence={filesystemEvidence}
            currentDomains={pipelineDomains}
            sequenceLength={sequenceLength}
            onAnalysisComplete={handleAnalysisComplete}
          />

          {/* Evidence Categories - Only show after parsing */}
          {hitValidations.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* LEFT: USABLE EVIDENCE */}
              <Card className="p-6 border-l-4 border-l-green-500">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h4 className="text-lg font-semibold text-green-800">
                    Usable Evidence ({evidenceMetrics.usable_hits})
                  </h4>
                </div>

                {/* Sub-categories within usable */}
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 rounded border border-purple-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-purple-800">Used by Pipeline ({evidenceMetrics.used_hits})</span>
                      <Badge variant="default">INCORPORATED</Badge>
                    </div>
                    <div className="text-sm text-purple-700 mb-3">
                      These hits were used to define domain boundaries and classifications
                    </div>

                    {/* Used hits table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Type</th>
                            <th className="text-left p-2">Hit ID</th>
                            <th className="text-left p-2">Range</th>
                            <th className="text-left p-2">Quality</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hitValidations
                            .filter(h => h.validation_results?.is_usable_for_boundaries && h.contributes_to_pipeline_domains)
                            .slice(0, 5)
                            .map((hit, i) => (
                              <tr key={i} className="border-b">
                                <td className="p-2">
                                  <Badge variant="outline" className="text-xs">
                                    {hit.evidence_type?.toUpperCase()}
                                  </Badge>
                                </td>
                                <td className="p-2 font-mono">
                                  {hit.hit.type === 'hhsearch' ? hit.hit.hit_id :
                                   hit.hit.type === 'domain_blast' ? hit.hit.domain_id :
                                   `${hit.hit.pdb_id}_${hit.hit.chain_id}`}
                                </td>
                                <td className="p-2 font-mono">{hit.hit.query_range}</td>
                                <td className="p-2">
                                  <Badge variant={
                                    hit.validation_results.coverage_quality === 'excellent' ? 'default' : 'secondary'
                                  } className="text-xs">
                                    {hit.validation_results.coverage_quality}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {evidenceMetrics.used_hits > 5 && (
                        <div className="text-xs text-purple-600 mt-2">
                          ... and {evidenceMetrics.used_hits - 5} more
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-orange-50 rounded border border-orange-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-orange-800">Unused but Usable ({evidenceMetrics.unused_usable_hits})</span>
                      <Badge variant="destructive">MISSED</Badge>
                    </div>
                    <div className="text-sm text-orange-700 mb-3">
                      High-quality evidence not incorporated - potential missed domains or boundaries
                    </div>

                    {/* Unused usable hits table */}
                    {evidenceMetrics.unused_usable_hits > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Type</th>
                              <th className="text-left p-2">Hit ID</th>
                              <th className="text-left p-2">Range</th>
                              <th className="text-left p-2">Quality</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hitValidations
                              .filter(h => h.validation_results?.is_usable_for_boundaries && !h.contributes_to_pipeline_domains)
                              .slice(0, 5)
                              .map((hit, i) => (
                                <tr key={i} className="border-b">
                                  <td className="p-2">
                                    <Badge variant="outline" className="text-xs">
                                      {hit.evidence_type?.toUpperCase()}
                                    </Badge>
                                  </td>
                                  <td className="p-2 font-mono">
                                    {hit.hit.type === 'hhsearch' ? hit.hit.hit_id :
                                     hit.hit.type === 'domain_blast' ? hit.hit.domain_id :
                                     `${hit.hit.pdb_id}_${hit.hit.chain_id}`}
                                  </td>
                                  <td className="p-2 font-mono">{hit.hit.query_range}</td>
                                  <td className="p-2">
                                    <Badge variant={
                                      hit.validation_results.coverage_quality === 'excellent' ? 'default' : 'secondary'
                                    } className="text-xs">
                                      {hit.validation_results.coverage_quality}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {evidenceMetrics.unused_usable_hits > 5 && (
                          <div className="text-xs text-orange-600 mt-2">
                            ... and {evidenceMetrics.unused_usable_hits - 5} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                        ✓ All usable evidence was incorporated into pipeline domains
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* RIGHT: UNUSABLE EVIDENCE */}
              <Card className="p-6 border-l-4 border-l-red-500">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <h4 className="text-lg font-semibold text-red-800">
                    Unusable Evidence ({evidenceMetrics.total_hits - evidenceMetrics.usable_hits})
                  </h4>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  Evidence hits that failed quality validation and were excluded from domain determination
                </div>

                {/* Breakdown by reason */}
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span>Too short (fragments):</span>
                    <span className="font-medium">{evidenceMetrics.fragments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Poor quality:</span>
                    <span className="font-medium">{evidenceMetrics.poor_quality}</span>
                  </div>
                </div>

                {/* Unusable hits table */}
                {(evidenceMetrics.total_hits - evidenceMetrics.usable_hits) > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Hit ID</th>
                          <th className="text-left p-2">Range</th>
                          <th className="text-left p-2">Issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hitValidations
                          .filter(h => !h.validation_results?.is_usable_for_boundaries)
                          .slice(0, 5)
                          .map((hit, i) => (
                            <tr key={i} className="border-b">
                              <td className="p-2">
                                <Badge variant="outline" className="text-xs">
                                  {hit.evidence_type?.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="p-2 font-mono">
                                {hit.hit.type === 'hhsearch' ? hit.hit.hit_id :
                                 hit.hit.type === 'domain_blast' ? hit.hit.domain_id :
                                 `${hit.hit.pdb_id}_${hit.hit.chain_id}`}
                              </td>
                              <td className="p-2 font-mono">{hit.hit.query_range}</td>
                              <td className="p-2">
                                <Badge variant="destructive" className="text-xs">
                                  {hit.validation_results.coverage_quality}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {(evidenceMetrics.total_hits - evidenceMetrics.usable_hits) > 5 && (
                      <div className="text-xs text-red-600 mt-2">
                        ... and {(evidenceMetrics.total_hits - evidenceMetrics.usable_hits) - 5} more
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Key Insights Section */}
          {hitValidations.length > 0 && (
            <Card className="p-6 bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-yellow-600" />
                <h4 className="font-semibold text-yellow-800">Pipeline Analysis Insights</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium text-yellow-800 mb-1">Evidence Utilization</div>
                  <div className="text-yellow-700">
                    {evidenceMetrics.usable_hits > 0 ?
                      Math.round((evidenceMetrics.used_hits / evidenceMetrics.usable_hits) * 100) : 0}% of usable evidence was incorporated
                  </div>
                </div>
                <div>
                  <div className="font-medium text-yellow-800 mb-1">Quality Rate</div>
                  <div className="text-yellow-700">
                    {evidenceMetrics.total_hits > 0 ?
                      Math.round((evidenceMetrics.usable_hits / evidenceMetrics.total_hits) * 100) : 0}% of evidence passed quality validation
                  </div>
                </div>
                <div>
                  <div className="font-medium text-yellow-800 mb-1">Potential Issues</div>
                  <div className="text-yellow-700">
                    {evidenceMetrics.unused_usable_hits > 0 ?
                      `${evidenceMetrics.unused_usable_hits} missed opportunities` :
                      'No obvious issues detected'}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'traceability' && hitValidations.length > 0 && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Evidence Traceability</h3>
              <div className="flex items-center gap-2 text-sm">
                <span>Total Evidence: {hitValidations.length}</span>
                <span>•</span>
                <span>Unused: {getUnusedEvidence().length}</span>
              </div>
            </div>

            {/* Domain Evidence Breakdown */}
            <div className="space-y-4">
              {pipelineDomains.map((domain, domainIndex) => {
                const analysis = analyzeDomainEvidence(domain)

                return (
                  <div key={domainIndex} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium">
                          Domain {domain.domain_number || (domainIndex + 1)}
                        </h4>
                        <Badge variant="outline" className="font-mono">
                          {domain.start_pos || domain.start}-{domain.end_pos || domain.end}
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
                                      P: {contrib.evidence.hit.probability?.toFixed(0) || 'N/A'}%
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500">
                                      E: {contrib.evidence.hit.evalue?.toExponential(1) || 'N/A'}
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
                )
              })}
            </div>

            {/* Unused Evidence */}
            {getUnusedEvidence().length > 0 && (
              <div className="mt-6 border-t pt-6">
                <h4 className="font-medium mb-3 text-gray-700">Unused High-Quality Evidence</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getUnusedEvidence().map((validation, i) => (
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
      )}
    </div>
  )
}
