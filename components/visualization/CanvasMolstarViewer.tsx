'use client'

import React, { useEffect, useRef, useState } from 'react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec'
import { PluginContext } from 'molstar/lib/mol-plugin/context'
import 'molstar/build/viewer/molstar.css'

interface CanvasMolstarViewerProps {
  pdbId: string
  chainId?: string
  height?: string | number
  width?: string | number
  className?: string
  onReady?: (plugin: PluginContext) => void
  onError?: (error: string) => void
  useLocalRepository?: boolean
  format?: 'auto' | 'pdb' | 'mmcif' | 'mmtf'  // Format preference
}

export function CanvasMolstarViewer({
  pdbId,
  chainId,
  height = '400px',
  width = '100%',
  className = '',
  onReady,
  onError,
  useLocalRepository = true,
  format = 'auto'  // Auto-detect by default
}: CanvasMolstarViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const pluginRef = useRef<PluginContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !parentRef.current) return

    const canvas = canvasRef.current
    const parent = parentRef.current

    // Clean up previous instance
    if (pluginRef.current) {
      pluginRef.current.dispose()
      pluginRef.current = null
    }

    const initMolstar = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Create plugin with custom spec
        const plugin = new PluginContext(DefaultPluginSpec())
        await plugin.init()

        // Initialize the viewer with our canvas
        if (!plugin.initViewer(canvas, parent)) {
          throw new Error('Failed to initialize Mol* viewer')
        }

        // Store reference to plugin
        pluginRef.current = plugin

        // Set background
        plugin.canvas3d?.setProps({
          backgroundColor: { color: 'white' }
        })

        // Determine URL based on data source
        let url
        let detectedFileFormat

        if (useLocalRepository) {
          // Use local API
          url = `/api/pdb/${pdbId.toLowerCase()}`

          try {
            // Make a HEAD request to check format
            const response = await fetch(url, { method: 'HEAD' })
            detectedFileFormat = response.headers.get('X-PDB-Format') || 'pdb'
            console.log(`Detected format from server: ${detectedFileFormat}`)
          } catch (e) {
            console.warn('Could not detect format from server, using default', e)
            detectedFileFormat = 'pdb'
          }
        } else {
          // Use external source
          if (format === 'auto' || format === 'mmcif') {
            url = `https://files.rcsb.org/download/${pdbId}.cif`
            detectedFileFormat = 'mmcif'
          } else if (format === 'pdb') {
            url = `https://files.rcsb.org/download/${pdbId}.pdb`
            detectedFileFormat = 'pdb'
          } else if (format === 'mmtf') {
            url = `https://mmtf.rcsb.org/v1.0/full/${pdbId}`
            detectedFileFormat = 'mmtf'
          } else {
            url = `https://files.rcsb.org/download/${pdbId}.cif`
            detectedFileFormat = 'mmcif'
          }
        }

        setDetectedFormat(detectedFileFormat)
        console.log(`Loading ${pdbId} from ${url} as ${detectedFileFormat}`)

        // Load structure
        const data = await plugin.builders.data.download({ url, isBinary: detectedFileFormat === 'mmtf' }, { state: { isGhost: true } })

        if (!data) {
          throw new Error(`Failed to download structure ${pdbId}`)
        }

        // Parse using detected format
        const trajectory = await plugin.builders.structure.parseTrajectory(data, detectedFileFormat as any)
        await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default')

        // Focus on chain if specified
        if (chainId) {
          await plugin.builders.structure.selection.selectChain({ chain_id: chainId })
        }

        // Notify ready
        setIsLoading(false)
        if (onReady) onReady(plugin)
      } catch (err) {
        console.error('Error initializing Mol*:', err)
        const errorMessage = `Failed to load: ${err instanceof Error ? err.message : String(err)}`
        setError(errorMessage)
        setIsLoading(false)
        if (onError) onError(errorMessage)
      }
    }

    initMolstar()

    // Clean up on unmount
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose()
        } catch (e) {
          console.error('Error disposing Mol* plugin:', e)
        }
      }
    }
  }, [pdbId, chainId, onReady, onError, useLocalRepository, format])

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-red-500 bg-white p-4 rounded shadow">
            {error}
          </div>
        </div>
      )}

      <div ref={parentRef} className="w-full h-full" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </div>

      {detectedFormat && !error && !isLoading && (
        <div className="absolute bottom-2 right-2 bg-white/80 text-xs px-2 py-1 rounded">
          Format: {detectedFormat}
        </div>
      )}
    </div>
  )
}
