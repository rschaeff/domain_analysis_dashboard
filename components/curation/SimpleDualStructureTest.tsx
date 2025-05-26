// components/curation/SimpleDualStructureTest.tsx
'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Debug3DMolViewer from '@/components/visualization/Debug3DMolViewer'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface SimpleDualStructureTestProps {
  queryPdbId: string
  queryChainId: string
  queryDomains: any[]
  referencePdbId: string
  referenceChainId: string
  referenceDomainId: string
  referenceRange: string
  queryRange: string
  hitRange: string
  onStructuresLoaded?: () => void
  onError?: (error: string) => void
}

export function SimpleDualStructureTest({
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
}: SimpleDualStructureTestProps) {
  const [queryStatus, setQueryStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [referenceStatus, setReferenceStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [errors, setErrors] = useState<string[]>([])
  const [debugMode, setDebugMode] = useState(true)

  // Create reference domains with better error handling
  const referenceDomains = React.useMemo(() => {
    try {
      if (!referenceRange || !referenceRange.includes('-')) {
        console.warn('Invalid reference range:', referenceRange)
        return [{
          id: referenceDomainId,
          chainId: referenceChainId,
          start: 1,
          end: 100,
          color: '#FF6B35',
          label: `Reference ${referenceDomainId} (default range)`
        }]
      }

      const [startStr, endStr] = referenceRange.split('-')
      const start = parseInt(startStr?.trim())
      const end = parseInt(endStr?.trim())

      if (isNaN(start) || isNaN(end)) {
        console.warn('Could not parse reference range:', referenceRange)
        return [{
          id: referenceDomainId,
          chainId: referenceChainId,
          start: 1,
          end: 100,
          color: '#FF6B35',
          label: `Reference ${referenceDomainId} (fallback range)`
        }]
      }

      return [{
        id: referenceDomainId,
        chainId: referenceChainId,
        start,
        end,
        color: '#FF6B35',
        label: `Reference ${referenceDomainId} (${start}-${end})`
      }]
    } catch (error) {
      console.error('Error creating reference domains:', error)
      return []
    }
  }, [referenceDomainId, referenceChainId, referenceRange])

  // Process query domains
  const processedQueryDomains = React.useMemo(() => {
    return queryDomains.map((domain, index) => ({
      ...domain,
      color: '#2563EB', // Blue for query
      label: `Query Domain ${index + 1}`
    }))
  }, [queryDomains])

  const handleQueryLoaded = () => {
    console.log('✅ Simple Test: Query loaded')
    setQueryStatus('loaded')
  }

  const handleReferenceLoaded = () => {
    console.log('✅ Simple Test: Reference loaded')
    setReferenceStatus('loaded')
  }

  const handleQueryError = (error: string) => {
    console.log('❌ Simple Test: Query error:', error)
    setQueryStatus('error')
    setErrors(prev => [...prev, `Query: ${error}`])
    if (onError) onError(`Query: ${error}`)
  }

  const handleReferenceError = (error: string) => {
    console.log('❌ Simple Test: Reference error:', error)
    setReferenceStatus('error')
    setErrors(prev => [...prev, `Reference: ${error}`])
    if (onError) onError(`Reference: ${error}`)
  }

  // Check if both loaded
  React.useEffect(() => {
    if (queryStatus === 'loaded' && referenceStatus === 'loaded') {
      console.log('🎉 Simple Test: Both structures loaded!')
      if (onStructuresLoaded) {
        onStructuresLoaded()
      }
    }
  }, [queryStatus, referenceStatus, onStructuresLoaded])

  const handleRefresh = () => {
    console.log('🔄 Simple Test: Refreshing structures')
    setQueryStatus('loading')
    setReferenceStatus('loading')
    setErrors([])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Simple Structure Test</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setDebugMode(!debugMode)}>
            {debugMode ? 'Hide' : 'Show'} Debug
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-4 text-sm">
        <Badge variant={queryStatus === 'loaded' ? 'default' : queryStatus === 'error' ? 'destructive' : 'secondary'}>
          Query: {queryStatus}
        </Badge>
        <Badge variant={referenceStatus === 'loaded' ? 'default' : referenceStatus === 'error' ? 'destructive' : 'secondary'}>
          Reference: {referenceStatus}
        </Badge>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-800">Errors</span>
          </div>
          {errors.map((error, index) => (
            <div key={index} className="text-red-700 text-sm">{error}</div>
          ))}
        </div>
      )}

      {/* Debug Info */}
      {debugMode && (
        <Card className="p-4 bg-gray-50">
          <h4 className="font-medium mb-2">Debug Information</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <strong>Query:</strong>
              <div>PDB: {queryPdbId}</div>
              <div>Chain: {queryChainId}</div>
              <div>Range: {queryRange}</div>
              <div>Domains: {processedQueryDomains.length}</div>
            </div>
            <div>
              <strong>Reference:</strong>
              <div>PDB: {referencePdbId}</div>
              <div>Chain: {referenceChainId}</div>
              <div>Domain: {referenceDomainId}</div>
              <div>Range: {referenceRange}</div>
              <div>Hit Range: {hitRange}</div>
            </div>
          </div>
          <div className="mt-2">
            <strong>Processed Domains:</strong>
            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
              {JSON.stringify({ 
                query: processedQueryDomains, 
                reference: referenceDomains 
              }, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Dual Viewers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Query Structure */}
        <Card className="p-4">
          <h4 className="font-medium text-blue-600 mb-3">
            Query: {queryPdbId}_{queryChainId}
          </h4>
          <Debug3DMolViewer
            pdbId={queryPdbId}
            chainId={queryChainId}
            domains={processedQueryDomains}
            height="350px"
            onStructureLoaded={handleQueryLoaded}
            onError={handleQueryError}
            showControls={true}
            showLoading={true}
          />
        </Card>

        {/* Reference Structure */}
        <Card className="p-4">
          <h4 className="font-medium text-orange-600 mb-3">
            Reference: {referencePdbId}_{referenceChainId}
          </h4>
          <Debug3DMolViewer
            pdbId={referencePdbId}
            chainId={referenceChainId}
            domains={referenceDomains}
            height="350px"
            onStructureLoaded={handleReferenceLoaded}
            onError={handleReferenceError}
            showControls={true}
            showLoading={true}
          />
        </Card>
      </div>
    </div>
  )
}
