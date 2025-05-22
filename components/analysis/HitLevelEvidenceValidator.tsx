import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { AlertTriangle, CheckCircle, XCircle, Eye, ToggleLeft, ToggleRight, Download, Search } from 'lucide-react'
import { DomainSummaryParser } from '@/components/analysis/DomainSummaryParser'
import { StructureViewer } from '@/components/visualization/StructureViewer'

interface HitValidation {
  hit: any
  evidence_type: 'chain_blast' | 'domain_blast' | 'hhsearch'
  validation_results: {
    sequence_indexing: 'valid' | 'suspect' | 'invalid'
    query_coverage: number
    reference_coverage: number | null
    coverage_quality: 'excellent' | 'good' | 'poor' | 'fragment'
    is_usable_for_boundaries: boolean
  }
  issues: ValidationIssue[]
  boundary_impact: {
    would_create_fragment: boolean
    boundary_quality: 'reliable' | 'questionable' | 'poor'
    recommended_action: string
  }
}

interface ValidationIssue {
  type: 'indexing' | 'coverage' | 'significance' | 'boundary'
  severity: 'critical' | 'warning' | 'info'
  message: string
  suggestion: string
}

interface EvidenceTypeAnalysis {
  type: 'chain_blast' | 'domain_blast' | 'hhsearch'
  total_hits: number
  usable_hits: number
  fragment_causing_hits: number
  indexing_issues: number
  coverage_issues: number
  missing_from_pipeline: number
  common_problems: string[]
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
  const [filesystemEvidence, setFilesystemEvidence] = useState<any>(null)
  const [summaryData, setSummaryData] = useState<any>(null)
  const [hitValidations, setHitValidations] = useState<HitValidation[]>([])
  const [evidenceTypeAnalyses, setEvidenceTypeAnalyses] = useState<EvidenceTypeAnalysis[]>([])
  const [selectedHit, setSelectedHit] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'pipeline' | 'filesystem'>('pipeline')
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'chain_blast' | 'domain_blast' | 'hhsearch'>('all')
  const [issueFilter, setIssueFilter] = useState<'all' | 'critical' | 'warnings'>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Validate individual hits
  const validateHit = (hit: any, evidenceType: 'chain_blast' | 'domain_blast' | 'hhsearch'): HitValidation => {
    const issues: ValidationIssue[] = []
    
    // Parse ranges with validation
    const queryRange = parseAndValidateRange(hit.query_range, 'query', sequenceLength)
    const hitRange = parseAndValidateRange(hit.hit_range, 'hit')
    
    // Sequence indexing validation
    let indexingStatus: 'valid' | 'suspect' | 'invalid' = 'valid'
    
    if (!queryRange.valid) {
      indexingStatus = 'invalid'
      issues.push({
        type: 'indexing',
        severity: 'critical',
        message: `Invalid query range: ${hit.query_range}`,
        suggestion: 'Check sequence coordinate parsing logic'
      })
    } else if (queryRange.start < 1 || queryRange.end > sequenceLength) {
      indexingStatus = 'invalid'
      issues.push({
        type: 'indexing',
        severity: 'critical',
        message: `Query range ${hit.query_range} exceeds sequence bounds (1-${sequenceLength})`,
        suggestion: 'Verify coordinate system (0-based vs 1-based) and sequence length'
      })
    } else if (queryRange.start === 0) {
      indexingStatus = 'suspect'
      issues.push({
        type: 'indexing',
        severity: 'warning',
        message: 'Query range starts at 0 (possible 0-based indexing issue)',
        suggestion: 'Check if coordinates need +1 adjustment'
      })
    }

    if (!hitRange.valid) {
      issues.push({
        type: 'indexing',
        severity: 'warning',
        message: `Invalid hit range: ${hit.hit_range}`,
        suggestion: 'Check hit coordinate parsing'
      })
    }

    // Coverage calculations
    const queryLength = queryRange.valid ? queryRange.end - queryRange.start + 1 : 0
    const queryCoverage = queryLength / sequenceLength
    
    // Reference coverage (if we have reference length info)
    let referenceCoverage: number | null = null
    if (hitRange.valid && hit.reference_length) {
      const hitLength = hitRange.end - hitRange.start + 1
      referenceCoverage = hitLength / hit.reference_length
    }

    // Coverage quality assessment
    let coverageQuality: 'excellent' | 'good' | 'poor' | 'fragment'
    if (queryLength < 30) {
      coverageQuality = 'fragment'
      issues.push({
        type: 'coverage',
        severity: 'critical',
        message: `Very short alignment (${queryLength} residues)`,
        suggestion: 'This hit will likely create a fragment domain'
      })
    } else if (queryCoverage < 0.1) {
      coverageQuality = 'fragment'
      issues.push({
        type: 'coverage',
        severity: 'critical',
        message: `Very low query coverage (${(queryCoverage * 100).toFixed(1)}%)`,
        suggestion: 'Consider filtering out or merging with adjacent hits'
      })
    } else if (queryCoverage < 0.3) {
      coverageQuality = 'poor'
      issues.push({
        type: 'coverage',
        severity: 'warning',
        message: `Low query coverage (${(queryCoverage * 100).toFixed(1)}%)`,
        suggestion: 'Validate if this represents a genuine domain fragment'
      })
    } else if (queryCoverage < 0.7) {
      coverageQuality = 'good'
    } else {
      coverageQuality = 'excellent'
    }

    // Reference coverage validation
    if (referenceCoverage !== null && referenceCoverage < 0.5) {
      issues.push({
        type: 'coverage',
        severity: 'warning',
        message: `Low reference coverage (${(referenceCoverage * 100).toFixed(1)}%)`,
        suggestion: 'Hit may not represent the full reference domain'
      })
    }

    // Significance validation by evidence type
    validateSignificance(hit, evidenceType, issues)

    // Boundary quality assessment
    const boundaryQuality = assessBoundaryQuality(hit, evidenceType, queryCoverage, issues)
    
    const isUsableForBoundaries = indexingStatus === 'valid' && 
                                 coverageQuality !== 'fragment' && 
                                 boundaryQuality.quality !== 'poor'

    return {
      hit,
      evidence_type: evidenceType,
      validation_results: {
        sequence_indexing: indexingStatus,
        query_coverage: queryCoverage,
        reference_coverage: referenceCoverage,
        coverage_quality: coverageQuality,
        is_usable_for_boundaries: isUsableForBoundaries
      },
      issues,
      boundary_impact: boundaryQuality
    }
  }

