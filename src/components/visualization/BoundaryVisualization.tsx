'use client'

import React from 'react'
import { DomainSummary } from '@/lib/types'
import { Card } from '@/components/ui/Card'

interface BoundaryVisualizationProps {
  protein: {
    id: number
    pdb_id: string
    chain_id: string
    sequence_length: number
  }
  domains: DomainSummary[]
  referenceDomains?: Array<{
    start: number
    end: number
    classification: string
    source: string
  }>
  onDomainClick?: (domain: DomainSummary) => void
  className?: string
}

export function BoundaryVisualization({
  protein,
  domains,
  referenceDomains = [],
  onDomainClick,
  className = ''
}: BoundaryVisualizationProps) {
  const sequenceLength = protein.sequence_length || 500 // fallback if not available

  // Calculate overlaps between putative and reference domains
  const calculateOverlaps = () => {
    const overlaps: Array<{
      start: number
      end: number
      type: 'exact' | 'partial' | 'conflict'
      putativeDomain: DomainSummary
      referenceDomain?: typeof referenceDomains[0]
    }> = []

    domains.forEach(putativeDomain => {
      referenceDomains.forEach(refDomain => {
        const overlapStart = Math.max(putativeDomain.start_pos, refDomain.start)
        const overlapEnd = Math.min(putativeDomain.end_pos, refDomain.end)
        
        if (overlapStart <= overlapEnd) {
          const overlapLength = overlapEnd - overlapStart + 1
          const putativeLength = putativeDomain.end_pos - putativeDomain.start_pos + 1
          const refLength = refDomain.end - refDomain.start + 1
          
          let type: 'exact' | 'partial' | 'conflict'
          
          // Determine overlap type
          if (overlapLength === putativeLength && overlapLength === refLength) {
            type = 'exact'
          } else if (overlapLength / Math.min(putativeLength, refLength) > 0.8) {
            type = 'partial'
          } else {
            type = 'conflict'
          }

          overlaps.push({
            start: overlapStart,
            end: overlapEnd,
            type,
            putativeDomain,
            referenceDomain: refDomain
          })
        }
      })
    })

    return overlaps
  }

  const overlaps = calculateOverlaps()

  // Calculate positions as percentages for responsive visualization
  const getPosition = (residue: number) => (residue / sequenceLength) * 100

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return 'bg-gray-400'
    if (confidence >= 0.8) return 'bg-confidence-high'
    if (confidence >= 0.5) return 'bg-confidence-medium'
    return 'bg-confidence-low'
  }

  const getClassificationColor = (classification: string | null) => {
    if (!classification) return 'bg-gray-400'
    // Use hash to generate consistent colors for classification groups
    const hash = classification.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0)
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 
      'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ]
    return colors[hash % colors.length]
  }

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Domain Boundaries: {protein.pdb_id}_{protein.chain_id}
          </h3>
          <div className="text-sm text-gray-500">
            Length: {sequenceLength} residues
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-boundary-putative rounded"></div>
            <span>Putative Domains</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-boundary-reference rounded"></div>
            <span>Reference Domains</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-boundary-overlap rounded"></div>
            <span>Overlaps</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-boundary-conflict rounded"></div>
            <span>Conflicts</span>
          </div>
        </div>

        {/* Visualization container */}
        <div className="relative">
          {/* Sequence ruler */}
          <div className="relative h-8 bg-gray-100 rounded mb-4">
            <div className="absolute inset-x-0 top-0 h-full flex items-center">
              {/* Ruler ticks */}
              {Array.from({ length: 11 }, (_, i) => i * 10).map(percent => (
                <div
                  key={percent}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${percent}%` }}
                >
                  <div className="w-px h-2 bg-gray-400"></div>
                  <span className="text-xs text-gray-600 mt-1">
                    {Math.round((percent / 100) * sequenceLength)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Reference domains track */}
          {referenceDomains.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2 text-gray-700">Reference Domains</h4>
              <div className="relative h-6 bg-gray-50 rounded border">
                {referenceDomains.map((domain, index) => (
                  <div
                    key={index}
                    className="absolute h-full bg-boundary-reference opacity-80 border border-red-600 rounded cursor-pointer hover:opacity-100 transition-opacity"
                    style={{
                      left: `${getPosition(domain.start)}%`,
                      width: `${getPosition(domain.end - domain.start + 1)}%`
                    }}
                    title={`${domain.classification} (${domain.start}-${domain.end})`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Overlaps track */}
          {overlaps.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2 text-gray-700">Domain Overlaps</h4>
              <div className="relative h-4 bg-gray-50 rounded border">
                {overlaps.map((overlap, index) => (
                  <div
                    key={index}
                    className={`absolute h-full rounded ${
                      overlap.type === 'exact' 
                        ? 'bg-boundary-overlap' 
                        : overlap.type === 'partial'
                        ? 'bg-yellow-400'
                        : 'bg-boundary-conflict'
                    }`}
                    style={{
                      left: `${getPosition(overlap.start)}%`,
                      width: `${getPosition(overlap.end - overlap.start + 1)}%`
                    }}
                    title={`${overlap.type} overlap (${overlap.start}-${overlap.end})`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Putative domains track */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2 text-gray-700">
              Putative Domains ({domains.length})
            </h4>
            <div className="relative h-8 bg-gray-50 rounded border">
              {domains.map((domain, index) => (
                <div
                  key={domain.id}
                  className={`absolute h-full border-2 border-blue-600 rounded cursor-pointer hover:shadow-md transition-shadow ${getConfidenceColor(domain.confidence)}`}
                  style={{
                    left: `${getPosition(domain.start_pos)}%`,
                    width: `${getPosition(domain.end_pos - domain.start_pos + 1)}%`
                  }}
                  onClick={() => onDomainClick?.(domain)}
                  title={`Domain ${domain.domain_number} (${domain.start_pos}-${domain.end_pos})\nConfidence: ${domain.confidence?.toFixed(3) || 'N/A'}\nClassification: ${domain.t_group || 'N/A'}`}
                >
                  <div className="h-full flex items-center justify-center text-xs font-medium text-white">
                    {domain.domain_number}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Classification track */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-700">Classifications</h4>
            <div className="relative h-6 bg-gray-50 rounded border">
              {domains.map((domain) => (
                <div
                  key={`class-${domain.id}`}
                  className={`absolute h-full rounded opacity-70 ${getClassificationColor(domain.t_group)}`}
                  style={{
                    left: `${getPosition(domain.start_pos)}%`,
                    width: `${getPosition(domain.end_pos - domain.start_pos + 1)}%`
                  }}
                  title={`${domain.t_group || 'Unclassified'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Domain summary stats */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Total Domains</div>
              <div className="text-gray-600">{domains.length}</div>
            </div>
            <div>
              <div className="font-medium">Classified</div>
              <div className="text-gray-600">
                {domains.filter(d => d.t_group).length}
              </div>
            </div>
            <div>
              <div className="font-medium">High Confidence</div>
              <div className="text-gray-600">
                {domains.filter(d => d.confidence && d.confidence >= 0.8).length}
              </div>
            </div>
            <div>
              <div className="font-medium">Coverage</div>
              <div className="text-gray-600">
                {Math.round((domains.reduce((sum, d) => sum + (d.end_pos - d.start_pos + 1), 0) / sequenceLength) * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
