// components/analysis/DomainSummaryParser.tsx
'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { AlertTriangle, FileText, Search, Filter, Download, Eye } from 'lucide-react'

// Types based on actual XML structure
interface ChainBlastHit {
  type: 'chain_blast'
  num: number
  pdb_id: string
  chain_id: string
  hsp_count: number
  evalue: number
  query_range: string
  hit_range: string
  query_start: number
  query_end: number
  hit_start: number
  hit_end: number
  query_coverage: number
  hit_coverage: number
  alignment_length: number
}

interface DomainBlastHit {
  type: 'domain_blast'
  domain_id: string
  pdb_id: string
  chain_id: string
  hsp_count: number
  evalue: number
  query_range: string
  hit_range: string
  query_start: number
  query_end: number
  hit_start: number
  hit_end: number
  query_coverage: number
  hit_coverage: number
  alignment_length: number
}

interface HHSearchHit {
  type: 'hhsearch'
  hit_id: string
  ecod_domain_id?: string
  num: number
  probability: number
  evalue: number
  score: number
  query_range: string
  hit_range: string
  query_start: number
  query_end: number
  hit_start: number
  hit_end: number
  query_coverage: number
  hit_coverage: number
  alignment_length: number
  identity?: number
  similarity?: number
  query_alignment?: string
  template_alignment?: string
}

type AlignmentHit = ChainBlastHit | DomainBlastHit | HHSearchHit

interface CoverageAnalysis {
  hit: AlignmentHit
  coverage_quality: 'excellent' | 'good' | 'poor' | 'fragment'
  issues: string[]
  recommendations: string[]
  is_fragment: boolean
  supports_current_domains: boolean
}

interface DomainSummaryData {
  metadata: {
    pdb_id: string
    chain_id: string
    reference: string
    creation_date?: string
    min_probability?: number
  }
  chain_blast_hits: ChainBlastHit[]
  domain_blast_hits: DomainBlastHit[]
  hhsearch_hits: HHSearchHit[]
  all_hits: AlignmentHit[]
}

interface DomainSummaryParserProps {
  proteinId: string
  filesystemEvidence: any
  currentDomains: any[]
  sequenceLength: number
  onAnalysisComplete?: (analysis: CoverageAnalysis[], summary: DomainSummaryData) => void
}

