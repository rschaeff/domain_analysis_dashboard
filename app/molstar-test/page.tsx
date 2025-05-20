'use client'

import React, { useState, useRef, useEffect } from 'react'
import { CanvasMolstarViewer } from '@/components/visualization/CanvasMolstarViewer'
import { PluginContext } from 'molstar/lib/mol-plugin/context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export default function MolstarTestPage() {
  // State for PDB and chain input
  const [pdbId, setPdbId] = useState('1cbs')
  const [chainId, setChainId] = useState('A')
  const [inputPdbId, setInputPdbId] = useState('1cbs')
  const [inputChainId, setInputChainId] = useState('A')
  
  // State for viewer
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const pluginRef = useRef<PluginContext | null>(null)
  
  // State for test domain
  const [domainStart, setDomainStart] = useState('1')
  const [domainEnd, setDomainEnd] = useState('100')
  const [domainColor, setDomainColor] = useState('#3b82f6')
  
  // Handle viewer ready
  const handleViewerReady = (plugin: PluginContext) => {
    console.log('Mol* viewer is ready')
    pluginRef.current = plugin
    setIsViewerReady(true)
    setViewerError(null)
  }
  
  // Handle viewer error
  const handleViewerError = (error: string) => {
    console.error('Mol* viewer error:', error)
    setViewerError(error)
    setIsViewerReady(false)
  }
  
  // Load structure
  const handleLoadStructure = (e: React.FormEvent) => {
    e.preventDefault()
    setPdbId(inputPdbId)
    setChainId(inputChainId)
    setIsViewerReady(false)
  }
  
  // Reset camera
  const handleResetCamera = () => {
    if (!pluginRef.current) return
    pluginRef.current.canvas3d?.resetCamera()
  }

  // Add state for format selection
const [fileFormat, setFileFormat] = useState<'auto' | 'pdb' | 'mmcif' | 'mmtf'>('auto')

// In the controls section, add:
<div className="mb-4">
  <div className="text-sm font-medium mb-2">File Format</div>
  <select
    value={fileFormat}
    onChange={(e) => setFileFormat(e.target.value as any)}
    className="w-full px-3 py-2 border rounded"
    disabled={useLocalRepository} // Disable when using local repo (will auto-detect)
  >
    <option value="auto">Auto-detect</option>
    <option value="mmcif">mmCIF (.cif)</option>
    <option value="pdb">Legacy PDB (.pdb/.ent)</option>
    <option value="mmtf">MMTF (binary)</option>
  </select>
  {useLocalRepository && (
    <p className="text-xs text-gray-500 mt-1">
      Format auto-detected when using local repository
    </p>
  )}
</div>

// In the CanvasMolstarViewer component:
<CanvasMolstarViewer
  pdbId={pdbId}
  chainId={chainId}
  height="100%"
  onReady={handleViewerReady}
  onError={handleViewerError}
  useLocalRepository={useLocalRepository}
  format={fileFormat}
