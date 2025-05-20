// Enhanced Multi-Track Domain Visualization Component
// File: components/visualization/MultiTrackDomainVisualization.tsx

'use client'

import React, { useMemo } from 'react'
import { Card } from '@/components/ui/Card'

interface Domain {
  id: number
  domain_number?: number
  start_pos: number
  end_pos: number
  range: string
  confidence?: number
  t_group?: string
  domain_type: 'putative' | 'reference'
  evidence_type?: string
  ecod_domain_id?: string
  source_id?: string
}

interface Protein {
  id: number
  pdb_id: string
  chain_id: string
  sequence_length: number
}

interface MultiTrackDomainVisualizationProps {
  protein: Protein
  putativeDomains: Domain[]
  referenceDomains: Domain[]
  onDomainClick?: (domain: Domain) => void
}

// Algorithm to arrange domains in tracks to minimize overlap
function arrangeDomainsInTracks(domains: Domain[]): Domain[][] {
  if (domains.length === 0) return []
  
  // Sort domains by start position
  const sortedDomains = [...domains].sort((a, b) => a.start_pos - b.start_pos)
  
  const tracks: Domain[][] = []
  
  for (const domain of sortedDomains) {
    // Find a track where this domain doesn't overlap with the last domain
    let placedInTrack = false
    
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      const lastDomainInTrack = track[track.length - 1]
      
      // Check if there's no overlap (with some padding)
      if (lastDomainInTrack.end_pos + 10 < domain.start_pos) {
        track.push(domain)
        placedInTrack = true
        break
      }
    }
    
    // If no suitable track found, create a new one
    if (!placedInTrack) {
      tracks.push([domain])
    }
  }
  
  return tracks
}

// Group reference domains by their supporting putative domain
function groupReferencesByPutative(
  putativeDomains: Domain[], 
  referenceDomains: Domain[]
): Map<number, Domain[]> {
  const groupedReferences = new Map<number, Domain[]>()
  
  // Initialize groups for each putative domain
  putativeDomains.forEach(putDomain => {
    groupedReferences.set(putDomain.id, [])
  })
  
  // Assign reference domains to putative domains based on overlap or evidence
  referenceDomains.forEach(refDomain => {
    // Find the best matching putative domain
    let bestMatch: Domain | null = null
    let bestOverlap = 0
    
    putativeDomains.forEach(putDomain => {
      // Calculate overlap
      const overlapStart = Math.max(putDomain.start_pos, refDomain.start_pos)
      const overlapEnd = Math.min(putDomain.end_pos, refDomain.end_pos)
      const overlap = Math.max(0, overlapEnd - overlapStart)
      
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        bestMatch = putDomain
      }
    })
    
    // If no overlap found, assign to the closest putative domain
    if (!bestMatch && putativeDomains.length > 0) {
      let minDistance = Infinity
      putativeDomains.forEach(putDomain => {
        const distance = Math.min(
          Math.abs(putDomain.start_pos - refDomain.end_pos),
          Math.abs(putDomain.end_pos - refDomain.start_pos)
        )
        if (distance < minDistance) {
          minDistance = distance
          bestMatch = putDomain
        }
      })
    }
    
    // Add to the appropriate group
    if (bestMatch) {
      const group = groupedReferences.get(bestMatch.id) || []
      group.push(refDomain)
      groupedReferences.set(bestMatch.id, group)
    }
  })
  
  return groupedReferences
}

