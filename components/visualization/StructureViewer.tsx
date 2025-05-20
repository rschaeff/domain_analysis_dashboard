'use client'

import React, { useState, useRef } from 'react'
import { CanvasMolstarViewer } from '@/components/visualization/CanvasMolstarViewer'
import { MolStarViewerProps } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RotateCcw, Download } from 'lucide-react'
import { PluginContext } from 'molstar/lib/mol-plugin/context'

export function StructureViewer({
  pdb_id,
  chain_id,
  domains = [],
  onDomainClick
}: MolStarViewerProps) {
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null)
  const pluginRef = useRef<PluginContext | null>(null)

  const handleViewerReady = (plugin: PluginContext) => {
    pluginRef.current = plugin
    setIsViewerReady(true)
  }

  const handleHighlightDomain = async (domain: any, index: number) => {
    setSelectedDomain(index)
    
    // Attempt to highlight the domain in the 3D structure
    if (pluginRef.current && chain_id) {
      try {
        const plugin = pluginRef.current
        
        // Create a selection for the domain residues
        await plugin.builders.structure.representation.clearSelection()
        
        // Select the domain's residues
        await plugin.builders.structure.representation.addRepresentation({
          repr: {
            type: 'cartoon',
            params: {
              alpha: 1,
              colorTheme: { name: 'uniform', params: { color: { name: 'color', params: { value: domain.color || '#3b82f6' } } } }
            }
          },
          selection: {
            entities: [{ chain_id: chain_id, residueNumbers: [{ start: domain.start, end: domain.end }] }]
          }
        })
      } catch (err) {
        console.error('Error highlighting domain:', err)
      }
    }
    
    if (onDomainClick) onDomainClick(domain)
  }
  
  const handleReset = () => {
    setSelectedDomain(null)
    if (pluginRef.current) {
      // Reset view
      pluginRef.current.canvas3d?.resetCamera()
    }
  }
  
  const handleExport = async () => {
    if (!pluginRef.current) return
    
    try {
      const canvas = pluginRef.current.canvas3d?.canvas.element
      if (canvas) {
        // Create a download link for the canvas image
        const link = document.createElement('a')
        link.href = canvas.toDataURL('image/png')
        link.download = `${pdb_id}_${chain_id}${selectedDomain !== null ? `_domain${domains[selectedDomain].label}` : ''}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      console.error('Error exporting image:', err)
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

        {/* Mol* viewer */}
        <div className="relative">
          <CanvasMolstarViewer
            pdbId={pdb_id}
            chainId={chain_id}
            height="400px"
            onReady={handleViewerReady}
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
                  {domains.map((domain, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: domain.color || '#3b82f6' }}
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
              {domains.map((domain, index) => (
                <button
                  key={index}
                  onClick={() => handleHighlightDomain(domain, index)}
                  className={`px-3 py-1 text-sm border rounded-full ${
                    selectedDomain === index
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  } transition-colors`}
                  style={{ borderColor: domain.color || '#3b82f6' }}
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