export function DomainSummaryParser({
  proteinId,
  filesystemEvidence,
  currentDomains,
  sequenceLength,
  onAnalysisComplete
}: DomainSummaryParserProps) {
  const [parsing, setParsing] = useState(false)
  const [summaryData, setSummaryData] = useState<DomainSummaryData | null>(null)
  const [coverageAnalysis, setCoverageAnalysis] = useState<CoverageAnalysis[]>([])
  const [coverageThreshold, setCoverageThreshold] = useState(0.7)
  const [minAlignmentLength, setMinAlignmentLength] = useState(30)
  const [error, setError] = useState<string | null>(null)

  // Parse range string like "11-76" to start/end numbers
  const parseRange = (rangeStr: string): { start: number; end: number } | null => {
    const match = rangeStr.match(/(\d+)-(\d+)/)
    if (match) {
      return {
        start: parseInt(match[1]),
        end: parseInt(match[2])
      }
    }
    return null
  }

  // Calculate coverage metrics
  const calculateCoverage = (queryStart: number, queryEnd: number, hitStart: number, hitEnd: number, refLength?: number) => {
    const queryLength = queryEnd - queryStart + 1
    const hitLength = hitEnd - hitStart + 1
    
    return {
      query_coverage: queryLength / sequenceLength,
      hit_coverage: refLength ? hitLength / refLength : hitLength / hitLength, // fallback if no ref length
      alignment_length: queryLength
    }
  }

  // Parse the domain summary XML based on actual structure
  const parseDomainSummaryXml = (xmlContent: string): DomainSummaryData => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlContent, 'text/xml')
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      throw new Error(`XML parsing error: ${parseError.textContent}`)
    }

    // Extract metadata (from HHSearch format or domain summary format)
    const metadata = extractMetadata(doc)
    
    // Parse chain BLAST hits
    const chainBlastHits = parseChainBlastHits(doc)
    
    // Parse domain BLAST hits
    const domainBlastHits = parseDomainBlastHits(doc)
    
    // Parse HHSearch hits
    const hhsearchHits = parseHHSearchHits(doc)
    
    const all_hits: AlignmentHit[] = [...chainBlastHits, ...domainBlastHits, ...hhsearchHits]

    return {
      metadata,
      chain_blast_hits: chainBlastHits,
      domain_blast_hits: domainBlastHits,
      hhsearch_hits: hhsearchHits,
      all_hits
    }
  }

  const extractMetadata = (doc: Document) => {
    // Try HHSearch format first
    const hhMetadata = doc.querySelector('metadata')
    if (hhMetadata) {
      return {
        pdb_id: hhMetadata.querySelector('pdb_id')?.textContent || '',
        chain_id: hhMetadata.querySelector('chain_id')?.textContent || '',
        reference: hhMetadata.querySelector('reference')?.textContent || '',
        creation_date: hhMetadata.querySelector('creation_date')?.textContent,
        min_probability: parseFloat(hhMetadata.querySelector('min_probability')?.textContent || '0')
      }
    }

    // Try domain summary format
    const summaryEl = doc.querySelector('blast_summ')
    if (summaryEl) {
      return {
        pdb_id: summaryEl.getAttribute('pdb') || '',
        chain_id: summaryEl.getAttribute('chain') || '',
        reference: summaryEl.getAttribute('reference') || ''
      }
    }

    // Extract from protein ID if metadata not found
    const [pdbId, chainId] = proteinId.split('_')
    return {
      pdb_id: pdbId || '',
      chain_id: chainId || '',
      reference: 'unknown'
    }
  }

  const parseChainBlastHits = (doc: Document): ChainBlastHit[] => {
    const hits: ChainBlastHit[] = []
    
    // Look for chain BLAST section
    const chainBlastHits = doc.querySelectorAll('chain_blast_run hits hit')
    
    chainBlastHits.forEach(hit => {
      const queryReg = hit.querySelector('query_reg')?.textContent?.trim()
      const hitReg = hit.querySelector('hit_reg')?.textContent?.trim()
      
      if (queryReg && hitReg) {
        const queryRange = parseRange(queryReg)
        const hitRange = parseRange(hitReg)
        
        if (queryRange && hitRange) {
          const coverage = calculateCoverage(queryRange.start, queryRange.end, hitRange.start, hitRange.end)
          
          hits.push({
            type: 'chain_blast',
            num: parseInt(hit.getAttribute('num') || '0'),
            pdb_id: hit.getAttribute('pdb_id') || '',
            chain_id: hit.getAttribute('chain_id') || '',
            hsp_count: parseInt(hit.getAttribute('hsp_count') || '1'),
            evalue: parseFloat(hit.getAttribute('evalues') || '1'),
            query_range: queryReg,
            hit_range: hitReg,
            query_start: queryRange.start,
            query_end: queryRange.end,
            hit_start: hitRange.start,
            hit_end: hitRange.end,
            ...coverage
          })
        }
      }
    })

    return hits
  }

  const parseDomainBlastHits = (doc: Document): DomainBlastHit[] => {
    const hits: DomainBlastHit[] = []
    
    // Look for domain BLAST section - this has domain_id attributes
    const domainBlastHits = doc.querySelectorAll('blast_run[program="blastp"] hits hit')
    
    domainBlastHits.forEach(hit => {
      const domainId = hit.getAttribute('domain_id')
      if (!domainId) return // Skip if no domain_id (not a domain BLAST hit)
      
      const queryReg = hit.querySelector('query_reg')?.textContent?.trim()
      const hitReg = hit.querySelector('hit_reg')?.textContent?.trim()
      
      if (queryReg && hitReg) {
        const queryRange = parseRange(queryReg)
        const hitRange = parseRange(hitReg)
        
        if (queryRange && hitRange) {
          const coverage = calculateCoverage(queryRange.start, queryRange.end, hitRange.start, hitRange.end)
          
          hits.push({
            type: 'domain_blast',
            domain_id: domainId,
            pdb_id: hit.getAttribute('pdb_id') || '',
            chain_id: hit.getAttribute('chain_id') || '',
            hsp_count: parseInt(hit.getAttribute('hsp_count') || '1'),
            evalue: parseFloat(hit.getAttribute('evalues') || '1'),
            query_range: queryReg,
            hit_range: hitReg,
            query_start: queryRange.start,
            query_end: queryRange.end,
            hit_start: hitRange.start,
            hit_end: hitRange.end,
            ...coverage
          })
        }
      }
    })

    return hits
  }

  const parseHHSearchHits = (doc: Document): HHSearchHit[] => {
    const hits: HHSearchHit[] = []
    
    // Look for HHSearch section - can be in hh_hit_list or hh_run
    const hhHits = doc.querySelectorAll('hh_hit_list hh_hit, hh_run hits hit')
    
    hhHits.forEach(hit => {
      let queryReg, hitReg, queryAlignment, templateAlignment
      
      // Handle different HHSearch formats
      if (hit.tagName === 'hh_hit') {
        // Format from hh_hit_list
        queryReg = hit.querySelector('query_range')?.textContent?.trim()
        hitReg = hit.querySelector('template_seqid_range')?.textContent?.trim()
        queryAlignment = hit.querySelector('alignment query_ali')?.textContent?.trim()
        templateAlignment = hit.querySelector('alignment template_ali')?.textContent?.trim()
      } else {
        // Format from hh_run hits
        queryReg = hit.querySelector('query_reg')?.textContent?.trim()
        hitReg = hit.querySelector('hit_reg')?.textContent?.trim()
      }
      
      if (queryReg && hitReg) {
        const queryRange = parseRange(queryReg)
        const hitRange = parseRange(hitReg)
        
        if (queryRange && hitRange) {
          const coverage = calculateCoverage(queryRange.start, queryRange.end, hitRange.start, hitRange.end)
          
          // Extract identity/similarity if available
          const templateRange = hit.querySelector('template_seqid_range')
          const identity = templateRange ? parseFloat(templateRange.getAttribute('identity') || '0') : undefined
          const similarity = templateRange ? parseFloat(templateRange.getAttribute('similarity') || '0') : undefined
          
          hits.push({
            type: 'hhsearch',
            hit_id: hit.getAttribute('hit_id') || hit.getAttribute('domain_id') || '',
            ecod_domain_id: hit.getAttribute('ecod_domain_id'),
            num: parseInt(hit.getAttribute('hit_num') || hit.getAttribute('num') || '0'),
            probability: parseFloat(hit.getAttribute('probability') || '0'),
            evalue: parseFloat(hit.getAttribute('e_value') || hit.getAttribute('evalue') || '1'),
            score: parseFloat(hit.getAttribute('score') || '0'),
            query_range: queryReg,
            hit_range: hitReg,
            query_start: queryRange.start,
            query_end: queryRange.end,
            hit_start: hitRange.start,
            hit_end: hitRange.end,
            identity,
            similarity,
            query_alignment: queryAlignment,
            template_alignment: templateAlignment,
            ...coverage
          })
        }
      }
    })

    return hits
  }

  // Analyze coverage quality
  const analyzeCoverage = (summaryData: DomainSummaryData): CoverageAnalysis[] => {
    return summaryData.all_hits.map(hit => {
      const issues: string[] = []
      const recommendations: string[] = []
      let quality: 'excellent' | 'good' | 'poor' | 'fragment' = 'good'
      let isFragment = false
      let supportsCurrentDomains = false

      // Fragment detection
      if (hit.alignment_length < minAlignmentLength) {
        quality = 'fragment'
        isFragment = true
        issues.push(`Very short alignment (${hit.alignment_length} residues)`)
        recommendations.push('Consider filtering out - likely a fragment')
      } else if (hit.query_coverage < 0.3) {
        quality = 'fragment'
        isFragment = true
        issues.push(`Very low query coverage (${(hit.query_coverage * 100).toFixed(1)}%)`)
        recommendations.push('Consider filtering out or merging with adjacent domains')
      } else if (hit.query_coverage < 0.5) {
        quality = 'poor'
        issues.push(`Low query coverage (${(hit.query_coverage * 100).toFixed(1)}%)`)
        recommendations.push('Investigate if this should be part of a larger domain')
      } else if (hit.query_coverage < coverageThreshold) {
        quality = 'good'
        issues.push(`Moderate query coverage (${(hit.query_coverage * 100).toFixed(1)}%)`)
      } else {
        quality = 'excellent'
      }

      // Check significance
      if (hit.type === 'hhsearch') {
        const hhHit = hit as HHSearchHit
        if (hhHit.probability < 90) {
          issues.push(`Low probability (${hhHit.probability.toFixed(1)}%)`)
          if (quality === 'excellent') quality = 'good'
        }
      } else {
        if (hit.evalue > 1e-5) {
          issues.push(`High E-value (${hit.evalue.toExponential(2)})`)
          if (quality === 'excellent') quality = 'good'
        }
      }

      // Check if this hit supports any current domain
      for (const domain of currentDomains) {
        const domainStart = domain.start_pos || domain.start
        const domainEnd = domain.end_pos || domain.end
        
        // Check for overlap
        const overlapStart = Math.max(hit.query_start, domainStart)
        const overlapEnd = Math.min(hit.query_end, domainEnd)
        
        if (overlapStart <= overlapEnd) {
          const overlapLength = overlapEnd - overlapStart + 1
          const domainLength = domainEnd - domainStart + 1
          const overlapRatio = overlapLength / domainLength
          
          if (overlapRatio > 0.5) {
            supportsCurrentDomains = true
            break
          }
        }
      }

      // Additional recommendations based on evidence type
      if (hit.type === 'domain_blast' && quality === 'excellent') {
        recommendations.push('High-quality domain evidence - good for boundary definition')
      } else if (hit.type === 'chain_blast' && hit.query_coverage > 0.8) {
        recommendations.push('Extensive chain match - may indicate single-domain protein')
      } else if (hit.type === 'hhsearch' && quality === 'excellent') {
        recommendations.push('High-confidence HHSearch hit - reliable classification')
      }

      return {
        hit,
        coverage_quality: quality,
        issues,
        recommendations,
        is_fragment: isFragment,
        supports_current_domains: supportsCurrentDomains
      }
    })
  }

  // Parse domain summary file
  const parseDomainSummaryFile = async () => {
    setParsing(true)
    setError(null)
    
    try {
      // Find domain summary file
      const domainSummaryFile = filesystemEvidence?.files?.find((file: any) => 
        file.file_type === 'domain_summary' && file.file_exists
      )

      if (!domainSummaryFile) {
        throw new Error('No domain summary file found or file does not exist')
      }

      // Fetch file content
      const response = await fetch(`/api/proteins/${proteinId}/files/${domainSummaryFile.id}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`)
      }

      const data = await response.json()
      const xmlContent = data.content

      // Parse the XML
      const summary = parseDomainSummaryXml(xmlContent)
      setSummaryData(summary)

      // Analyze coverage
      const analysis = analyzeCoverage(summary)
      setCoverageAnalysis(analysis)

      if (onAnalysisComplete) {
        onAnalysisComplete(analysis, summary)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setParsing(false)
    }
  }

  // Table columns for coverage analysis
  const analysisColumns = [
    {
      key: 'type',
      label: 'Evidence Type',
      render: (value: string, analysis: CoverageAnalysis) => (
        <Badge variant={
          value === 'hhsearch' ? 'default' :
          value === 'domain_blast' ? 'secondary' : 'outline'
        }>
          {value.replace('_', ' ').toUpperCase()}
        </Badge>
      )
    },
    {
      key: 'reference_id',
      label: 'Reference',
      render: (_: any, analysis: CoverageAnalysis) => {
        const hit = analysis.hit
        if (hit.type === 'hhsearch') {
          return <div className="font-mono text-sm">{(hit as HHSearchHit).hit_id}</div>
        } else if (hit.type === 'domain_blast') {
          return <div className="font-mono text-sm">{(hit as DomainBlastHit).domain_id}</div>
        } else {
          return <div className="font-mono text-sm">{(hit as ChainBlastHit).pdb_id}_{(hit as ChainBlastHit).chain_id}</div>
        }
      }
    },
    {
      key: 'query_range',
      label: 'Query Range',
      render: (_: any, analysis: CoverageAnalysis) => (
        <div className="font-mono text-sm">
          <div>{analysis.hit.query_range}</div>
          <div className="text-xs text-gray-500">
            {analysis.hit.alignment_length} residues
          </div>
        </div>
      )
    },
    {
      key: 'coverage',
      label: 'Coverage',
      render: (_: any, analysis: CoverageAnalysis) => (
        <div className="text-sm">
          <div className={`font-medium ${
            analysis.hit.query_coverage >= 0.7 ? 'text-green-600' :
            analysis.hit.query_coverage >= 0.5 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {(analysis.hit.query_coverage * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">
            of sequence
          </div>
        </div>
      )
    },
    {
      key: 'significance',
      label: 'Significance',
      render: (_: any, analysis: CoverageAnalysis) => {
        const hit = analysis.hit
        if (hit.type === 'hhsearch') {
          const hhHit = hit as HHSearchHit
          return (
            <div className="text-sm">
              <div className="font-medium text-blue-600">
                {hhHit.probability.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">
                E: {hhHit.evalue.toExponential(1)}
              </div>
            </div>
          )
        } else {
          return (
            <div className="text-sm">
              <div className="text-xs text-gray-500">
                E: {hit.evalue.toExponential(1)}
              </div>
            </div>
          )
        }
      }
    },
    {
      key: 'coverage_quality',
      label: 'Quality',
      render: (value: string) => (
        <Badge variant={
          value === 'excellent' ? 'default' :
          value === 'good' ? 'secondary' :
          value === 'poor' ? 'destructive' : 'outline'
        }>
          {value.toUpperCase()}
        </Badge>
      )
    },
    {
      key: 'supports_current_domains',
      label: 'Supports Current',
      render: (value: boolean) => (
        <Badge variant={value ? 'default' : 'outline'}>
          {value ? 'Yes' : 'No'}
        </Badge>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Domain Summary Analysis</h3>
            <Button onClick={parseDomainSummaryFile} disabled={parsing}>
              {parsing ? <LoadingSpinner size="sm" className="mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Parse Domain Summary
            </Button>
          </div>

          {/* Thresholds */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Coverage Threshold: {(coverageThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={coverageThreshold}
                onChange={(e) => setCoverageThreshold(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Min Alignment Length: {minAlignmentLength} residues
              </label>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={minAlignmentLength}
                onChange={(e) => setMinAlignmentLength(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Error display */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Parsing Error</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Statistics */}
      {summaryData && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">Evidence Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {summaryData.chain_blast_hits.length}
              </div>
              <div className="text-gray-600">Chain BLAST Hits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {summaryData.domain_blast_hits.length}
              </div>
              <div className="text-gray-600">Domain BLAST Hits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {summaryData.hhsearch_hits.length}
              </div>
              <div className="text-gray-600">HHSearch Hits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {coverageAnalysis.filter(a => a.is_fragment).length}
              </div>
              <div className="text-gray-600">Fragments</div>
            </div>
          </div>
        </Card>
      )}

      {/* Coverage Analysis Results */}
      {coverageAnalysis.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Coverage Analysis Results</h4>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  <Badge variant="default" className="mr-1">
                    {coverageAnalysis.filter(a => a.coverage_quality === 'excellent').length}
                  </Badge>
                  Excellent
                </span>
                <span>
                  <Badge variant="secondary" className="mr-1">
                    {coverageAnalysis.filter(a => a.coverage_quality === 'good').length}
                  </Badge>
                  Good
                </span>
                <span>
                  <Badge variant="destructive" className="mr-1">
                    {coverageAnalysis.filter(a => a.coverage_quality === 'poor').length}
                  </Badge>
                  Poor
                </span>
                <span>
                  <Badge variant="outline" className="mr-1">
                    {coverageAnalysis.filter(a => a.coverage_quality === 'fragment').length}
                  </Badge>
                  Fragments
                </span>
              </div>
            </div>
          </div>
          
          <DataTable
            data={coverageAnalysis}
            columns={analysisColumns}
            showPagination={true}
            pageSize={20}
          />
        </Card>
      )}

      {/* Analysis insights */}
      {coverageAnalysis.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">Coverage Analysis Insights</h4>
          <div className="space-y-3 text-sm">
            {/* Fragment warning */}
            {coverageAnalysis.filter(a => a.is_fragment).length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="font-medium text-red-800 mb-1">
                  ⚠️ Fragments Detected ({coverageAnalysis.filter(a => a.is_fragment).length})
                </div>
                <div className="text-red-700">
                  These alignments are likely too short to represent meaningful domains. Consider filtering them out or increasing coverage thresholds upstream.
                </div>
              </div>
            )}

            {/* Coverage issues */}
            {coverageAnalysis.filter(a => a.coverage_quality === 'poor' && !a.is_fragment).length > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="font-medium text-yellow-800 mb-1">
                  🔍 Poor Coverage ({coverageAnalysis.filter(a => a.coverage_quality === 'poor' && !a.is_fragment).length})
                </div>
                <div className="text-yellow-700">
                  These alignments have low sequence coverage. They may represent domain fragments that should be merged with adjacent domains or extended.
                </div>
              </div>
            )}

            {/* Unused evidence */}
            {coverageAnalysis.filter(a => !a.supports_current_domains && a.coverage_quality === 'excellent').length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="font-medium text-blue-800 mb-1">
                  💡 Unused High-Quality Evidence ({coverageAnalysis.filter(a => !a.supports_current_domains && a.coverage_quality === 'excellent').length})
                </div>
                <div className="text-blue-700">
                  There are high-quality alignments that don't support current domain assignments. These may indicate missed domains or suggest boundary adjustments.
                </div>
              </div>
            )}

            {/* Good coverage */}
            {coverageAnalysis.filter(a => a.coverage_quality === 'excellent').length > 0 && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="font-medium text-green-800 mb-1">
                  ✅ High Quality Evidence ({coverageAnalysis.filter(a => a.coverage_quality === 'excellent').length})
                </div>
                <div className="text-green-700">
                  These alignments meet coverage thresholds and provide strong evidence for domain boundaries.
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
