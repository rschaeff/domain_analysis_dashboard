import React, { useState, useEffect } from 'react'

interface Batch {
  id: number
  batch_name: string
  batch_type: string
  total_items: number
  completed_items: number
  status: string
  ref_version: string
  actual_protein_count: number
  partition_count: number
}

interface BatchSelectorProps {
  onBatchSelect: (batchId: number | null) => void
  currentBatchId?: number | null
  showStats?: boolean
}

export function BatchSelector({ 
  onBatchSelect, 
  currentBatchId,
  showStats = true 
}: BatchSelectorProps) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBatches()
  }, [])

  const fetchBatches = async () => {
    try {
      setError(null)
      const response = await fetch('/api/batches')
      
      if (response.ok) {
        const data = await response.json()
        // Filter for domain analysis batches that have actual data
        const relevantBatches = (data.batches || [])
          .filter((b: Batch) => 
            b.batch_type === 'domain_analysis' && 
            b.partition_count > 0
          )
          .sort((a: Batch, b: Batch) => b.id - a.id) // Latest first
        
        setBatches(relevantBatches)
      } else {
        throw new Error('Failed to fetch batches')
      }
    } catch (error) {
      console.error('Error fetching batches:', error)
      setError('Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">Batch Filter:</label>
        <div className="animate-pulse bg-gray-200 h-8 w-48 rounded-md"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-red-600">Batch Filter:</label>
        <span className="text-sm text-red-500">{error}</span>
      </div>
    )
  }

  const selectedBatch = batches.find(b => b.id === currentBatchId)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Batch Filter:</label>
        <select
          value={currentBatchId || ''}
          onChange={(e) => onBatchSelect(e.target.value ? parseInt(e.target.value) : null)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Batches (Latest)</option>
          {batches.map(batch => (
            <option key={batch.id} value={batch.id}>
              {batch.batch_name} 
              {showStats && batch.partition_count > 0 && 
                ` (${batch.partition_count.toLocaleString()} proteins)`
              }
              {batch.status !== 'completed' && 
                ` - ${batch.status}`
              }
            </option>
          ))}
        </select>
      </div>

      {/* Show selected batch details */}
      {selectedBatch && showStats && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 ml-20">
          <span>
            Version: <span className="font-medium">{selectedBatch.ref_version}</span>
          </span>
          <span>
            Status: <span className={`font-medium ${
              selectedBatch.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {selectedBatch.status}
            </span>
          </span>
          <span>
            Progress: <span className="font-medium">
              {((selectedBatch.completed_items / selectedBatch.total_items) * 100).toFixed(1)}%
            </span>
          </span>
          {selectedBatch.partition_count !== selectedBatch.actual_protein_count && (
            <span className="text-yellow-600">
              ⚠️ Partition mismatch
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Usage in MainCurationInterface.tsx:
export function CurationSessionStart() {
  const [curatorName, setCuratorName] = useState('')
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)

  const startCurationSession = async () => {
    if (!curatorName.trim()) {
      alert('Please enter your name to start curation')
      return
    }

    setIsStartingSession(true)
    try {
      const response = await fetch('/api/curation/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curator_name: curatorName.trim(),
          batch_size: 10,
          batch_id: selectedBatchId
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Session started:', data)
        // Handle successful session start
      } else {
        const error = await response.json()
        alert(`Failed to start session: ${error.error}`)
      }
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Failed to start curation session')
    } finally {
      setIsStartingSession(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Start Curation Session</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Your Name</label>
          <input
            type="text"
            value={curatorName}
            onChange={(e) => setCuratorName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your name"
            disabled={isStartingSession}
          />
        </div>

        <div>
          <BatchSelector 
            onBatchSelect={setSelectedBatchId}
            currentBatchId={selectedBatchId}
            showStats={true}
          />
        </div>

        <button
          onClick={startCurationSession}
          disabled={!curatorName.trim() || isStartingSession}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            !curatorName.trim() || isStartingSession
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isStartingSession ? (
            <span className="flex items-center justify-center">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
              Starting Session...
            </span>
          ) : (
            <span>
              Start Curation 
              {selectedBatchId ? ` (Batch ${selectedBatchId})` : ' (Latest Batch)'}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