  const parseAndValidateRange = (rangeStr: string, type: 'query' | 'hit', maxLength?: number) => {
    if (!rangeStr) return { valid: false, start: 0, end: 0 }
    
    const match = rangeStr.match(/(\d+)-(\d+)/)
    if (!match) return { valid: false, start: 0, end: 0 }
    
    const start = parseInt(match[1])
    const end = parseInt(match[2])
    
    const valid = !isNaN(start) && !isNaN(end) && start <= end && 
                  (maxLength ? start >= 1 && end <= maxLength : true)
    
    return { valid, start, end }
  }

  const validateSignificance = (hit: any, evidenceType: string, issues: ValidationIssue[]) => {
    switch (evidenceType) {
      case 'hhsearch':
        if (hit.probability < 50) {
          issues.push({
            type: 'significance',
            severity: 'critical',
            message: `Very low HHSearch probability (${hit.probability.toFixed(1)}%)`,
            suggestion: 'This hit is likely noise and should be filtered out'
          })
        } else if (hit.probability < 80) {
          issues.push({
            type: 'significance',
            severity: 'warning',
            message: `Marginal HHSearch probability (${hit.probability.toFixed(1)}%)`,
            suggestion: 'Use caution when incorporating into domain boundaries'
          })
        }
        break
        
      case 'domain_blast':
      case 'chain_blast':
        if (hit.evalue > 1e-3) {
          issues.push({
            type: 'significance',
            severity: 'critical',
            message: `High E-value (${hit.evalue.toExponential(2)})`,
            suggestion: 'This hit is likely not significant'
          })
        } else if (hit.evalue > 1e-10) {
          issues.push({
            type: 'significance',
            severity: 'warning',
            message: `Moderate E-value (${hit.evalue.toExponential(2)})`,
            suggestion: 'Verify biological relevance before using for boundaries'
          })
        }
        break
    }
  }

