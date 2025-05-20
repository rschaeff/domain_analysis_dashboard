'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPluginUI } from 'molstar/lib/mol-plugin-ui'
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec'
import 'molstar/build/viewer/molstar.css'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface CustomMolstarProps {
  pdbId: string
  chainId?: string
  height?: string | number
  width?: string | number
  className?: string
  onReady?: (plugin: any) => void
}

export function CustomMolstar({
  pdbId,
  chainId,
  height = '400px',
  width = '100%',
  className = '',
  onReady
}: CustomMolstarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pluginRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Skip if container isn't available yet
    if (!containerRef.current) return

    // Clean up previous instance
    if (pluginRef.current) {
      pluginRef.current.dispose()
      pluginRef.current = null
    }

    // Initialize Mol*
    const init = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Create a new Mol* plugin instance
        const plugin = await createPluginUI(containerRef.current, {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: true,
              controlsDisplay: 'hidden',
            }
          },
          config: [
            [
              'plugin.config',
              {
                viewportBackground: { color: 'white' },
              },
            ],
          ],
        })

        // Keep reference to plugin
        pluginRef.current = plugin

        // Load the PDB structure
        const url = `https://files.rcsb.org/download/${pdbId}.pdb`
        const data = await plugin.builders.data.download({ url, isBinary: false })
        const trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb')
        await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default')

        // Set default view
        await plugin.canvas3d?.resetCamera()
        await plugin.canvas3d?.setBackground({ color: 'white' })
        
        // If a chain ID is provided, focus on that chain
        if (chainId) {
          await plugin.builders.structure.component.updateComponent({
            label: 'Chain Representation',
            repr: {
              type: 'cartoon',
              params: {},
            },
            selections: [
              { 
                bundle: {
                  type: 'polymer-chain', 
                  params: { 
                    chain_id: chainId 
                  } 
                }
              }
            ]
          })
        }

        setIsLoading(false)
        if (onReady) onReady(plugin)
      } catch (err) {
        console.error('Error initializing Mol*:', err)
        setError('Failed to load structure.')
        setIsLoading(false)
      }
    }

    init()

    // Cleanup on unmount
    return () => {
      if (pluginRef.current) {
        pluginRef.current.dispose()
      }
    }
  }, [pdbId, chainId])

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-50 z-10">
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
      
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ visibility: isLoading ? 'hidden' : 'visible' }}
      />
    </div>
  )
}
