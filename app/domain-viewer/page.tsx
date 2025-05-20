// app/domain-viewer/page.tsx
'use client'

import React, { useState, useRef, useCallback } from 'react'
import { CanvasMolstarViewer, Domain, FormatType } from '@/components/visualization/CanvasMolstarViewer'
import { PluginContext } from 'molstar/lib/mol-plugin/context'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Switch } from '@/components/ui/Switch'

export default function DomainViewerPage() {
  // State for PDB and chain input
  const [pdbId, setPdbId] = useState('1cbs')
  const [chainId, setChainId] = useState('A')
  const [inputPdbId, setInputPdbId] = useState('1cbs')
  const [inputChainId, setInputChainId] = useState('A')

  // State for data source and format
  const [useLocalRepository, setUseLocalRepository] = useState(true)
  const [fileFormat, setFileFormat] = useState<FormatType>('auto')
  const [representation, setRepresentation] = useState<'cartoon' | 'ball-and-stick' | 'surface' | 'spacefill'>('cartoon')

  // State for viewer
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const pluginRef = useRef<PluginContext | null>(null)
  
  // State for domains
  const [domains, setDomains] = useState<Domain[]>([
    { id: 'domain1', start: 1, end: 75, color: '#3b82f6', label: 'Domain 1' },
  ])
  const [currentDomain, setCurrentDomain] = useState<Domain>({ id: 'domain2', start: 76, end: 135, color: '#ef4444', label: 'Domain 2' })
  const [showDomains, setShowDomains] = useState(true)

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

  // Add domain
  const handleAddDomain = () => {
    if (currentDomain.start > currentDomain.end) {
      alert('Start residue must be less than or equal to end residue')
      return
    }
    
    setDomains(prev => [...prev, { ...currentDomain, id: `domain${prev.length + 1}` }])
    
    // Reset current domain with incremented residue numbers
    setCurrentDomain({
      id: `domain${domains.length + 2}`,
      start: currentDomain.end + 1,
      end: currentDomain.end + 75,
      color: getRandomColor(),
      label: `Domain ${domains.length + 2}`
    })
  }

  // Delete domain
  const handleDeleteDomain = (domainId: string) => {
    setDomains(prev => prev.filter(d => d.id !== domainId))
  }

  // Clear all domains
  const handleClearDomains = () => {
    setDomains([])
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
        link.download = `${pdbId}_${chainId}_domains.png`
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
  const handleChangeRepresentation = (newRepresentation: 'cartoon' | 'ball-and-stick' | 'surface' | 'spacefill') => {
    setRepresentation(newRepresentation)
  }

  // Generate random color
  const getRandomColor = () => {
    const colors = ['#3b82f6', '#ef4444', '#16a34a', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#f97316']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Protein Domain Viewer</h1>

      {/* PDB and Chain Input */}
      <Card className="p-4">
        <form onSubmit={handleLoadStructure} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">PDB ID</label>
            <Input
              type="text"
              value={inputPdbId}
              onChange={(e) => setInputPdbId(e.target.value.toLowerCase())}
              placeholder="e.g., 1cbs"
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium mb-1">Chain ID</label>
            <Input
              type="text"
              value={inputChainId}
              onChange={(e) => setInputChainId(e.target.value.toUpperCase())}
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
            <div className="rounded overflow-hidden border" style={{ height: '600px' }}>
              <CanvasMolstarViewer
                pdbId={pdbId}
                chainId={chainId}
                height="100%"
                onReady={handleViewerReady}
                onError={handleViewerError}
                useLocalRepository={useLocalRepository}
                format={fileFormat}
                initialRepresentation={representation}
                domains={showDomains ? domains : []}
                backgroundColor="#ffffff"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => pluginRef.current?.canvas3d?.resetCamera()}
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
          <Tabs defaultValue="domains">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="domains">Domains</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            
            {/* Domains Tab */}
            <TabsContent value="domains">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Switch 
                    id="show-domains" 
                    checked={showDomains}
                    onCheckedChange={setShowDomains}
                  />
                  <Label htmlFor="show-domains">Show Domains</Label>
                </div>
                
                {/* Add Domain Form */}
                <div className="mb-4 p-3 border rounded bg-gray-50">
                  <h3 className="text-sm font-medium mb-2">Add New Domain</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs mb-1">Start Residue</label>
                      <Input 
                        type="number" 
                        value={currentDomain.start} 
                        onChange={(e) => setCurrentDomain({...currentDomain, start: parseInt(e.target.value) || 1})}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">End Residue</label>
                      <Input 
                        type="number" 
                        value={currentDomain.end} 
                        onChange={(e) => setCurrentDomain({...currentDomain, end: parseInt(e.target.value) || 1})}
                        min="1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-xs mb-1">Label</label>
                      <Input 
                        type="text" 
                        value={currentDomain.label || ''} 
                        onChange={(e) => setCurrentDomain({...currentDomain, label: e.target.value})}
                        placeholder="Domain name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Color</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={currentDomain.color || '#3b82f6'} 
                          onChange={(e) => setCurrentDomain({...currentDomain, color: e.target.value})}
                          className="w-10 h-8"
                        />
                        <Input 
                          type="text" 
                          value={currentDomain.color || '#3b82f6'} 
                          onChange={(e) => setCurrentDomain({...currentDomain, color: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleAddDomain} className="w-full">Add Domain</Button>
                </div>
                
                {/* Domain List */}
                <div>
                  <div className="flex justify-between mb-2">
                    <h3 className="text-sm font-medium">Domain List</h3>
                    {domains.length > 0 && (
                      <Button size="sm" variant="destructive" onClick={handleClearDomains}>Clear All</Button>
                    )}
                  </div>
                  
                  {domains.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No domains defined</p>
                  ) : (
                    <div className="space-y-2">
                      {domains.map((domain) => (
                        <div key={domain.id} className="flex items-center gap-2 p-2 rounded border">
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: domain.color || '#3b82f6' }}></div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{domain.label || domain.id}</div>
                            <div className="text-xs text-gray-500">Residues {domain.start}-{domain.end}</div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteDomain(domain.id)}>
                            Delete
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>
            
            {/* Display Tab */}
            <TabsContent value="display">
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3">Display Settings</h3>
                
                {/* Representation */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Representation</label>
                  <Select 
                    value={representation} 
                    onValueChange={(value) => handleChangeRepresentation(value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select representation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cartoon">Cartoon</SelectItem>
                      <SelectItem value="ball-and-stick">Ball & Stick</SelectItem>
                      <SelectItem value="surface">Surface</SelectItem>
                      <SelectItem value="spacefill">Spacefill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Data Source */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Data Source</label>
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="use-local" 
                      checked={useLocalRepository}
                      onCheckedChange={setUseLocalRepository}
                    />
                    <Label htmlFor="use-local">Use Local PDB Repository</Label>
                  </div>
                </div>
                
                {/* File Format */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">File Format</label>
                  <Select 
                    value={fileFormat} 
                    onValueChange={(value) => setFileFormat(value as FormatType)}
                    disabled={useLocalRepository}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="mmcif">mmCIF (.cif)</SelectItem>
                      <SelectItem value="pdb">Legacy PDB (.pdb/.ent)</SelectItem>
                      <SelectItem value="mmtf">MMTF (binary)</SelectItem>
                    </SelectContent>
                  </Select>
                  {useLocalRepository && (
                    <p className="text-xs text-gray-500 mt-1">
                      Format auto-detected when using local repository
                    </p>
                  )}
                </div>
                
                {/* Status */}
                <div className="p-3 rounded border bg-gray-50">
                  <div className="text-sm font-medium mb-1">Viewer Status</div>
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
              </Card>
            </TabsContent>
            
            {/* Details Tab */}
            <TabsContent value="details">
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3">Structure Details</h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">PDB ID</div>
                    <div className="text-sm font-medium">{pdbId.toUpperCase()}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Chain ID</div>
                    <div className="text-sm font-medium">{chainId}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Format</div>
                    <div className="text-sm font-medium capitalize">{fileFormat === 'auto' ? 'Auto-detected' : fileFormat}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-500">Domains Defined</div>
                    <div className="text-sm font-medium">{domains.length}</div>
                  </div>
                  
                  <div className="pt-2">
                    <Button size="sm" variant="outline" onClick={() => window.open(`https://www.rcsb.org/structure/${pdbId}`, '_blank')}>
                      View on RCSB PDB
                    </Button>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Quick Help</h4>
                  <ul className="text-xs text-gray-700 space-y-1">
                    <li>• Rotate: Click and drag</li>
                    <li>• Zoom: Scroll or pinch</li>
                    <li>• Pan: Right-click and drag</li>
                    <li>• Reset View: Click "Reset Camera"</li>
                  </ul>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