  const assessBoundaryQuality = (hit: any, evidenceType: string, queryCoverage: number, issues: ValidationIssue[]) => {
    let quality: 'reliable' | 'questionable' | 'poor' = 'reliable'
    let wouldCreateFragment = false
    let recommendedAction = 'Use for boundary determination'

    // Chain BLAST specific assessment
    if (evidenceType === 'chain_blast') {
      if (queryCoverage > 0.8) {
        recommendedAction = 'Strong candidate for single-domain protein'
      } else if (queryCoverage < 0.5) {
        quality = 'questionable'
        recommendedAction = 'May indicate multi-domain protein - check for additional domains'
        issues.push({
          type: 'boundary',
          severity: 'info',
          message: 'Partial chain coverage suggests multi-domain architecture',
          suggestion: 'Look for additional domain evidence in uncovered regions'
        })
      }
    }

    // Domain BLAST specific assessment
    if (evidenceType === 'domain_blast') {
      if (queryCoverage < 0.3) {
        wouldCreateFragment = true
        quality = 'poor'
        recommendedAction = 'Likely to create fragment - consider extending boundaries'
        issues.push({
          type: 'boundary',
          severity: 'critical',
          message: 'Low coverage domain hit will create fragment',
          suggestion: 'Extend boundaries or merge with adjacent domains'
        })
      }
    }

    // HHSearch specific assessment
    if (evidenceType === 'hhsearch') {
      if (hit.probability < 80 && queryCoverage < 0.5) {
        quality = 'questionable'
        recommendedAction = 'Low confidence and coverage - use as supporting evidence only'
      }
    }

    return {
      would_create_fragment: wouldCreateFragment,
      boundary_quality: quality,
      recommended_action: recommendedAction
    }
  }

  // Analyze evidence types
  const analyzeEvidenceTypes = (validations: HitValidation[]): EvidenceTypeAnalysis[] => {
    const types: ('chain_blast' | 'domain_blast' | 'hhsearch')[] = ['chain_blast', 'domain_blast', 'hhsearch']
    
    return types.map(type => {
      const typeValidations = validations.filter(v => v.evidence_type === type)
      
      const usableHits = typeValidations.filter(v => v.validation_results.is_usable_for_boundaries).length
      const fragmentCausing = typeValidations.filter(v => v.boundary_impact.would_create_fragment).length
      const indexingIssues = typeValidations.filter(v => 
        v.validation_results.sequence_indexing !== 'valid'
      ).length
      const coverageIssues = typeValidations.filter(v => 
        v.validation_results.coverage_quality === 'fragment' || v.validation_results.coverage_quality === 'poor'
      ).length

      // Identify common problems
      const commonProblems: string[] = []
      if (type === 'chain_blast' && typeValidations.length === 0) {
        commonProblems.push('No chain BLAST results found - pipeline issue')
      }
      if (indexingIssues > typeValidations.length * 0.3) {
        commonProblems.push('Frequent sequence indexing issues')
      }
      if (fragmentCausing > usableHits) {
        commonProblems.push('More fragment-causing than usable hits')
      }
      if (coverageIssues > typeValidations.length * 0.5) {
        commonProblems.push('High rate of coverage problems')
      }

      return {
        type,
        total_hits: typeValidations.length,
        usable_hits: usableHits,
        fragment_causing_hits: fragmentCausing,
        indexing_issues: indexingIssues,
        coverage_issues: coverageIssues,
        missing_from_pipeline: 0, // Would need to compare with pipeline results
        common_problems: commonProblems
      }
    })
  }

