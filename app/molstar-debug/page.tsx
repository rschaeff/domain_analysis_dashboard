'use client'

import React, { useState, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { ImprovedMolstarViewer } from '@/components/visualization/ImprovedMolstarViewer'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'

export default function MolstarDebugPage() {
  const [pdbId, setPdbId] = useState('1cbs')
  const [chainId, setChainId] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [key, setKey] = useState(0) // Used to force remount of viewer

  // Reference to the current PDB ID being displayed
  const currentPdbIdRef = useRef(pdbId)
  const currentChainIdRef = useRef(chainId)

  const handleLoad = () => {
    // Only remount if PDB ID or chain ID has changed
    if (currentPdbIdRef.current !== pdbId || currentChainIdRef.current !== chainId) {
      currentPdbIdRef.current = pdbId
      currentChainIdRef.current = chainId
      setKey(prevKey => prevKey + 1)
    }

    setLogs([])
    setError(null)
    setIsLoaded(false)
    addLog(`Loading structure: ${pdbId}${chainId ? ` chain ${chainId}` : ''}`)
  }

  const handleReady = (plugin: any) => {
    setIsLoaded(true)
    addLog('Structure loaded successfully')
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    addLog(`Error: ${errorMessage}`)
  }

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    setLogs(prev => [...prev, `${timestamp} - ${message}`])
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Molstar Structure Viewer Debug</h1>

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
                  <Button onClick={handleLoad}>Load Structure</Button>
                </div>
              </div>

              <div className="relative h-96 flex-grow bg-gray-50 rounded border">
                {/* Key prop forces remount only when the Load button is clicked */}
                <ImprovedMolstarViewer
                  key={key}
                  pdbId={pdbId}
                  chainId={chainId || undefined}
                  height="100%"
                  width="100%"
                  onReady={handleReady}
                  onError={handleError}
                />
              </div>

              {isLoaded && (
                <Alert className="mt-4">
                  <AlertDescription className="text-green-700">
                    Structure loaded successfully!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Viewer Status</h2>
            <div className="mb-4">
              <div className="text-sm font-medium mb-1">Current Structure</div>
              <div className="bg-gray-100 p-2 rounded font-mono text-sm">
                {currentPdbIdRef.current}{currentChainIdRef.current ? ` (Chain ${currentChainIdRef.current})` : ''}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm font-medium mb-1">Source</div>
              <div className="bg-gray-100 p-2 rounded text-sm">
                Local PDB Repository API at /usr2/pdb/data/structures
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm font-medium mb-1">Status</div>
              <div className={`p-2 rounded font-medium ${isLoaded ? 'bg-green-100 text-green-800' : error ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {isLoaded ? 'Loaded' : error ? 'Error' : 'Loading'}
              </div>
            </div>

            {error && (
              <div className="mb-4">
                <div className="text-sm font-medium mb-1">Error</div>
                <div className="bg-red-50 p-2 rounded text-red-800 text-sm break-words">
                  {error}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Operation Logs</h2>
            <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet. Load a structure to see logs.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Troubleshooting Tips</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Ensure the PDB ID is valid and exists in the local repository at <code>/usr2/pdb/data/structures</code></li>
          <li>If you specify a chain ID, make sure it exists in the structure</li>
          <li>The viewer attempts to load both mmCIF (.cif) and PDB (.pdb) formats</li>
          <li>Check the logs for detailed information about the loading process</li>
          <li>If loading takes more than 20 seconds, the viewer will time out automatically</li>
          <li>If the API returns "Failed to fetch", the structure may not exist in the repository</li>
          <li>Try a different structure if one fails to load - not all structures may render properly</li>
        </ul>

        <div className="mt-4 bg-blue-50 p-4 rounded">
          <h3 className="font-semibold mb-2">Try These Known Working Structures</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['4hhb', '1bna', '3pqr', '7jsu', '6vxx', '1ubq', '3eam', '1avo'].map(id => (
              <Button
                key={id}
                variant="outline"
                onClick={() => {
                  setPdbId(id)
                  setChainId('')
                  setTimeout(() => handleLoad(), 0) // Use setTimeout to ensure state is updated
                }}
                className="text-blue-600 hover:bg-blue-100"
              >
                {id}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
