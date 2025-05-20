'use client'

import React, { useRef, useEffect, useState } from 'react'
import { createPluginUI } from 'molstar/lib/mol-plugin-ui'
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec'
import { Asset } from 'molstar/lib/mol-util/assets'

// Import renderReact18 conditionally (only in client-side)
let renderReact18: any;
if (typeof window !== 'undefined') {
  try {
    // Only attempt to import in browser environment
    renderReact18 = require('molstar/lib/mol-plugin-ui/react18').renderReact18;
  } catch (e) {
    console.warn('Failed to import renderReact18, falling back to default rendering');
  }
}

// Types
interface DirectMolstarViewerProps {
  pdbId: string
  chainId?: string
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
  domains?: Array<{
    id: string
    start: number
    end: number
    color?: string
    label?: string
  }>
  onReady?: (plugin: any) => void
  onError?: (error: string) => void
}

/**
 * A direct implementation of Molstar viewer using the native Molstar components
 * This bypasses our custom context implementation and uses Molstar's own React context
 */
export function DirectMolstarViewer({
  pdbId,
  chainId,
  width = '100%',
  height = '400px',
  className = '',
  style = {},
  domains = [],
  onReady,
  onError
}: DirectMolstarViewerProps) {
  // Refs for container and plugin
  const containerRef = useRef<HTMLDivElement>(null)
  const pluginRef = useRef<any>(null)
  
  // State
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Log handler
  const addLog = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    console[level](`[Molstar] ${message}`)
    
    if (level === 'error') {
      setError(message)
      if (onError) onError(message)
    }
  }
  
  // Initialize Molstar
  useEffect(() => {
    if (!containerRef.current || pluginRef.current) return
    
    const initMolstar = async () => {
      try {
        // Custom UI spec
        const spec = {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: false,
              controlsDisplay: 'reactive',
              regionState: {
                bottom: 'collapsed',
                left: 'collapsed',
                right: 'collapsed',
                top: 'collapsed'
              }
            }
          }
        }
        
        // Create the plugin
        const plugin = await createPluginUI({
          target: containerRef.current!,
          spec,
          render: renderReact18 || undefined
        })
        
        // Store the plugin reference
        pluginRef.current = plugin
        setIsInitialized(true)
        
        // Notify that the plugin is ready
        if (onReady) onReady(plugin)
        
        // Load the initial structure
        loadStructure(plugin, pdbId, chainId)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        addLog(`Failed to initialize Molstar: ${errorMessage}`, 'error')
      }
    }
    
    initMolstar()
    
    // Cleanup on unmount
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose()
          pluginRef.current = null
        } catch (err) {
          console.error('Error disposing Molstar plugin:', err)
        }
      }
    }
  }, [])
  
  // Load structure when pdbId or chainId changes
  useEffect(() => {
    if (!isInitialized || !pluginRef.current) return
    
    loadStructure(pluginRef.current, pdbId, chainId)
  }, [isInitialized, pdbId, chainId])
  
  // Highlight domains when they change
  useEffect(() => {
    if (!isInitialized || !pluginRef.current || domains.length === 0) return
    
    highlightDomains(pluginRef.current, domains, chainId)
  }, [isInitialized, domains, chainId])
  
  // Load structure function
  const loadStructure = async (plugin: any, pdbId: string, chainId?: string) => {
    if (!plugin) return
    
    try {
      setIsLoading(true)
      addLog(`Loading structure: ${pdbId}${chainId ? ` (chain ${chainId})` : ''}`)
      
      // Clear current state
      await plugin.clear()
      
      // Determine URL - either use local API or RCSB
      const url = `/api/pdb/${pdbId.toLowerCase()}`
      
      // Use data transaction for atomic operations
      await plugin.dataTransaction(async () => {
        // Download the data
        const data = await plugin.builders.data.download({ 
          url: Asset.Url(url), 
          isBinary: false 
        })
        
        // Try to parse as mmCIF first
        let trajectory
        try {
          trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif')
        } catch (err) {
          // If mmCIF fails, try PDB format
          addLog('Failed to parse as mmCIF, trying PDB format', 'warn')
          trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb')
        }
        
        // Apply default representation
        const structure = await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', {
          structure: { 
            name: 'model', 
            params: {} 
          },
          showUnitcell: false,
          representationPreset: 'auto'
        })
        
        // Focus on the structure or specific chain
        if (chainId) {
          // Create selection query for the chain
          const selection = {
            query: { 
              'chain-id': { '==': chainId.toUpperCase() }
            },
            descriptions: [{ text: `Chain ${chainId}` }],
          }
          
          // Select and focus
          const sel = plugin.managers.structure.selection.fromSelectionQuery(selection)
          if (sel.structures.length) {
            plugin.managers.camera.focusLoci(sel)
          } else {
            addLog(`Chain ${chainId} not found in structure`, 'warn')
          }
        } else {
          plugin.canvas3d?.resetCamera()
        }
        
        addLog('Structure loaded successfully')
        
        // If domains are provided, highlight them
        if (domains.length > 0) {
          highlightDomains(plugin, domains, chainId)
        }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      addLog(`Error loading structure: ${errorMessage}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Highlight domains
  const highlightDomains = async (plugin: any, domains: any[], chainId?: string) => {
    if (!plugin || domains.length === 0) return
    
    try {
      addLog(`Highlighting ${domains.length} domains`)
      
      // Clear current representations
      await plugin.builders.structure.representation.clearSelections()
      
      // Highlight each domain
      for (const domain of domains) {
        // Create selection query for the domain residues
        const query: any = {
          residueTest: (residue: any) => {
            const seqNumber = residue.seqNumber.value
            return seqNumber >= domain.start && seqNumber <= domain.end
          }
        }
        
        // If chain is specified, add it to the query
        if (chainId) {
          query.chainTest = (chain: any) => {
            return chain.authAsymId === chainId
          }
        }
        
        // Default color if none provided
        const color = domain.color || '#3b82f6'
        
        // Convert color to RGB
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
          return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
          } : { r: 0.2, g: 0.5, b: 0.8 }
        }
        
        const rgbColor = hexToRgb(color)
        
        // Get the current structure
        const structure = plugin.managers.structure.hierarchy.current.structures[0]
        if (!structure) continue
        
        // Add cartoon representation for the domain
        await plugin.builders.structure.representation.addRepresentation(structure, {
          type: 'cartoon',
          color: 'uniform',
          colorParams: { value: rgbColor },
          size: 'uniform',
          sizeParams: { value: 0.6 }
        }, { 
          selector: plugin.helpers.structureSelectionBuilder.withPredicate(
            structure, 
            query
          ) 
        })
      }
      
      // Make sure changes are applied
      plugin.canvas3d?.commit()
      
    } catch (err) {
      addLog(`Error highlighting domains: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }
  
  return (
    <div
      className={`direct-molstar-viewer ${className}`}
      style={{
        position: 'relative',
        width,
        height,
        ...style
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0
        }}
      />
      
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <div>Loading...</div>
        </div>
      )}
      
      {error && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '8px',
          backgroundColor: 'rgba(220, 38, 38, 0.8)',
          color: 'white',
          fontSize: '12px',
          zIndex: 10
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