  // Handle analysis completion
  const handleAnalysisComplete = (analysis: any[], summary: any) => {
    setSummaryData(summary)
    setLoading(true)

    try {
      // Validate all hits
      const validations: HitValidation[] = []
      
      // Chain BLAST hits
      summary.chain_blast_hits?.forEach((hit: any) => {
        validations.push(validateHit(hit, 'chain_blast'))
      })
      
      // Domain BLAST hits
      summary.domain_blast_hits?.forEach((hit: any) => {
        validations.push(validateHit(hit, 'domain_blast'))
      })
      
      // HHSearch hits
      summary.hhsearch_hits?.forEach((hit: any) => {
        validations.push(validateHit(hit, 'hhsearch'))
      })

      setHitValidations(validations)
      
      // Analyze by evidence type
      const typeAnalyses = analyzeEvidenceTypes(validations)
      setEvidenceTypeAnalyses(typeAnalyses)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error validating hits')
    } finally {
      setLoading(false)
    }
  }

  // Generate domains for structure viewer
  const getDomainsForViewer = () => {
    if (viewMode === 'pipeline') {
      return pipelineDomains
    } else {
      // Convert validated hits to pseudo-domains for visualization
      const filteredValidations = hitValidations.filter(v => {
        if (evidenceFilter !== 'all' && v.evidence_type !== evidenceFilter) return false
        if (issueFilter === 'critical' && !v.issues.some(i => i.severity === 'critical')) return false
        if (issueFilter === 'warnings' && !v.issues.some(i => i.severity === 'warning')) return false
        return true
      })

      return filteredValidations.map((validation, index) => {
        const hit = validation.hit
        const queryRange = parseAndValidateRange(hit.query_range, 'query', sequenceLength)
        
        return {
          id: `hit_${index}`,
          start: queryRange.start,
          end: queryRange.end,
          domain_number: index + 1,
          source: validation.evidence_type,
          confidence: validation.validation_results.is_usable_for_boundaries ? 0.8 : 0.3,
          domain_id: `${validation.evidence_type}_${index + 1}`,
          color: validation.validation_results.is_usable_for_boundaries ? 
                 (validation.evidence_type === 'chain_blast' ? '#0066CC' :
                  validation.evidence_type === 'domain_blast' ? '#00AA00' : '#9900CC') :
                 '#FF0000' // Red for problematic hits
        }
      })
    }
  }