export function MultiTrackDomainVisualization({
  protein,
  putativeDomains,
  referenceDomains,
  onDomainClick
}: MultiTrackDomainVisualizationProps) {
  
  const { putativeTracks, referenceTracksByPutative } = useMemo(() => {
    // Arrange putative domains (usually just one track)
    const putativeTracks = arrangeDomainsInTracks(putativeDomains)
    
    // Group and arrange reference domains
    const groupedReferences = groupReferencesByPutative(putativeDomains, referenceDomains)
    const referenceTracksByPutative = new Map<number, Domain[][]>()
    
    groupedReferences.forEach((refs, putativeId) => {
      const tracks = arrangeDomainsInTracks(refs)
      referenceTracksByPutative.set(putativeId, tracks)
    })
    
    return { putativeTracks, referenceTracksByPutative }
  }, [putativeDomains, referenceDomains])
  
  const TRACK_HEIGHT = 32
  const TRACK_MARGIN = 8
  const REFERENCE_TRACK_HEIGHT = 24
  
  const totalHeight = 
    putativeTracks.length * (TRACK_HEIGHT + TRACK_MARGIN) +
    Array.from(referenceTracksByPutative.values()).reduce(
      (sum, tracks) => sum + tracks.length * (REFERENCE_TRACK_HEIGHT + TRACK_MARGIN), 
      0
    ) + 40 // padding
  
  const renderDomain = (
    domain: Domain, 
    protein: Protein, 
    trackHeight: number, 
    yPosition: number,
    isPutative: boolean = false
  ) => {
    const leftPercent = (domain.start_pos / protein.sequence_length) * 100
    const widthPercent = ((domain.end_pos - domain.start_pos + 1) / protein.sequence_length) * 100
    
    const baseColor = isPutative 
      ? domain.confidence && domain.confidence >= 0.8 
        ? '#10b981' // green for high confidence putative
        : '#3b82f6' // blue for lower confidence putative
      : '#e5e7eb' // gray for reference domains
    
    const borderColor = isPutative ? '#1e40af' : '#9ca3af'
    
    return (
      <div
        key={domain.id}
        className="absolute border-2 rounded cursor-pointer transition-all duration-200 hover:opacity-80 hover:scale-105"
        style={{
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
          top: yPosition,
          height: trackHeight - 4,
          backgroundColor: baseColor,
          borderColor: borderColor,
          minWidth: '8px'
        }}
        onClick={() => onDomainClick?.(domain)}
        title={`${isPutative ? 'Putative' : 'Reference'} Domain ${domain.domain_number || domain.ecod_domain_id}
Range: ${domain.range}
${domain.confidence ? `Confidence: ${domain.confidence.toFixed(3)}` : ''}
${domain.t_group ? `Classification: ${domain.t_group}` : ''}`}
      >
        <div className="h-full flex items-center justify-center text-white text-xs font-medium overflow-hidden">
          {isPutative ? domain.domain_number : domain.ecod_domain_id?.slice(-3)}
        </div>
      </div>
    )
  }
  
  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Domain Organization: {protein.pdb_id}_{protein.chain_id}
          </h3>
          <div className="text-sm text-gray-600">
            Length: {protein.sequence_length.toLocaleString()} residues
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 border-2 border-blue-700 rounded"></div>
            <span>Putative Domains ({putativeDomains.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 border-2 border-gray-500 rounded"></div>
            <span>Reference Domains ({referenceDomains.length})</span>
          </div>
        </div>
        
        {/* Sequence ruler */}
        <div className="relative h-6 bg-gray-100 rounded border">
          {/* Ruler marks */}
          {Array.from({ length: 11 }, (_, i) => {
            const position = (i / 10) * protein.sequence_length
            const leftPercent = (position / protein.sequence_length) * 100
            return (
              <div
                key={i}
                className="absolute border-l border-gray-400"
                style={{ left: `${leftPercent}%`, height: '100%' }}
              >
                <div className="absolute -bottom-5 -left-4 text-xs text-gray-600">
                  {Math.round(position).toLocaleString()}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Domain tracks */}
        <div className="relative" style={{ height: totalHeight }}>
          {/* Putative domain tracks */}
          {putativeTracks.map((track, trackIndex) => {
            const yPosition = trackIndex * (TRACK_HEIGHT + TRACK_MARGIN)
            return (
              <div key={`putative-${trackIndex}`}>
                {/* Track label */}
                <div 
                  className="absolute left-0 text-sm font-medium text-blue-700"
                  style={{ top: yPosition + 8, left: -80 }}
                >
                  Predicted
                </div>
                {/* Track background */}
                <div
                  className="absolute w-full bg-blue-50 border border-blue-200 rounded"
                  style={{ top: yPosition, height: TRACK_HEIGHT }}
                />
                {/* Domains */}
                {track.map(domain => 
                  renderDomain(domain, protein, TRACK_HEIGHT, yPosition + 2, true)
                )}
              </div>
            )
          })}
          
          {/* Reference domain tracks */}
          {Array.from(referenceTracksByPutative.entries()).map(([putativeId, tracks]) => {
            const putativeDomain = putativeDomains.find(d => d.id === putativeId)
            const startY = putativeTracks.length * (TRACK_HEIGHT + TRACK_MARGIN) + TRACK_MARGIN
            
            return tracks.map((track, trackIndex) => {
              const yPosition = startY + trackIndex * (REFERENCE_TRACK_HEIGHT + TRACK_MARGIN)
              return (
                <div key={`reference-${putativeId}-${trackIndex}`}>
                  {/* Track label (only for first track of each group) */}
                  {trackIndex === 0 && (
                    <div 
                      className="absolute left-0 text-xs text-gray-600"
                      style={{ top: yPosition + 6, left: -80 }}
                    >
                      Evidence for D{putativeDomain?.domain_number}
                    </div>
                  )}
                  {/* Track background */}
                  <div
                    className="absolute w-full bg-gray-50 border border-gray-200 rounded"
                    style={{ top: yPosition, height: REFERENCE_TRACK_HEIGHT }}
                  />
                  {/* Domains */}
                  {track.map(domain => 
                    renderDomain(domain, protein, REFERENCE_TRACK_HEIGHT, yPosition + 2, false)
                  )}
                </div>
              )
            })
          })}
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">{putativeDomains.length}</div>
            <div className="text-sm text-gray-600">Putative Domains</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-gray-600">{referenceDomains.length}</div>
            <div className="text-sm text-gray-600">Reference Domains</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-600">
              {putativeDomains.filter(d => d.t_group).length}
            </div>
            <div className="text-sm text-gray-600">Classified</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-purple-600">
              {Math.round(
                (putativeDomains.reduce((sum, d) => sum + (d.end_pos - d.start_pos + 1), 0) / protein.sequence_length) * 100
              )}%
            </div>
            <div className="text-sm text-gray-600">Coverage</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
