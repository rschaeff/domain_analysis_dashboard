'use client'

import React from 'react'
import { MOLSTAR_CONFIG } from '@/lib/config'
import { MolStarViewerProps } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Play, Pause, RotateCcw, Download } from 'lucide-react'

export function StructureViewer({
  pdb_id,
  chain_id,
  domains = [],
  onDomainClick
}: MolStarViewerProps) {
  // This is a placeholder component for Mol* integration
  // In a real implementation, this would embed the Mol* viewer

  const handleLoadStructure = () => {
    // Placeholder for loading structure in Mol*
    console.log(`Loading structure: ${pdb_id}`)
  }

  const handleHighlightDomain = (domain: any) => {
    // Placeholder for highlighting domain in Mol*
    console.log(`Highlighting domain: ${domain.start}-${domain.end}`)
    onDomainClick?.(domain)
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Structure Viewer - {pdb_id}_{chain_id}
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleLoadStructure}>
              <Play className="w-4 h-4 mr-1" />
              Load
            </Button>
            <Button size="sm" variant="outline">
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Placeholder for Mol* viewer */}
        <div className="relative">
          <div className="aspect-video bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-500 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 9l3-3 3 3"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Mol* Structure Viewer
              </h4>
              <p className="text-gray-600 mb-4">
                Interactive 3D visualization of protein structure with domain highlighting
              </p>
              <Button onClick={handleLoadStructure}>
                Load Structure: {pdb_id}
              </Button>
            </div>
          </div>

          {/* Viewer controls overlay */}
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
                      style={{ backgroundColor: domain.color }}
                    ></div>
                    <button
                      onClick={() => handleHighlightDomain(domain)}
                      className="text-left hover:text-blue-600 transition-colors"
                    >
                      {domain.label} ({domain.start}-{domain.end})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Domain selection panel */}
        {domains.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">Domain Selection</h4>
            <div className="flex flex-wrap gap-2">
              {domains.map((domain, index) => (
                <button
                  key={index}
                  onClick={() => handleHighlightDomain(domain)}
                  className="px-3 py-1 text-sm border rounded-full hover:bg-gray-50 transition-colors"
                  style={{ borderColor: domain.color }}
                >
                  {domain.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Integration guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Mol* Integration Guide
          </h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• Structure loaded from PDB: {pdb_id}</p>
            <p>• Chain focus: {chain_id}</p>
            <p>• Domain boundaries will be highlighted in different colors</p>
            <p>• Click domains to focus and analyze regions of interest</p>
            <p>• Use controls to rotate, zoom, and change representations</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