/>
  
  // Highlight domain
  const handleHighlightDomain = async () => {
    if (!pluginRef.current || !chainId) return
    
    const start = parseInt(domainStart)
    const end = parseInt(domainEnd)
    
    if (isNaN(start) || isNaN(end) || start > end) {
      alert('Invalid domain range')
      return
    }
    
    try {
      const plugin = pluginRef.current
      
      // Clear representations
      await plugin.builders.structure.representation.clearSelections()
      
      // Add cartoon representation for domain
      await plugin.builders.structure.representation.addRepresentation({
        repr: {
          type: 'cartoon',
          params: {
            alpha: 1,
            colorTheme: { name: 'uniform', params: { color: { name: 'color', params: { value: domainColor } } } }
          }
        },
        selection: {
          entities: [{ chain_id: chainId, residueNumbers: [{ start, end }] }]
        }
      })
      
      // Focus camera on selection
      plugin.canvas3d?.camera.focusOnSelection()
      
    } catch (err) {
      console.error('Error highlighting domain:', err)
      alert(`Failed to highlight domain: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  
  // Take screenshot
  const handleTakeScreenshot = () => {
    if (!pluginRef.current) return
    
    try {
      const canvas = pluginRef.current.canvas3d?.canvas.element
      if (canvas) {
        // Create download link
        const link = document.createElement('a')
        link.href = canvas.toDataURL('image/png')
        link.download = `${pdbId}_${chainId}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      console.error('Error taking screenshot:', err)
      alert(`Failed to take screenshot: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  
  // Change representation
  const handleChangeRepresentation = (representationType: string) => {
    if (!pluginRef.current) return
    
    try {
      const plugin = pluginRef.current
      
      plugin.representation.preset.applyPreset({
        name: representationType
      })
    } catch (err) {
      console.error('Error changing representation:', err)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Mol* Viewer Test Page</h1>
      
      {/* PDB and Chain Input */}
      <Card className="p-4">
        <form onSubmit={handleLoadStructure} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">PDB ID</label>
            <Input 
              type="text" 
              value={inputPdbId} 
              onChange={(e) => setInputPdbId(e.target.value)}
              placeholder="e.g., 1cbs"
              maxLength={4}
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium mb-1">Chain ID</label>
            <Input 
              type="text" 
              value={inputChainId} 
              onChange={(e) => setInputChainId(e.target.value)}
              placeholder="e.g., A"
              maxLength={1}
            />
          </div>
          <div>
            <Button type="submit">Load Structure</Button>
          </div>
        </form>
      </Card>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mol* Viewer */}
        <div className="lg:col-span-2">
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-4">Structure Viewer</h2>
            <div className="rounded overflow-hidden border" style={{ height: '500px' }}>
              <CanvasMolstarViewer
                pdbId={pdbId}
                chainId={chainId}
                height="100%"
                onReady={handleViewerReady}
                onError={handleViewerError}
                useLocalRepository={useLocalRepository}
                format={fileFormat}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetCamera}
                disabled={!isViewerReady}
              >
                Reset Camera
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTakeScreenshot}
                disabled={!isViewerReady}
              >
                Take Screenshot
              </Button>
            </div>
          </Card>
        </div>
        
        {/* Controls */}
        <div>
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-4">Controls</h2>
            
            {/* Status */}
            <div className="mb-4 p-3 rounded border bg-gray-50">
              <div className="text-sm font-medium mb-1">Status</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isViewerReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">
                  {isViewerReady ? 'Viewer Ready' : viewerError ? 'Error' : 'Loading...'}
                </span>
              </div>
              {viewerError && (
                <div className="mt-2 text-sm text-red-500">{viewerError}</div>
              )}
            </div>
              <div className="mb-4">
                  <div className="text-sm font-medium mb-2">File Format</div>
                  <select
                    value={fileFormat}
                    onChange={(e) => setFileFormat(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded"
                    disabled={useLocalRepository} // Disable when using local repo (will auto-detect)
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="mmcif">mmCIF (.cif)</option>
                    <option value="pdb">Legacy PDB (.pdb/.ent)</option>
                    <option value="mmtf">MMTF (binary)</option>
                  </select>
                  {useLocalRepository && (
                    <p className="text-xs text-gray-500 mt-1">
                      Format auto-detected when using local repository
                    </p>
                  )}
              </div>
            {/* Representation Controls */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Representation</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleChangeRepresentation('cartoon')}
                  disabled={!isViewerReady}
                >
                  Cartoon
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleChangeRepresentation('ball-and-stick')}
                  disabled={!isViewerReady}
                >
                  Ball & Stick
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleChangeRepresentation('surface')}
                  disabled={!isViewerReady}
                >
                  Surface
                </Button>
              </div>
            </div>
            
            {/* Domain Highlighting */}
            <div>
              <h3 className="text-sm font-medium mb-2">Domain Highlight</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs mb-1">Start Residue</label>
                    <Input 
                      type="number" 
                      value={domainStart} 
                      onChange={(e) => setDomainStart(e.target.value)}
                      min="1"
                      disabled={!isViewerReady}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs mb-1">End Residue</label>
                    <Input 
                      type="number" 
                      value={domainEnd} 
                      onChange={(e) => setDomainEnd(e.target.value)}
                      min="1"
                      disabled={!isViewerReady}
                    />
                  </div>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={domainColor} 
                        onChange={(e) => setDomainColor(e.target.value)}
                        disabled={!isViewerReady}
                        className="w-10 h-8"
                      />
                      <Input 
                        type="text" 
                        value={domainColor} 
                        onChange={(e) => setDomainColor(e.target.value)}
                        disabled={!isViewerReady}
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleHighlightDomain}
                    disabled={!isViewerReady}
                  >
                    Highlight
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      {/* Help Panel */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">Instructions</h2>
        <div className="space-y-2 text-sm">
          <p>• Enter a PDB ID (e.g., 1cbs, 7bv2) and Chain ID (e.g., A)</p>
          <p>• Click "Load Structure" to fetch and display the protein</p>
          <p>• Use the mouse to rotate (left click + drag), zoom (scroll), and pan (right click + drag)</p>
          <p>• Try different representations from the controls panel</p>
          <p>• Highlight a specific domain by entering start and end residue numbers</p>
          <p>• Take a screenshot to save the current view</p>
        </div>
      </Card>
    </div>
  )
}
