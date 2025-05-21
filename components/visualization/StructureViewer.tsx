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
  const [activeTab, setActiveTab] = useState<string>('putative')
  const viewerRef = useRef<any>(null)

  // Split domains by type
  const putativeDomains = domains.filter(d => d.domain_type === 'putative')
  const referenceDomains = domains.filter(d => d.domain_type === 'reference')

  // Map domains to ThreeDMolViewer format with proper coloring by N-to-C position
  const mapDomains = (domainsToMap: any[]): Domain[] => {
    return domainsToMap.map((domain, index) => ({
      id: String(domain.id || index),
      chainId: chain_id,
      // Use all available position data
      start: domain.start_pos || parseInt(domain.range?.split('-')[0]),
      end: domain.end_pos || parseInt(domain.range?.split('-')[1]),
      // Use PDB range if available
      pdb_range: domain.pdb_range,
      pdb_start: domain.pdb_start,
      pdb_end: domain.pdb_end,
      // Use position-based coloring for N to C terminal visualization
      color: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
      label: domain.domain_id || `Domain ${domain.domain_number || index + 1}`,
      classification: {
        t_group: domain.t_group,
        h_group: domain.h_group,
        x_group: domain.x_group,
        a_group: domain.a_group
      }
    }))
  }

  const mappedPutativeDomains = mapDomains(putativeDomains)
  const mappedReferenceDomains = mapDomains(referenceDomains)

  // For 3D visualization, combine putative and reference domains
  // but prioritize showing putative domains
  const activeDomainsForViewer = activeTab === 'putative'
    ? mappedPutativeDomains
    : mappedReferenceDomains

  // Log domain data for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[StructureViewer] Putative domains:', putativeDomains.length)
      console.log('[StructureViewer] Reference domains:', referenceDomains.length)
    }
  }, [putativeDomains, referenceDomains])

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
      const originalDomain = activeTab === 'putative'
        ? putativeDomains[index]
        : referenceDomains[index]
      onDomainClick(originalDomain)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setSelectedDomain(null)

    // Reset view when switching tabs
    if (viewerRef.current && viewerRef.current.current) {
      try {
        viewerRef.current.current.reset()
      } catch (error) {
        console.error('[StructureViewer] Error resetting view:', error)
      }
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

  // Format classification display
  const formatClassification = (domain: any) => {
    if (!domain?.classification) return null

    const { t_group, h_group } = domain.classification

    if (!t_group && !h_group) return null

    return (
      <div className="text-xs text-gray-600 mt-1">
        {t_group && <span className="mr-2">T: {t_group}</span>}
        {h_group && <span>H: {h_group}</span>}
      </div>
    )
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

        {/* Domain visualization tabs */}
        <Tabs defaultValue="putative" onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="putative">
              Putative Domains ({putativeDomains.length})
            </TabsTrigger>
            <TabsTrigger value="reference">
              Reference Domains ({referenceDomains.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="putative" className="space-y-4">
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
                <h4 className="text-sm font-medium mb-3">Putative Domains</h4>
                <div className="flex flex-wrap gap-2">
                  {mappedPutativeDomains.map((domain, index) => {
                    const originalDomain = putativeDomains[index]
                    return (
                      <Tooltip key={domain.id} content={
                        <div className="text-xs">
                          <div>{domain.label}</div>
                          <div>Range: {domain.start}-{domain.end}</div>
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
          </TabsContent>

          <TabsContent value="reference" className="space-y-4">
            {/* 3DMol viewer (same instance) */}
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

            {/* Reference domain selection buttons */}
            {mappedReferenceDomains.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Reference Domains</h4>
                <div className="flex flex-wrap gap-2">
                  {mappedReferenceDomains.map((domain, index) => {
                    const originalDomain = referenceDomains[index]
                    return (
                      <Tooltip key={domain.id} content={
                        <div className="text-xs">
                          <div>{domain.label}</div>
                          <div>Range: {domain.start}-{domain.end}</div>
                          {originalDomain.source && (
                            <div>Source: {originalDomain.source}</div>
                          )}
                          {originalDomain.t_group && (
                            <div>Classification: {originalDomain.t_group}</div>
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

                              href={`http://prodata.swmed.edu/ecod/complete/domain/${originalDomain.domain_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye className="w-3 h-3" />
                            </a>
                          </span>
                        </button>
                      </Tooltip>
                    )
                  })}
                </div>

                {/* ECOD Reference info */}
                {mappedReferenceDomains.length > 0 && (
                  <div className="text-xs text-gray-500 mt-4 flex items-center">
                    <Info className="w-3 h-3 mr-1" />
                    Reference domains link to the ECOD database for more information
                  </div>
                )}
              </div>
            )}

            {mappedReferenceDomains.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No reference domains found for this protein
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  )
}
