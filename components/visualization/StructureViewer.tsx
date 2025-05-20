'use client'

import React, { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { MolStarViewerProps } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RotateCcw, Download } from 'lucide-react'

// Dynamically import ThreeDMolViewer with no SSR
const ThreeDMolViewer = dynamic(
  () => import('@/components/visualization/ThreeDMolViewer'),
  { ssr: false, loading: () => <div>Loading viewer...</div> }
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

  // Map domains to ThreeDMolViewer domain format
  const mappedDomains = domains.map((domain, index) => ({
    id: String(index),
    chainId: chain_id || 'A',
    start: domain.start,
    end: domain.end,
    color: domain.color || `hsl(${index * 137.5 % 360}, 70%, 50%)`,
    label: domain.label || `Domain ${index + 1}`
  }))

  const handleViewerReady = () => {
    setIsViewerReady(true)
  }

  const handleHighlightDomain = (domain: any, index: number) => {
    setSelectedDomain(index)

    // Focus on the domain in the viewer
    if (viewerRef.current && viewerRef.current.current) {
      // Attempt to access viewer methods through ref
      const viewer = viewerRef.current.current;
      try {
        // Select and zoom to the domain
        if (viewer.viewerRef && viewer.viewerRef.current) {
          const mol3DViewer = viewer.viewerRef.current;
          if (mol3DViewer && typeof mol3DViewer.zoomTo === 'function') {
            mol3DViewer.zoomTo({chain: domain.chainId, resi: `${domain.start}-${domain.end}`});
          }
        }
      } catch (error) {
        console.error('Error highlighting domain:', error);
      }
    }

    // Call the onDomainClick callback
    if (onDomainClick) onDomainClick(domain)
  }

  const handleReset = () => {
    setSelectedDomain(null)

    // Reset the viewer
    if (viewerRef.current && viewerRef.current.current) {
      try {
        const viewer = viewerRef.current.current;
        if (viewer.viewerRef && viewer.viewerRef.current) {
          const mol3DViewer = viewer.viewerRef.current;
          if (mol3DViewer && typeof mol3DViewer.zoomTo === 'function') {
            mol3DViewer.zoomTo();
          }
        }
      } catch (error) {
        console.error('Error resetting view:', error);
      }
    }
  }

  const handleExport = () => {
    // Try to export an image using 3DMol's capabilities
    if (viewerRef.current && viewerRef.current.current) {
      try {
        const viewer = viewerRef.current.current;
        if (viewer.viewerRef && viewer.viewerRef.current) {
          const mol3DViewer = viewer.viewerRef.current;

          if (mol3DViewer && typeof mol3DViewer.pngURI === 'function') {
            const dataUrl = mol3DViewer.pngURI();
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${pdb_id}${chain_id ? '_' + chain_id : ''}${selectedDomain !== null ? `_domain${selectedDomain+1}` : ''}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
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
            Structure Viewer - {pdb_id}_{chain_id}
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
          {domains.length > 0 && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
              <div className="space-y-2">
                <div className="text-sm font-medium">Visualization Controls</div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Chain {chain_id}</span>
                  </div>
                  {mappedDomains.map((domain, index) => (
                    <div key={index} className="flex items-center gap-2">
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
        {domains.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Domain Selection</h4>
            <div className="flex flex-wrap gap-2">
              {mappedDomains.map((domain, index) => (
                <button
                  key={index}
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
