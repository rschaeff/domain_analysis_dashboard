// components/visualization/Debug3DMolViewer.tsx
'use client'

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useMemo } from 'react'

interface Domain {
  id: string
  chainId?: string
  start: number
  end: number
  color?: string
  label?: string
}

interface Debug3DMolViewerProps {
  pdbId: string
  chainId?: string
  domains?: Domain[]
  height?: string
  onStructureLoaded?: () => void
  onError?: (error: string) => void
  showControls?: boolean
  showLoading?: boolean
}

// Debug logger
const debugLog = (component: string, message: string, data?: any) => {
  const timestamp = new Date().toLocaleTimeString()
  console.log(`[${timestamp}] 🧬 ${component}: ${message}`, data || '')
}

const Debug3DMolViewer = forwardRef<any, Debug3DMolViewerProps>(({
  pdbId,
  chainId,
  domains = [],
  height = "400px",
  onStructureLoaded,
  onError,
  showControls = true,
  showLoading = true
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Initializing...')
  const [debugInfo, setDebugInfo] = useState<any>({})

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    viewerRef,
    reset: () => {
      debugLog('Debug3DMolViewer', 'Reset called')
      initializeViewer()
    },
    exportImage: () => {
      if (viewerRef.current) {
        return viewerRef.current.pngURI()
      }
      return null
    }
  }))

  const handleError = (message: string, details?: any) => {
    debugLog('Debug3DMolViewer', `ERROR: ${message}`, details)
    setError(message)
    setLoading(false)
    setStatus(`Error: ${message}`)
    if (onError) onError(message)
  }

  const initializeViewer = async () => {
    if (!containerRef.current) {
      handleError('Container ref not available')
      return
    }

    try {
      debugLog('Debug3DMolViewer', `Initializing viewer for ${pdbId}${chainId ? `_${chainId}` : ''}`)
      setLoading(true)
      setError(null)
      setStatus('Loading 3Dmol.js...')

      // Clear previous viewer
      if (viewerRef.current) {
        debugLog('Debug3DMolViewer', 'Clearing previous viewer')
        viewerRef.current.clear()
        viewerRef.current = null
      }

      // Clear container
      containerRef.current.innerHTML = ''

      // Dynamically import 3Dmol
      setStatus('Importing 3Dmol library...')
      const $3Dmol = await import('3dmol')
      debugLog('Debug3DMolViewer', '3Dmol library loaded')

      // Create viewer
      setStatus('Creating viewer...')
      const viewer = ($3Dmol as any).createViewer(containerRef.current, {
        defaultcolors: ($3Dmol as any).rasmolElementColors
      })
      viewerRef.current = viewer
      debugLog('Debug3DMolViewer', 'Viewer created')

      // Fetch structure
      setStatus(`Fetching structure ${pdbId}...`)
      const pdbUrl = `/api/pdb/${pdbId.toLowerCase()}`
      debugLog('Debug3DMolViewer', `Fetching from: ${pdbUrl}`)

      const response = await fetch(pdbUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch PDB: ${response.status} ${response.statusText}`)
      }

      const pdbData = await response.text()
      debugLog('Debug3DMolViewer', `PDB data loaded, length: ${pdbData.length}`)

      // Add model to viewer
      setStatus('Adding model to viewer...')
      const model = viewer.addModel(pdbData, 'pdb')
      debugLog('Debug3DMolViewer', 'Model added to viewer')

      // Apply chain filter if specified
      let selection: any = {}
      if (chainId) {
        selection.chain = chainId
        debugLog('Debug3DMolViewer', `Applying chain filter: ${chainId}`)
      }

      // Set basic style
      setStatus('Applying styles...')
      viewer.setStyle(selection, {
        cartoon: { color: 'lightgray' },
        stick: { radius: 0.2 }
      })
      debugLog('Debug3DMolViewer', 'Basic styles applied')

      // Apply domain styles using pdb_range
      if (domains && domains.length > 0) {
        setStatus(`Styling ${domains.length} domains...`)
        domains.forEach((domain, index) => {
          // Use threeDMolRanges if available (processed), otherwise try to parse pdb_range
          let ranges = domain.threeDMolRanges || []

          if (ranges.length === 0 && domain.pdb_range) {
            // Parse pdb_range on the fly if not pre-processed
            const cleanRange = domain.pdb_range.includes(':')
              ? domain.pdb_range.split(':')[1]
              : domain.pdb_range
            ranges = cleanRange.split(',').map((r: string) => r.trim()).filter((r: string) => r.includes('-'))
          }

          // Fallback to start-end if no ranges available
          if (ranges.length === 0 && domain.start && domain.end) {
            ranges = [`${domain.start}-${domain.end}`]
          }

          if (ranges.length === 0) {
            debugLog('Debug3DMolViewer', `⚠️ Domain ${index + 1} has no valid ranges:`, domain)
            return
          }

          const domainColor = domain.color || '#FF6B35'

          // Apply style to each range (handles discontinuous domains)
          ranges.forEach((range: string, rangeIndex: number) => {
            const domainSelection = {
              ...selection,
              resi: range
            }

            viewer.setStyle(domainSelection, {
              cartoon: { color: domainColor },
              stick: { color: domainColor, radius: 0.3 }
            })

            debugLog('Debug3DMolViewer', `Domain ${index + 1}, range ${rangeIndex + 1} styled`, {
              id: domain.id,
              range: range,
              color: domainColor,
              pdb_range: domain.pdb_range
            })
          })
        })
      }

      // Center and render
      setStatus('Rendering structure...')
      viewer.zoomTo(selection)
      viewer.render()
      debugLog('Debug3DMolViewer', 'Initial render complete')

      // Update state
      setLoading(false)
      setStatus('Structure loaded successfully')
      setDebugInfo({
        pdbId,
        chainId,
        domainCount: domains.length,
        loadTime: new Date().toISOString()
      })

      // Call success callback
      if (onStructureLoaded) {
        debugLog('Debug3DMolViewer', 'Calling onStructureLoaded callback')
        onStructureLoaded()
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      handleError(`Failed to load structure: ${errorMessage}`, err)
    }
  }

  // Initialize viewer when component mounts or key props change
  useEffect(() => {
    debugLog('Debug3DMolViewer', 'Effect triggered - initializing viewer', {
      pdbId,
      chainId,
      domainCount: domains.length
    })

    const timer = setTimeout(() => {
      initializeViewer()
    }, 100) // Small delay to ensure DOM is ready

    return () => {
      debugLog('Debug3DMolViewer', 'Component unmounting - clearing timer')
      clearTimeout(timer)
    }
  }, [pdbId, chainId]) // Only re-initialize on PDB/chain change

  // Re-style when domains change (without full re-initialization)
  // Use useMemo to prevent unnecessary re-styling
  const domainSignature = useMemo(() => {
    return domains.map(d => {
      const ranges = d.threeDMolRanges || (d.pdb_range ? [d.pdb_range] : [`${d.start || 1}-${d.end || 100}`])
      return `${d.id}-${ranges.join(',')}-${d.color}`
    }).join('|')
  }, [domains])

  useEffect(() => {
    if (viewerRef.current && !loading && !error && domainSignature) {
      debugLog('Debug3DMolViewer', 'Domains changed - re-styling', domains.length)

      // Clear existing styles
      let selection: any = {}
      if (chainId) {
        selection.chain = chainId
      }

      // Reset to basic style
      viewerRef.current.setStyle(selection, {
        cartoon: { color: 'lightgray' },
        stick: { radius: 0.2 }
      })

      // Apply domain styles using pdb_range approach
      domains.forEach((domain, index) => {
        // Use threeDMolRanges if available (processed), otherwise try to parse pdb_range
        let ranges = domain.threeDMolRanges || []

        if (ranges.length === 0 && domain.pdb_range) {
          // Parse pdb_range on the fly if not pre-processed
          const cleanRange = domain.pdb_range.includes(':')
            ? domain.pdb_range.split(':')[1]
            : domain.pdb_range
          ranges = cleanRange.split(',').map((r: string) => r.trim()).filter((r: string) => r.includes('-'))
        }

        // Fallback to start-end if no ranges available
        if (ranges.length === 0 && domain.start && domain.end) {
          ranges = [`${domain.start}-${domain.end}`]
        }

        if (ranges.length === 0) {
          debugLog('Debug3DMolViewer', `⚠️ Domain ${index + 1} has no valid ranges for re-styling:`, domain)
          return
        }

        const domainColor = domain.color || '#FF6B35'

        // Apply style to each range (handles discontinuous domains)
        ranges.forEach((range: string, rangeIndex: number) => {
          const domainSelection = {
            ...selection,
            resi: range
          }

          viewerRef.current.setStyle(domainSelection, {
            cartoon: { color: domainColor },
            stick: { color: domainColor, radius: 0.3 }
          })

          debugLog('Debug3DMolViewer', `Re-styled domain ${index + 1}, range ${rangeIndex + 1}:`, {
            range: range,
            color: domainColor,
            pdb_range: domain.pdb_range
          })
        })
      })

      viewerRef.current.render()
    }
  }, [domainSignature, chainId, loading, error])

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Main viewer container */}
      <div
        ref={containerRef}
        className="w-full h-full border border-gray-200 rounded-lg"
        style={{ minHeight: '300px' }}
      />

      {/* Loading overlay */}
      {loading && showLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <div className="text-sm text-gray-600">{status}</div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/90 rounded-lg">
          <div className="text-red-600 text-center p-4">
            <div className="font-medium">Failed to load structure</div>
            <div className="text-sm mt-1">{error}</div>
            <button
              onClick={initializeViewer}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Debug info */}
      {!loading && !error && (
        <div className="absolute top-2 right-2">
          <details className="bg-white/90 p-2 rounded text-xs">
            <summary className="cursor-pointer">Debug</summary>
            <div className="mt-1 space-y-1">
              <div>PDB: {pdbId}</div>
              <div>Chain: {chainId || 'All'}</div>
              <div>Domains: {domains.length}</div>
              <div>Status: {status}</div>
              {domains.length > 0 && (
                <div className="mt-2">
                  <strong>Domain Ranges:</strong>
                  {domains.slice(0, 3).map((d, i) => (
                    <div key={i} className="text-xs">
                      {i + 1}: pdb_range={d.pdb_range || 'none'}, ranges={JSON.stringify(d.threeDMolRanges)}
                    </div>
                  ))}
                  {domains.length > 3 && <div>...and {domains.length - 3} more</div>}
                </div>
              )}
            </div>
          </details>
        </div>
      )}
      
      {/* Controls */}
      {showControls && !loading && !error && (
        <div className="absolute bottom-2 left-2 flex gap-1">
          <button
            onClick={() => viewerRef.current?.zoomTo(chainId ? { chain: chainId } : {})}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Reset View
          </button>
          <button
            onClick={initializeViewer}
            className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  )
})

Debug3DMolViewer.displayName = 'Debug3DMolViewer'

export default Debug3DMolViewer
