'use client'

import React, { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { RotateCcw, Download, Eye, Info } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'

// Domain type
import { Domain } from '@/components/visualization/ThreeDMolViewer'

// Dynamically import ThreeDMolViewer with no SSR
const ThreeDMolViewer = dynamic(
  () => import('@/components/visualization/ThreeDMolViewer'),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center">Loading 3D viewer...</div> }
)

// Domain colors with high initial contrast for N-to-C terminal coloring
const DOMAIN_COLORS = [
  '#FF0000', // Red
  '#0000FF', // Blue
  '#00CC00', // Green
  '#FF00FF', // Magenta
  '#FFCC00', // Gold
  '#00FFFF', // Cyan
  '#FF6600', // Orange
  '#9900CC', // Purple
  '#669900', // Olive
  '#FF99CC', // Pink
  '#666666', // Gray
  '#336699', // Steel Blue
]

interface StructureViewerProps {
  pdb_id: string
  chain_id: string
  domains?: any[]
  onDomainClick?: (domain: any) => void
}

export function StructureViewer({
  pdb_id,
  chain_id,
  domains = [],
  onDomainClick
}: StructureViewerProps) {
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('structure')
  const viewerRef = useRef<any>(null)

  // Since we're only receiving putative domains now, we don't need to filter
  // But we'll keep the structure for potential future use
  const putativeDomains = domains.filter(d =>
    d.domain_type === 'putative' || !d.domain_type
  )

  // Reference domains should only be informational
  const referenceDomains: any[] = []

  // Map domains to ThreeDMolViewer format with proper coloring by N-to-C position
  const mapDomains = (domainsToMap: any[]): Domain[] => {
    return domainsToMap.map((domain, index) => ({
      id: String(domain.id || index),
      chainId: domain.chainId || chain_id,
      // Use all available position data
      start: domain.start || parseInt(domain.range?.split('-')[0]) || 0,
      end: domain.end || parseInt(domain.range?.split('-')[1]) || 0,
      // Use PDB range if available
      pdb_range: domain.pdb_range,
      pdb_start: domain.pdb_start,
      pdb_end: domain.pdb_end,
      // Use position-based coloring for N to C terminal visualization
      color: domain.color || DOMAIN_COLORS[index % DOMAIN_COLORS.length],
      label: domain.label || domain.domain_id || `Domain ${domain.domain_number || index + 1}`,
      classification: {
        t_group: domain.t_group,
        h_group: domain.h_group,
        x_group: domain.x_group,
        a_group: domain.a_group
      }
    }))
  }

  const mappedPutativeDomains = mapDomains(putativeDomains)

  // For 3D visualization, use the putative domains
  const activeDomainsForViewer = mappedPutativeDomains

  // Log domain data for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[StructureViewer] Total domains received:', domains.length)
      console.log('[StructureViewer] Putative domains (actual predictions):', putativeDomains.length)
      console.log('[StructureViewer] Sample domain data:', domains[0])
    }
  }, [domains, putativeDomains])

  const handleViewerReady = () => {
    console.log('[StructureViewer] 3D viewer ready')
    setIsViewerReady(true)
    setViewerError(null)
  }

  const handleViewerError = (error: string) => {
    console.error('[StructureViewer] Error:', error)
    setViewerError(error)
  }

  const handleHighlightDomain = (domain: Domain, index: number, e?: React.MouseEvent) => {
    // Stop event propagation if event is provided
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    console.log(`[StructureViewer] Highlighting domain ${index}: ${domain.start}-${domain.end}`)
    setSelectedDomain(index)

    // Focus on the domain in the viewer
    if (viewerRef.current && viewerRef.current.current) {
      try {
        // Call the highlightDomain method exposed via ref
        viewerRef.current.current.highlightDomain(index)
      } catch (error) {
        console.error('[StructureViewer] Error highlighting domain:', error)
      }
    }

    // If the domain is clicked and there's a click handler, call it
    if (onDomainClick && !e) {
      const originalDomain = putativeDomains[index]
      onDomainClick(originalDomain)
    }
  }

  const handleReset = () => {
    console.log('[StructureViewer] Resetting view')
    setSelectedDomain(null)

    // Reset the viewer
    if (viewerRef.current && viewerRef.current.current) {
      try {
        viewerRef.current.current.reset()
      } catch (error) {
        console.error('[StructureViewer] Error resetting view:', error)
      }
    }
  }

  const handleExport = () => {
    // Export an image
    if (viewerRef.current && viewerRef.current.current) {
      try {
        const dataUrl = viewerRef.current.current.exportImage()
        if (dataUrl) {
          const link = document.createElement('a')
          link.href = dataUrl
          link.download = `${pdb_id}${chain_id ? '_' + chain_id : ''}${selectedDomain !== null ? `_domain${selectedDomain+1}` : ''}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      } catch (error) {
        console.error('[StructureViewer] Error exporting image:', error)
      }
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Structure: {pdb_id}{chain_id ? `_${chain_id}` : ''}
          </h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!isViewerReady}
              onClick={handleReset}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!isViewerReady}
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Information about domain visualization */}
        <div className="bg-blue-50 p-3 rounded-lg text-sm">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 text-blue-600" />
            <div>
              <strong>Domain Visualization:</strong> This shows predicted domain boundaries for this specific protein.
              Reference domains from other proteins are not displayed on the structure as their coordinates
              would not be meaningful for this protein.
            </div>
          </div>
        </div>

        {/* 3DMol viewer */}
        <div className="relative">
          <ThreeDMolViewer
            ref={viewerRef}
            pdbId={pdb_id}
            chainId={chain_id}
            domains={activeDomainsForViewer}
            height="400px"
            onStructureLoaded={handleViewerReady}
            onError={handleViewerError}
            showControls={true}
            className="rounded-lg overflow-hidden border border-gray-200"
          />

          {viewerError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg">
              <div className="text-red-600 text-center p-4">
                <p className="font-semibold">Error loading structure</p>
                <p className="text-sm mt-1">{viewerError}</p>
              </div>
            </div>
          )}

          {!isViewerReady && !viewerError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg">
              <LoadingSpinner />
              <p className="ml-2">Loading structure...</p>
            </div>
          )}
        </div>

        {/* Domain selection buttons */}
        {mappedPutativeDomains.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Predicted Domains ({mappedPutativeDomains.length})</h4>
            <div className="flex flex-wrap gap-2">
              {mappedPutativeDomains.map((domain, index) => {
                const originalDomain = putativeDomains[index]
                return (
                  <Tooltip key={domain.id} content={
                    <div className="text-xs">
                      <div>{domain.label}</div>
                      <div>Range: {domain.start}-{domain.end}</div>
                      {domain.pdb_range && (
                        <div>PDB Range: {domain.pdb_range}</div>
                      )}
                      {originalDomain.source && (
                        <div>Source: {originalDomain.source}</div>
                      )}
                      {originalDomain.confidence && (
                        <div>Confidence: {originalDomain.confidence.toFixed(2)}</div>
                      )}
                    </div>
                  }>
                    <button
                      onClick={(e) => handleHighlightDomain(domain, index, e)}
                      className={`px-3 py-1 text-sm border rounded-full ${
                        selectedDomain === index
                          ? 'bg-gray-100'
                          : 'hover:bg-gray-50'
                      } transition-colors`}
                      style={{ borderColor: domain.color }}
                    >
                      <span className="flex items-center gap-1">
                        {domain.label}
                        {originalDomain.t_group && (
                          <Badge variant="outline" className="text-xs">
                            {originalDomain.t_group}
                          </Badge>
                        )}
                      </span>
                    </button>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )}

        {mappedPutativeDomains.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <p>No predicted domains found for this protein</p>
          </div>
        )}
      </div>
    </Card>
  )
}
