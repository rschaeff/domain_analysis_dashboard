'use client'

import React, { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MolStarViewerProps } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RotateCcw, Download } from 'lucide-react'

// Domain type
import { Domain } from '@/components/visualization/ThreeDMolViewer'

// Dynamically import ThreeDMolViewer with no SSR
const ThreeDMolViewer = dynamic(
  () => import('@/components/visualization/ThreeDMolViewer'),
  { ssr: false, loading: () => <div>Loading 3D viewer...</div> }
)

export function StructureViewer({
  pdb_id,
  chain_id,
  domains = [],
  onDomainClick
}: MolStarViewerProps) {
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null)
  const viewerRef = useRef<any>(null)

  // Map domains to ThreeDMolViewer format
  const mappedDomains: Domain[] = domains.map((domain, index) => ({
    id: String(index + 1),
    chainId: chain_id || 'A',
    start: domain.start,
    end: domain.end,
    color: domain.color || `hsl(${index * 137.5 % 360}, 70%, 50%)`,
    label: domain.label || `Domain ${index + 1}`
  }))

  // Log domain data for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[StructureViewer] Rendering with domains:', mappedDomains);
    }
  }, [mappedDomains]);

  const handleViewerReady = () => {
    console.log('[StructureViewer] 3D viewer ready');
    setIsViewerReady(true)
  }

  const handleHighlightDomain = (domain: Domain, index: number) => {
    setSelectedDomain(index)

    // Focus on the domain in the viewer
    if (viewerRef.current && viewerRef.current.current) {
      try {
        // Call the highlightDomain method exposed via ref
        viewerRef.current.current.highlightDomain(index);
      } catch (error) {
        console.error('Error highlighting domain:', error);
      }
    }

    // Call the onDomainClick callback
    if (onDomainClick) {
      onDomainClick(domain)
    }
  }

  const handleReset = () => {
    setSelectedDomain(null)

    // Reset the viewer
    if (viewerRef.current && viewerRef.current.current) {
      try {
        viewerRef.current.current.reset();
      } catch (error) {
        console.error('Error resetting view:', error);
      }
    }
  }

  const handleExport = () => {
    // Export an image
    if (viewerRef.current && viewerRef.current.current) {
      try {
        const dataUrl = viewerRef.current.current.exportImage();
        if (dataUrl) {
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `${pdb_id}${chain_id ? '_' + chain_id : ''}${selectedDomain !== null ? `_domain${selectedDomain+1}` : ''}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (error) {
        console.error('Error exporting image:', error);
      }
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Structure Viewer - {pdb_id}{chain_id ? `_${chain_id}` : ''}
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

        {/* 3DMol viewer */}
        <div className="relative">
          <ThreeDMolViewer
            ref={viewerRef}
            pdbId={pdb_id}
            chainId={chain_id}
            domains={mappedDomains}
            height="400px"
            onStructureLoaded={handleViewerReady}
            showControls={true}
            className="rounded-lg overflow-hidden border border-gray-200"
          />

          {/* Domain controls overlay */}
          {mappedDomains.length > 0 && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
              <div className="space-y-2">
                <div className="text-sm font-medium">Visualization Controls</div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-500 rounded"></div>
                    <span>Chain {chain_id || 'A'}</span>
                  </div>
                  {mappedDomains.map((domain, index) => (
                    <div key={domain.id} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: domain.color }}
                      ></div>
                      <button
                        onClick={() => handleHighlightDomain(domain, index)}
                        className={`text-left ${
                          selectedDomain === index
                            ? 'text-blue-600 font-medium'
                            : 'hover:text-blue-600'
                        } transition-colors`}
                      >
                        {domain.label} ({domain.start}-{domain.end})
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Domain selection buttons */}
        {mappedDomains.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Domain Selection</h4>
            <div className="flex flex-wrap gap-2">
              {mappedDomains.map((domain, index) => (
                <button
                  key={domain.id}
                  onClick={() => handleHighlightDomain(domain, index)}
                  className={`px-3 py-1 text-sm border rounded-full ${
                    selectedDomain === index
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  } transition-colors`}
                  style={{ borderColor: domain.color }}
                >
                  {domain.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