  // Hit validation table columns
  const hitColumns = [
    {
      key: 'evidence_type',
      label: 'Type',
      render: (value: string) => (
        <Badge variant={
          value === 'chain_blast' ? 'default' :
          value === 'domain_blast' ? 'secondary' : 'outline'
        }>
          {value.replace('_', ' ').toUpperCase()}
        </Badge>
      )
    },
    {
      key: 'hit_id',
      label: 'Hit ID',
      render: (_: any, validation: HitValidation, index: number) => (
        <button
          onClick={() => setSelectedHit(index)}
          className={`font-mono text-sm px-2 py-1 rounded ${
            selectedHit === index ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
          }`}
        >
          {validation.hit.hit_id || validation.hit.domain_id || 
           `${validation.hit.pdb_id}_${validation.hit.chain_id}` || `Hit ${index + 1}`}
        </button>
      )
    },
    {
      key: 'query_range',
      label: 'Query Range',
      render: (_: any, validation: HitValidation) => {
        const indexingValid = validation.validation_results.sequence_indexing === 'valid'
        return (
          <div className={`font-mono text-sm ${indexingValid ? '' : 'text-red-600 font-bold'}`}>
            {validation.hit.query_range}
            {!indexingValid && <span className="ml-1">⚠️</span>}
          </div>
        )
      }
    },
    {
      key: 'coverage',
      label: 'Coverage',
      render: (_: any, validation: HitValidation) => {
        const coverage = validation.validation_results.query_coverage
        const color = coverage >= 0.7 ? 'text-green-600' :
                     coverage >= 0.3 ? 'text-yellow-600' : 'text-red-600'
        return (
          <div className="text-sm">
            <div className={`font-medium ${color}`}>
              Q: {(coverage * 100).toFixed(1)}%
            </div>
            {validation.validation_results.reference_coverage && (
              <div className="text-xs text-gray-500">
                R: {(validation.validation_results.reference_coverage * 100).toFixed(1)}%
              </div>
            )}
          </div>
        )
      }
    },
    {
      key: 'significance',
      label: 'Significance',
      render: (_: any, validation: HitValidation) => {
        const hit = validation.hit
        if (validation.evidence_type === 'hhsearch') {
          const color = hit.probability >= 80 ? 'text-green-600' :
                       hit.probability >= 50 ? 'text-yellow-600' : 'text-red-600'
          return (
            <div className="text-sm">
              <div className={`font-medium ${color}`}>{hit.probability.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">E: {hit.evalue.toExponential(1)}</div>
            </div>
          )
        } else {
          const color = hit.evalue <= 1e-10 ? 'text-green-600' :
                       hit.evalue <= 1e-5 ? 'text-yellow-600' : 'text-red-600'
          return (
            <div className={`text-sm font-medium ${color}`}>
              {hit.evalue.toExponential(1)}
            </div>
          )
        }
      }
    },
    {
      key: 'usable',
      label: 'Usable',
      render: (_: any, validation: HitValidation) => (
        <div className="text-center">
          {validation.validation_results.is_usable_for_boundaries ? (
            <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 mx-auto" />
          )}
        </div>
      )
    },
    {
      key: 'issues',
      label: 'Issues',
      render: (_: any, validation: HitValidation) => {
        const criticalIssues = validation.issues.filter(i => i.severity === 'critical').length
        const warnings = validation.issues.filter(i => i.severity === 'warning').length
        
        return (
          <div className="text-sm space-y-1">
            {criticalIssues > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalIssues} Critical
              </Badge>
            )}
            {warnings > 0 && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                {warnings} Warnings
              </Badge>
            )}
            {validation.issues.length === 0 && (
              <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                None
              </Badge>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div className="space-y-6">
      {/* Evidence Type Summary */}
      {evidenceTypeAnalyses.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Evidence Type Analysis</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {evidenceTypeAnalyses.map(analysis => (
              <div key={analysis.type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{analysis.type.replace('_', ' ').toUpperCase()}</h4>
                  <Badge variant={analysis.total_hits > 0 ? 'default' : 'destructive'}>
                    {analysis.total_hits} hits
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Usable for boundaries:</span>
                    <span className="font-medium text-green-600">{analysis.usable_hits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Would create fragments:</span>
                    <span className="font-medium text-red-600">{analysis.fragment_causing_hits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Indexing issues:</span>
                    <span className="font-medium text-yellow-600">{analysis.indexing_issues}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coverage issues:</span>
                    <span className="font-medium text-orange-600">{analysis.coverage_issues}</span>
                  </div>
                </div>

                {analysis.common_problems.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-xs font-medium text-gray-700 mb-1">Common Problems:</h5>
                    <div className="space-y-1">
                      {analysis.common_problems.map((problem, i) => (
                        <div key={i} className="text-xs text-red-600 bg-red-50 p-1 rounded">
                          {problem}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Domain Summary Parser */}
      <DomainSummaryParser
        proteinId={proteinId}
        filesystemEvidence={filesystemEvidence}
        currentDomains={pipelineDomains}
        sequenceLength={sequenceLength}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* Controls */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setViewMode(viewMode === 'pipeline' ? 'filesystem' : 'pipeline')}
                className="flex items-center gap-2"
              >
                {viewMode === 'pipeline' ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                {viewMode === 'pipeline' ? 'Show Pipeline Domains' : 'Show Filesystem Evidence'}
              </Button>
              
              <div className="text-sm text-gray-600">
                {viewMode === 'pipeline' ? 'Viewing pipeline-predicted domains' : 'Viewing individual evidence hits'}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Evidence Type:</label>
              <select
                value={evidenceFilter}
                onChange={(e) => setEvidenceFilter(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All Types</option>
                <option value="chain_blast">Chain BLAST</option>
                <option value="domain_blast">Domain BLAST</option>
                <option value="hhsearch">HHSearch</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Issue Filter:</label>
              <select
                value={issueFilter}
                onChange={(e) => setIssueFilter(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All Hits</option>
                <option value="critical">Critical Issues Only</option>
                <option value="warnings">With Warnings</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Structure Viewer */}
      <StructureViewer
        pdb_id={proteinId.split('_')[0]}
        chain_id={proteinId.split('_')[1]}
        domains={getDomainsForViewer()}
        onDomainClick={(domain) => {
          if (viewMode === 'filesystem') {
            // Find corresponding hit validation
            const hitIndex = parseInt(domain.id.split('_')[1]) - 1
            setSelectedHit(hitIndex)
          }
        }}
      />

      {/* Hit Validation Results */}
      {hitValidations.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Hit-Level Validation Results</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Total: {hitValidations.length}</span>
                <span>•</span>
                <span className="text-green-600">
                  Usable: {hitValidations.filter(v => v.validation_results.is_usable_for_boundaries).length}
                </span>
                <span>•</span>
                <span className="text-red-600">
                  Fragment-causing: {hitValidations.filter(v => v.boundary_impact.would_create_fragment).length}
                </span>
              </div>
            </div>

            {loading && (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Validating hits...
              </div>
            )}

            <DataTable
              data={hitValidations.filter(v => {
                if (evidenceFilter !== 'all' && v.evidence_type !== evidenceFilter) return false
                if (issueFilter === 'critical' && !v.issues.some(i => i.severity === 'critical')) return false
                if (issueFilter === 'warnings' && !v.issues.some(i => i.severity === 'warning')) return false
                return true
              })}
              columns={hitColumns}
              onRowClick={(validation, index) => setSelectedHit(index)}
            />

            {/* Selected Hit Details */}
            {selectedHit !== null && hitValidations[selectedHit] && (
              <div className="border-t pt-6">
                <h4 className="text-md font-medium mb-4">
                  Hit Details: {hitValidations[selectedHit].hit.hit_id || `Hit ${selectedHit + 1}`}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Issues */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-red-700">Issues ({hitValidations[selectedHit].issues.length})</h5>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {hitValidations[selectedHit].issues.map((issue, i) => (
                        <div key={i} className={`p-3 rounded text-sm ${
                          issue.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                          issue.severity === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                          'bg-blue-50 border border-blue-200'
                        }`}>
                          <div className="font-medium">{issue.message}</div>
                          <div className="text-xs text-gray-600 mt-1">{issue.suggestion}</div>
                        </div>
                      ))}
                      {hitValidations[selectedHit].issues.length === 0 && (
                        <div className="text-green-600 font-medium">No issues detected</div>
                      )}
                    </div>
                  </div>

                  {/* Boundary Impact */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-blue-700">Boundary Impact Assessment</h5>
                    <div className="space-y-2">
                      <div className="p-3 bg-blue-50 rounded text-sm">
                        <div className="font-medium">Quality: {hitValidations[selectedHit].boundary_impact.boundary_quality}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {hitValidations[selectedHit].boundary_impact.recommended_action}
                        </div>
                      </div>
                      
                      {hitValidations[selectedHit].boundary_impact.would_create_fragment && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                          <AlertTriangle className="w-4 h-4 inline mr-2 text-red-600" />
                          <strong>Fragment Warning:</strong> This hit will likely create a fragment domain
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
