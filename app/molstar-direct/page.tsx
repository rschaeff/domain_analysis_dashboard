'use client'

import React, { useState, useEffect } from 'react'
import { DirectMolstarViewer } from '@/components/visualization/DirectMolstarViewer'

export default function MolstarDirectPage() {
  // State
  const [pdbId, setPdbId] = useState('1cbs')
  const [chainId, setChainId] = useState('A')
  const [logs, setLogs] = useState<string[]>([])
  const [pluginReady, setPluginReady] = useState(false)
  const [inputPdbId, setInputPdbId] = useState('1cbs')
  const [inputChainId, setInputChainId] = useState('A')
  
  // Sample domains for testing
  const [domains, setDomains] = useState([
    { id: 'domain1', start: 1, end: 75, color: '#3b82f6', label: 'Domain 1' }
  ])
  
  // Domain form state
  const [domainStart, setDomainStart] = useState(76)
  const [domainEnd, setDomainEnd] = useState(137)
  const [domainColor, setDomainColor] = useState('#ef4444')
  const [domainLabel, setDomainLabel] = useState('Domain 2')
  
  // Ensure client-side rendering
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Handler for plugin ready
  const handlePluginReady = (plugin: any) => {
    setPluginReady(true)
    addLog('Molstar plugin is ready')
  }
  
  // Handler for plugin error
  const handlePluginError = (error: string) => {
    addLog(`Error: ${error}`, 'error')
  }
  
  // Logger
  const addLog = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    
    // Also log to console with appropriate level
    console[level](`[Molstar] ${message}`)
  }
  
  // Load structure
  const handleLoadStructure = () => {
    addLog(`Loading ${inputPdbId}${inputChainId ? ` chain ${inputChainId}` : ''}`)
    setPdbId(inputPdbId)
    setChainId(inputChainId)
  }
  
  // Add domain
  const handleAddDomain = () => {
    if (domainStart > domainEnd) {
      alert('Start position must be less than end position')
      return
    }
    
    const newDomain = {
      id: `domain${domains.length + 1}`,
      start: domainStart,
      end: domainEnd,
      color: domainColor,
      label: domainLabel
    }
    
    setDomains(prev => [...prev, newDomain])
    
    // Reset form with incremented values
    setDomainStart(domainEnd + 1)
    setDomainEnd(domainEnd + 75)
    setDomainLabel(`Domain ${domains.length + 2}`)
    setDomainColor(getRandomColor())
    
    addLog(`Added domain ${newDomain.label} (${newDomain.start}-${newDomain.end})`)
  }
  
  // Clear domains
  const handleClearDomains = () => {
    setDomains([])
    addLog('Cleared all domains')
  }
  
  // Random color generator
  const getRandomColor = (): string => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
    return colors[Math.floor(Math.random() * colors.length)]
  }
  
  // Examples
  const examples = [
    { id: '1cbs', name: 'Cellular Retinoic Acid-Binding Protein', chain: 'A' },
    { id: '4hhb', name: 'Hemoglobin', chain: 'A' },
    { id: '1bna', name: 'B-DNA Dodecamer', chain: 'A' },
    { id: '7bv2', name: 'Multi-domain Protein', chain: 'A' }
  ]
  
  // Load example
  const loadExample = (id: string, chain: string) => {
    setInputPdbId(id)
    setInputChainId(chain)
    setPdbId(id)
    setChainId(chain)
    
    // Reset domains based on example
    if (id === '1cbs') {
      setDomains([
        { id: 'domain1', start: 1, end: 137, color: '#3b82f6', label: 'Domain 1' }
      ])
    } else if (id === '4hhb') {
      setDomains([
        { id: 'domain1', start: 1, end: 141, color: '#3b82f6', label: 'Domain 1' }
      ])
    } else if (id === '7bv2') {
      setDomains([
        { id: 'domain1', start: 1, end: 104, color: '#3b82f6', label: 'Domain 1' },
        { id: 'domain2', start: 105, end: 216, color: '#ef4444', label: 'Domain 2' },
        { id: 'domain3', start: 217, end: 328, color: '#10b981', label: 'Domain 3' }
      ])
    } else {
      setDomains([])
    }
    
    addLog(`Loaded example: ${id} (chain ${chain})`)
  }
  
  if (!mounted) {
    return <div>Loading...</div>
  }
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Direct Molstar Integration</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Molstar Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Structure Viewer</h2>
              <div className="flex gap-2">
                <span className={`inline-flex h-3 w-3 rounded-full ${pluginReady ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                <span className="text-sm text-gray-600">{pluginReady ? 'Ready' : 'Initializing...'}</span>
              </div>
            </div>
            
            <div className="rounded-lg overflow-hidden border h-[500px]">
              <DirectMolstarViewer
                pdbId={pdbId}
                chainId={chainId}
                height="100%"
                domains={domains}
                onReady={handlePluginReady}
                onError={handlePluginError}
              />
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div>
          {/* Structure Selection */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h2 className="text-lg font-semibold mb-4">Structure Selection</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">PDB ID</label>
                  <input
                    type="text"
                    value={inputPdbId}
                    onChange={(e) => setInputPdbId(e.target.value.toLowerCase())}
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g. 1cbs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Chain ID</label>
                  <input
                    type="text"
                    value={inputChainId}
                    onChange={(e) => setInputChainId(e.target.value.toUpperCase())}
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g. A"
                    maxLength={1}
                  />
                </div>
              </div>
              
              <button
                onClick={handleLoadStructure}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Load Structure
              </button>
              
              <div>
                <label className="block text-sm font-medium mb-2">Examples</label>
                <div className="grid grid-cols-2 gap-2">
                  {examples.map(example => (
                    <button
                      key={example.id}
                      onClick={() => loadExample(example.id, example.chain)}
                      className="text-left text-sm px-3 py-2 border rounded hover:bg-gray-50"
                    >
                      <div className="font-medium">{example.id}</div>
                      <div className="text-xs text-gray-500 truncate">{example.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Domain Controls */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h2 className="text-lg font-semibold mb-4">Domain Visualization</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Position</label>
                  <input
                    type="number"
                    value={domainStart}
                    onChange={(e) => setDomainStart(parseInt(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Position</label>
                  <input
                    type="number"
                    value={domainEnd}
                    onChange={(e) => setDomainEnd(parseInt(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                    min={1}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Label</label>
                  <input
                    type="text"
                    value={domainLabel}
                    onChange={(e) => setDomainLabel(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={domainColor}
                      onChange={(e) => setDomainColor(e.target.value)}
                      className="h-10 w-10 rounded border p-0"
                    />
                    <input
                      type="text"
                      value={domainColor}
                      onChange={(e) => setDomainColor(e.target.value)}
                      className="flex-1 border rounded px-3 py-2"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleAddDomain}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Add Domain
                </button>
                {domains.length > 0 && (
                  <button
                    onClick={handleClearDomains}
                    className="text-red-600 border border-red-600 px-4 py-2 rounded hover:bg-red-50"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {/* Domain List */}
              {domains.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Current Domains</label>
                  <div className="space-y-2">
                    {domains.map(domain => (
                      <div key={domain.id} className="flex items-center border rounded p-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: domain.color }}></div>
                        <span className="ml-2 flex-1">{domain.label} ({domain.start}-{domain.end})</span>
                        <button
                          onClick={() => setDomains(domains.filter(d => d.id !== domain.id))}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Logs */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Activity Log</h2>
            <div className="h-64 overflow-y-auto bg-gray-900 text-gray-200 rounded p-3 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={log.includes('Error') ? 'text-red-400' : ''}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm">
        <p className="mb-2 font-medium text-blue-800">About this Implementation</p>
        <p className="text-blue-700">
          This page uses a direct implementation of Molstar that properly integrates with Molstar's native React context. 
          It bypasses our custom React context implementation and uses Molstar's built-in components and APIs directly.
        </p>
      </div>
    </div>
  )
}
