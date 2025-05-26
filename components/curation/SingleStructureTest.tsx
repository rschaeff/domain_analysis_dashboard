// components/curation/SingleStructureTest.tsx
'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Debug3DMolViewer from '@/components/visualization/Debug3DMolViewer'
import { RefreshCw, AlertTriangle, Play } from 'lucide-react'

interface SingleStructureTestProps {
  pdbId: string
  chainId: string
  domains?: any[]
}

export function SingleStructureTest({
  pdbId,
  chainId,
  domains = []
}: SingleStructureTestProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [viewerEnabled, setViewerEnabled] = useState(false)

  const handleStructureLoaded = () => {
    console.log('✅ Single Test: Structure loaded successfully')
    setStatus('loaded')
    setError(null)
  }

  const handleError = (errorMsg: string) => {
    console.log('❌ Single Test: Structure error:', errorMsg)
    setStatus('error')
    setError(errorMsg)
  }

  const handleStart = () => {
    console.log('🚀 Single Test: Starting structure load')
    setStatus('loading')
    setError(null)
    setViewerEnabled(true)
  }

  const handleReset = () => {
    console.log('🔄 Single Test: Resetting')
    setStatus('idle')
    setError(null)
    setViewerEnabled(false)
  }

  const processedDomains = domains.map((domain, index) => {
    console.log(`🔍 SingleTest - Processing domain ${index + 1}:`, {
      id: domain.id,
      pdb_range: domain.pdb_range,
      range: domain.range,
      start_pos: domain.start_pos,
      end_pos: domain.end_pos,
    })

    // Primary: Use pdb_range
    let displayRange = 'undefined'
    let ranges: string[] = []

    if (domain.pdb_range) {
      const cleanRange = domain.pdb_range.includes(':')
        ? domain.pdb_range.split(':')[1]
        : domain.pdb_range
      ranges = cleanRange.split(',').map((r: string) => r.trim()).filter((r: string) => r.includes('-'))
      displayRange = ranges.join(',')
    } else if (domain.range) {
      const cleanRange = domain.range.includes(':')
        ? domain.range.split(':')[1]
        : domain.range
      ranges = cleanRange.split(',').map((r: string) => r.trim()).filter((r: string) => r.includes('-'))
      displayRange = ranges.join(',')
    } else {
      // Fallback to positions
      const start = domain.start_pos || domain.start || 1
      const end = domain.end_pos || domain.end || 100
      ranges = [`${start}-${end}`]
      displayRange = `${start}-${end}`
    }

    return {
      ...domain,
      id: domain.id || `domain_${index + 1}`,
      threeDMolRanges: ranges,
      displayRange: displayRange,
      color: domain.color || '#2563EB',
      label: `Domain ${index + 1} (${displayRange})`
    }
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Single Structure Test</h3>
        <div className="flex items-center gap-2">
          <Badge variant={
            status === 'loaded' ? 'default' :
            status === 'error' ? 'destructive' :
            status === 'loading' ? 'secondary' : 'outline'
          }>
            {status}
          </Badge>
          <Button size="sm" variant="outline" onClick={handleStart} disabled={status === 'loading'}>
            <Play className="w-4 h-4 mr-1" />
            Load Structure
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Info */}
      <Card className="p-4 bg-blue-50">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>PDB ID:</strong> {pdbId}
          </div>
          <div>
            <strong>Chain ID:</strong> {chainId}
          </div>
          <div>
            <strong>Domains:</strong> {domains.length}
          </div>
          <div>
            <strong>Status:</strong> {status}
          </div>
        </div>
        {processedDomains.length > 0 && (
          <div className="mt-2">
            <strong>Domain Details:</strong>
            {processedDomains.map((domain, index) => (
              <div key={index} className="text-xs mt-1">
                {index + 1}: {domain.displayRange} ({domain.color}) {domain.id ? `[${domain.id}]` : ''} | pdb_range: {domain.pdb_range || 'none'}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-800">Error Loading Structure</span>
          </div>
          <div className="text-red-700 text-sm mt-1">{error}</div>
        </div>
      )}

      {/* Structure Viewer */}
      {viewerEnabled && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">
            Structure: {pdbId}_{chainId}
          </h4>
          <Debug3DMolViewer
            pdbId={pdbId}
            chainId={chainId}
            domains={processedDomains}
            height="400px"
            onStructureLoaded={handleStructureLoaded}
            onError={handleError}
            showControls={true}
            showLoading={true}
          />
        </Card>
      )}

      {/* Instructions */}
      {status === 'idle' && (
        <Card className="p-4 bg-gray-50">
          <h4 className="font-medium mb-2">Test Instructions</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Click "Load Structure" to start the test</li>
            <li>Watch the console for debug messages</li>
            <li>Check if the structure loads and stays visible</li>
            <li>Look for any error messages</li>
            <li>Use "Reset" to clear and try again</li>
          </ol>
        </Card>
      )}
    </div>
  )
}
