// app/domain-visualization/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

// Dynamically import the visualization components to avoid SSR issues
const DomainStructureViewer = dynamic(
  () => import('@/components/visualization/ClientDomainStructureViewer').then(mod => ({ default: mod.DomainStructureViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
        <span className="ml-2">Loading viewer...</span>
      </div>
    )
  }
)

const CanvasMolstarViewer = dynamic(
  () => import('@/components/visualization/CanvasMolstarViewer').then(mod => ({ default: mod.CanvasMolstarViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
        <span className="ml-2">Loading viewer...</span>
      </div>
    )
  }
)

// Mapping of t_groups to colors for consistent coloring
const T_GROUP_COLORS: Record<string, string> = {
  // Alpha proteins
  '1.10.8': '#FF5733', // Alpha-horseshoe
  '1.20.5': '#FFC300', // Alpha-solenoid
  '1.10.10': '#DAF7A6', // Orthogonal Bundle
  '1.20.120': '#C70039', // Up-down Bundle

  // Beta proteins
  '2.40.50': '#900C3F', // Beta-barrel
  '2.60.40': '#581845', // Beta-sandwich
  '2.30.30': '#2471A3', // Beta-trefoil

  // Alpha/Beta proteins
  '3.40.50': '#1ABC9C', // Rossmann fold
  '3.30.70': '#2E86C1', // TIM barrel
  '3.90.1580': '#8E44AD', // ATP-binding domain

  // Other groups
  '4.10.220': '#7D3C98', // Immunoglobulin-like
  '4.10.520': '#138D75', // SH3-like

  // Default colors for other groups
  'default': '#3498DB' // Default blue
};

// Sample domain data for testing
const EXAMPLE_DOMAINS = {
  '1cbs_A': [
    { id: 'domain1', pdb_id: '1cbs', chain_id: 'A', start: 1, end: 137, t_group: '3.40.50', h_group: '3.40', confidence: 0.98 }
  ],
  '4hhb_A': [
    { id: 'domain1', pdb_id: '4hhb', chain_id: 'A', start: 1, end: 141, t_group: '1.10.490', h_group: '1.10', confidence: 0.99 }
  ],
  '7bv2_A': [
    { id: 'domain1', pdb_id: '7bv2', chain_id: 'A', start: 1, end: 104, t_group: '2.40.50', h_group: '2.40', confidence: 0.97 },
    { id: 'domain2', pdb_id: '7bv2', chain_id: 'A', start: 105, end: 216, t_group: '2.40.128', h_group: '2.40', confidence: 0.96 },
    { id: 'domain3', pdb_id: '7bv2', chain_id: 'A', start: 217, end: 328, t_group: '3.40.50', h_group: '3.40', confidence: 0.98 }
  ]
}

export default function DomainVisualizationPage() {
  // Client-side only flag
  const [mounted, setMounted] = useState(false)

  // State for structure selection
  const [pdbId, setPdbId] = useState('1cbs')
  const [chainId, setChainId] = useState('A')
  const [inputPdbId, setInputPdbId] = useState('1cbs')
  const [inputChainId, setInputChainId] = useState('A')

  // State for domain customization
  const [colorByClassification, setColorByClassification] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [activeTab, setActiveTab] = useState('domain-viewer')

  // State for custom domain
  const [customDomains, setCustomDomains] = useState<Array<{id: string, start: number, end: number, color: string}>>([
    { id: 'domain1', start: 1, end: 100, color: '#3b82f6' }
  ])
  const [newDomain, setNewDomain] = useState({
    start: 101,
    end: 200,
    color: '#ef4444'
  })

  // Ensure client-side only rendering for Mol* components
  useEffect(() => {
    setMounted(true)
  }, [])

  // Get domains for the current selection
  const selectedDomains = EXAMPLE_DOMAINS[`${pdbId}_${chainId}` as keyof typeof EXAMPLE_DOMAINS] || []

  // Handle structure loading
  const handleLoadStructure = (e: React.FormEvent) => {
    e.preventDefault()
    setPdbId(inputPdbId)
    setChainId(inputChainId)
  }

  // Add custom domain
  const handleAddDomain = () => {
    if (newDomain.start > newDomain.end) {
      alert('Start position must be less than or equal to end position')
      return
    }

    setCustomDomains(prev => [
      ...prev,
      {
        id: `domain${prev.length + 1}`,
        start: newDomain.start,
        end: newDomain.end,
        color: newDomain.color
      }
    ])

    // Update for next domain
    setNewDomain({
      start: newDomain.end + 1,
      end: newDomain.end + 100,
      color: getRandomColor()
    })
  }

  // Remove custom domain
  const handleRemoveDomain = (domainId: string) => {
    setCustomDomains(prev => prev.filter(d => d.id !== domainId))
  }

  // Clear all custom domains
  const handleClearDomains = () => {
    setCustomDomains([])
  }

  // Generate random color
  function getRandomColor() {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  if (!mounted) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Protein Domain Visualization</h1>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
          <span className="ml-3">Loading visualization tools...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Protein Domain Visualization</h1>

      {/* Structure Selection */}
      <Card className="p-6">
        <form onSubmit={handleLoadStructure} className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Select Structure</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">PDB ID</label>
              <Input
                value={inputPdbId}
                onChange={(e) => setInputPdbId(e.target.value.toLowerCase())}
                placeholder="Enter PDB ID (e.g., 1cbs)"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Chain ID</label>
              <Input
                value={inputChainId}
                onChange={(e) => setInputChainId(e.target.value.toUpperCase())}
                placeholder="Enter Chain ID (e.g., A)"
                maxLength={1}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit">Load Structure</Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInputPdbId('4hhb')
                setInputChainId('A')
                setPdbId('4hhb')
                setChainId('A')
              }}
            >
              Hemoglobin (4HHB)
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInputPdbId('7bv2')
                setInputChainId('A')
                setPdbId('7bv2')
                setChainId('A')
              }}
            >
              Multi-domain (7BV2)
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="domain-viewer">Domain Viewer</TabsTrigger>
          <TabsTrigger value="custom-domains">Custom Domains</TabsTrigger>
        </TabsList>

        {/* Domain Viewer */}
        <TabsContent value="domain-viewer">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visualization */}
            <div className="lg:col-span-2">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Domain Visualization</h2>

                <div className="h-[500px] rounded border">
                  <DomainStructureViewer
                    pdbId={pdbId}
                    chainId={chainId}
                    domainData={selectedDomains}
                    colorByClassification={colorByClassification}
                    showLabels={showLabels}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={colorByClassification}
                      onChange={() => setColorByClassification(!colorByClassification)}
                    />
                    <span>Color by Classification</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showLabels}
                      onChange={() => setShowLabels(!showLabels)}
                    />
                    <span>Show Domain Labels</span>
                  </label>
                </div>
              </Card>
            </div>

            {/* Domain Info */}
            <div>
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Domain Information</h2>

                {selectedDomains.length === 0 ? (
                  <div className="text-center p-6 border rounded bg-gray-50">
                    <p className="text-gray-500">No domain information available for {pdbId}_{chainId}</p>
                    <p className="text-sm text-gray-400 mt-2">Try a different PDB/chain or create custom domains</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm">
                      <strong>{selectedDomains.length}</strong> domains found in {pdbId}_{chainId}
                    </div>

                    {selectedDomains.map((domain, index) => (
                      <div key={domain.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{
                              backgroundColor: colorByClassification && domain.t_group ?
                                (domain.t_group in T_GROUP_COLORS ? T_GROUP_COLORS[domain.t_group] : T_GROUP_COLORS.default) :
                                `hsl(${index * 137 % 360}, 70%, 50%)`
                            }}
                          ></div>
                          <div className="font-medium">Domain {index + 1}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <span className="text-gray-500">Range:</span> {domain.start}-{domain.end}
                          </div>
                          <div>
                            <span className="text-gray-500">Length:</span> {domain.end - domain.start + 1} residues
                          </div>
                          {domain.t_group && (
                            <div>
                              <span className="text-gray-500">T-Group:</span> {domain.t_group}
                            </div>
                          )}
                          {domain.h_group && (
                            <div>
                              <span className="text-gray-500">H-Group:</span> {domain.h_group}
                            </div>
                          )}
                          {domain.confidence !== undefined && (
                            <div>
                              <span className="text-gray-500">Confidence:</span> {(domain.confidence * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Custom Domains */}
        <TabsContent value="custom-domains">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visualization */}
            <div className="lg:col-span-2">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Custom Domain Visualization</h2>

                <div className="h-[500px] rounded border">
                  <CanvasMolstarViewer
                    pdbId={pdbId}
                    chainId={chainId}
                    domains={customDomains}
                    height="100%"
                    useLocalRepository={false}
                  />
                </div>
              </Card>
            </div>
            
            {/* Domain Editor */}
            <div>
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Create Custom Domains</h2>
                
                <div className="space-y-6">
                  {/* Domain Creator */}
                  <div className="space-y-4 border-b pb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Start Position</label>
                        <Input
                          type="number"
                          value={newDomain.start}
                          onChange={(e) => setNewDomain({...newDomain, start: parseInt(e.target.value) || 1})}
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">End Position</label>
                        <Input
                          type="number"
                          value={newDomain.end}
                          onChange={(e) => setNewDomain({...newDomain, end: parseInt(e.target.value) || 1})}
                          min="1"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={newDomain.color}
                          onChange={(e) => setNewDomain({...newDomain, color: e.target.value})}
                          className="h-10 w-10"
                        />
                        <Input
                          type="text"
                          value={newDomain.color}
                          onChange={(e) => setNewDomain({...newDomain, color: e.target.value})}
                        />
                      </div>
                    </div>
                    
                    <Button onClick={handleAddDomain} className="w-full">
                      Add Domain
                    </Button>
                  </div>
                  
                  {/* Domain List */}
                  <div>
                    <div className="flex justify-between mb-3">
                      <h3 className="font-medium">Defined Domains</h3>
                      {customDomains.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleClearDomains}>
                          Clear All
                        </Button>
                      )}
                    </div>
                    
                    {customDomains.length === 0 ? (
                      <div className="text-center p-4 border rounded bg-gray-50">
                        <p className="text-gray-500">No custom domains defined</p>
                        <p className="text-sm text-gray-400 mt-1">Use the form above to create domains</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {customDomains.map(domain => (
                          <div key={domain.id} className="flex items-center justify-between p-2 border rounded bg-gray-50">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: domain.color }}
                              ></div>
                              <span>
                                {domain.id}: {domain.start}-{domain.end}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveDomain(domain.id)}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Instructions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-2">How to Use</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Enter a PDB ID and chain ID, then click "Load Structure" to visualize protein structure</li>
          <li>Use the "Domain Viewer" tab to see predicted domains based on structure classification</li>
          <li>Use the "Custom Domains" tab to create your own domain definitions</li>
          <li>Click and drag to rotate the structure, scroll to zoom, right-click and drag to pan</li>
          <li>Domain colors can be based on structure classification or customized</li>
        </ul>
      </Card>
    </div>
  )
}
