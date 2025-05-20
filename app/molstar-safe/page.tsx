'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { SafeModeViewer } from '@/components/visualization/SafeModeViewer'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function MolstarSafePage() {
  const [pdbId, setPdbId] = useState('1cbs')
  const [chainId, setChainId] = useState('')
  const [viewKey, setViewKey] = useState(0)
  const [messages, setMessages] = useState<string[]>([])
  
  const addMessage = (message: string) => {
    setMessages(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`])
  }
  
  const handleLoad = () => {
    addMessage(`Preparing to view ${pdbId}${chainId ? ` chain ${chainId}` : ''}`)
    setViewKey(prev => prev + 1)
  }
  
  const handleReady = (plugin: any) => {
    addMessage(`Structure loaded successfully`)
  }
  
  const handleError = (error: string) => {
    addMessage(`Error: ${error}`)
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Molstar Safe Mode Viewer</h1>
      <p className="mb-4 text-gray-700">
        This page uses a defensive implementation to prevent browser crashes. 
        The viewer initializes first, then loads structures manually to isolate problems.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6 mb-6 h-full">
            <div className="flex flex-col h-full">
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">PDB ID</label>
                  <div className="flex">
                    <Input 
                      value={pdbId} 
                      onChange={(e) => setPdbId(e.target.value.trim())} 
                      placeholder="e.g. 1cbs" 
                      className="mr-2"
                    />
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium mb-1">Chain ID (optional)</label>
                  <Input 
                    value={chainId} 
                    onChange={(e) => setChainId(e.target.value.trim())} 
                    placeholder="e.g. A" 
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleLoad}>New Viewer</Button>
                </div>
              </div>

              <div className="relative h-96 flex-grow bg-gray-50 rounded border">
                <SafeModeViewer 
                  key={viewKey}
                  pdbId={pdbId}
                  chainId={chainId || undefined}
                  height="100%"
                  width="100%"
                  onReady={handleReady}
                  onError={handleError}
                />
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Safe Mode Instructions</h2>
            <div className="space-y-4">
              <p>
                This viewer uses a two-step process to isolate issues:
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Click <b>Initialize Viewer</b> to set up Molstar</li>
                <li>After initialization, click <b>Load [PDB]</b> to load the structure</li>
              </ol>
              <p>
                If the viewer crashes at a specific stage, it helps isolate whether the problem is with 
                initialization or structure loading.
              </p>
              <p className="text-sm text-gray-500">
                The viewer uses minimal configuration and "backbone" representation to reduce memory usage.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Operation Log</h2>
            <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs h-64 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-gray-500">No activity yet. Initialize the viewer to begin.</div>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className="mb-1">{msg}</div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Recommended Test Structures</h2>
        <p className="mb-4">
          Try these structures that typically work well in most Molstar implementations:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {['1cbs', '4hhb', '1bna', '1ubq', '3eam', '1avo'].map(id => (
            <Button 
              key={id} 
              variant="outline"
              onClick={() => {
                setPdbId(id)
                setChainId('')
                addMessage(`Selected structure: ${id}`)
              }}
              className="text-blue-600 hover:bg-blue-100"
            >
              {id}
            </Button>
          ))}
        </div>
        <p className="text-sm text-gray-600">
          Smaller structures are less likely to cause browser crashes. If a structure crashes, try a simpler one.
        </p>
      </Card>
    </div>
  )
}
