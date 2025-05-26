// components/curation/DualStructureViewer.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import ThreeDMolViewer from '@/components/visualization/ThreeDMolViewer'
import { Badge } from '@/components/ui/Badge'
import { RefreshCw, RotateCcw, Download } from 'lucide-react'

interface DualStructureViewerProps {
  // Query structure (the protein being curated)
  queryPdbId: string
  queryChainId: string
  queryDomains: any[]
  
  // Reference structure (evidence domain)
  referencePdbId: string
  referenceChainId: string
  referenceDomainId: string
  referenceRange: string
  
  // Alignment info
  queryRange: string
  hitRange: string
  
  onStructuresLoaded?: () => void
  onError?: (error: string) => void
}

export function DualStructureViewer({
  queryPdbId,
  queryChainId,
  queryDomains,
  referencePdbId,
  referenceChainId,
  referenceDomainId,
  referenceRange,
  queryRange,
  hitRange,
  onStructuresLoaded,
  onError
}: DualStructureViewerProps) {
  const [queryLoaded, setQueryLoaded] = useState(false)
  const [referenceLoaded, setReferenceLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAligning, setIsAligning] = useState(false)
  
  const queryViewerRef = useRef<any>(null)
  const referenceViewerRef = useRef<any>(null)

  // Create domain for reference viewer
  const referenceDomains = [{
    id: referenceDomainId,
    chainId: referenceChainId,
    start: parseInt(referenceRange.split('-')[0] || '1'),
    end: parseInt(referenceRange.split('-')[1] || '100'),
    pdb_range: referenceRange,
    color: '#FF6B35', // Orange for reference
    label: `Reference ${referenceDomainId}`
  }]

  // Highlight query domain being compared
  const highlightedQueryDomains = queryDomains.map((domain, index) => ({
    ...domain,
    color: index === 0 ? '#2563EB' : domain.color // Blue for query domain
  }))

  const handleBothStructuresLoaded = () => {
    if (queryLoaded && referenceLoaded) {
      if (onStructuresLoaded) {
        onStructuresLoaded()
      }
      // Auto-align structures
      performAlignment()
    }
  }

  const performAlignment = async () => {
    if (!queryViewerRef.current?.current || !referenceViewerRef.current?.current) return
    
    setIsAligning(true)
    try {
      // Get both viewers
      const queryViewer = queryViewerRef.current.current.viewerRef.current
      const refViewer = referenceViewerRef.current.current.viewerRef.current
      
      if (queryViewer && refViewer) {
        // Align both structures to similar orientations
        // Focus on the domains being compared
        const querySelection = { 
          chain: queryChainId, 
          resi: queryRange.replace('-', ':') 
        }
        const refSelection = { 
          chain: referenceChainId, 
          resi: referenceRange.replace('-', ':') 
        }
        
        // Set similar camera positions
        queryViewer.zoomTo(querySelection)
        refViewer.zoomTo(refSelection)
        
        // Render both
        queryViewer.render()
        refViewer.render()
      }
    } catch (err) {
      console.error('Alignment error:', err)
    } finally {
      setIsAligning(false)
    }
  }

  const handleError = (errorMsg: string) => {
    setError(errorMsg)
    if (onError) {
      onError(errorMsg)
    }
  }

  const handleSyncViews = () => {
    performAlignment()
  }

  const handleReset = () => {
    if (queryViewerRef.current?.current) {
      queryViewerRef.current.current.reset()
    }
    if (referenceViewerRef.current?.current) {
      referenceViewerRef.current.current.reset()
    }
    setTimeout(performAlignment, 100)
  }

  const handleExport = () => {
    // Export both structures as a combined image
    if (queryViewerRef.current?.current && referenceViewerRef.current?.current) {
      const queryImg = queryViewerRef.current.current.exportImage()
      const refImg = referenceViewerRef.current.current.exportImage()
      
      // Create combined image (you'd implement this)
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      console.log('Export query and reference images')
      // TODO: Implement side-by-side image combination
    }
  }

  useEffect(() => {
    handleBothStructuresLoaded()
  }, [queryLoaded, referenceLoaded])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Structure Comparison</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              Query: {queryPdbId}_{queryChainId}
            </Badge>
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              Reference: {referencePdbId}_{referenceChainId}
            </Badge>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncViews}
            disabled={!queryLoaded || !referenceLoaded || isAligning}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isAligning ? 'animate-spin' : ''}`} />
            Sync Views
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={!queryLoaded || !referenceLoaded}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={!queryLoaded || !referenceLoaded}
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <strong>Structure Loading Error:</strong> {error}
        </div>
      )}

      {/* Dual Structure Display */}
      <div className="grid grid-cols-2 gap-4">
        {/* Query Structure */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-blue-600">
                Query Structure
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {queryPdbId}_{queryChainId}
                </span>
                {queryLoaded && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                )}
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              Domain Range: {queryRange}
            </div>
            
            <div className="relative">
              <ThreeDMolViewer
                ref={queryViewerRef}
                pdbId={queryPdbId}
                chainId={queryChainId}
                domains={highlightedQueryDomains}
                height="400px"
                onStructureLoaded={() => setQueryLoaded(true)}
                onError={handleError}
                showControls={false}
                showLoading={true}
              />
              
              {!queryLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90">
                  <div className="flex items-center gap-2 text-gray-600">
                    <LoadingSpinner size="sm" />
                    Loading query structure...
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Reference Structure */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-orange-600">
                Reference Structure
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {referencePdbId}_{referenceChainId}
                </span>
                {referenceLoaded && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                )}
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              Domain: {referenceDomainId} | Range: {referenceRange}
            </div>
            
            <div className="relative">
              <ThreeDMolViewer
                ref={referenceViewerRef}
                pdbId={referencePdbId}
                chainId={referenceChainId}
                domains={referenceDomains}
                height="400px"
                onStructureLoaded={() => setReferenceLoaded(true)}
                onError={handleError}
                showControls={false}
                showLoading={true}
              />
              
              {!referenceLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90">
                  <div className="flex items-center gap-2 text-gray-600">
                    <LoadingSpinner size="sm" />
                    Loading reference structure...
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Alignment Information */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">Alignment Details</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-600">Query Range:</span> {queryRange}
          </div>
          <div>
            <span className="font-medium text-orange-600">Hit Range:</span> {hitRange}
          </div>
        </div>
      </Card>
    </div>
  )
}
