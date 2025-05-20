'use client'

import React, { useEffect, useRef, useState } from 'react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

// Import from mol-plugin, not mol-plugin-ui to avoid React context issues
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
}

export function CanvasMolstarViewer({
  pdbId,
  chainId,
  height = '400px',
  width = '100%',
  className = '',
  onReady,
  onError
}: CanvasMolstarViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const pluginRef = useRef<PluginContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        // Set background (FIXED)
        plugin.canvas3d?.setProps({
          backgroundColor: { color: 'white' }
        })

        // Load structure from PDB
        const url = `https://files.rcsb.org/download/${pdbId}.pdb`
        const data = await plugin.builders.data.download({ url, isBinary: false }, { state: { isGhost: true } })

        if (!data) {
          throw new Error(`Failed to download structure ${pdbId}`)
        }

        const trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb')
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
  }, [pdbId, chainId, onReady, onError])
  
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
    </div>
  )
}
