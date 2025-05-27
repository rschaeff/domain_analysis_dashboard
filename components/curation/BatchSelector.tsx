// Updated BatchSelector component - smart filtering for curation
function BatchSelector({
  onBatchSelect,
  currentBatchId,
  showStats = true
}: {
  onBatchSelect: (batchId: number | null) => void
  currentBatchId?: number | null
  showStats?: boolean
}) {
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

        // Smart filtering for curation-ready batches
        const relevantBatches = (data.batches || [])
          .filter((b: Batch) => {
            // Must have partition data
            if (b.partition_count <= 0) return false

            // For pdb_hhsearch batches: only include completed or domain_partition_complete
            if (b.batch_type === 'pdb_hhsearch') {
              return ['completed', 'domain_partition_complete', 'domain_partition_complete_with_errors'].includes(b.status)
            }

            // For alt_rep batches: include processed or created (they're simpler)
            if (b.batch_type === 'alt_rep') {
              return ['processed', 'created', 'completed'].includes(b.status)
            }

            // Include any other batch types with data
            return true
          })
          .sort((a: Batch, b: Batch) => {
            // Prioritize by type and then by ID
            if (a.batch_type !== b.batch_type) {
              // pdb_hhsearch batches first (main domain analysis)
              if (a.batch_type === 'pdb_hhsearch') return -1
              if (b.batch_type === 'pdb_hhsearch') return 1
            }
            // Then by ID (latest first)
            return b.id - a.id
          })

        console.log('📊 Curation-ready batches:', relevantBatches.map(b => ({
          id: b.id,
          name: b.batch_name,
          type: b.batch_type,
          status: b.status,
          partition_count: b.partition_count
        })))

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

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'domain_partition_complete': return 'text-blue-600'
      case 'domain_partition_complete_with_errors': return 'text-yellow-600'
      case 'processed': return 'text-blue-600'
      case 'indexed': return 'text-gray-600'
      case 'created': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Batch Filter:</label>
        <select
          value={currentBatchId || ''}
          onChange={(e) => onBatchSelect(e.target.value ? parseInt(e.target.value) : null)}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Available Batches (Auto-Select)</option>
          {batches.map(batch => (
            <option key={batch.id} value={batch.id}>
              {batch.batch_name}
              {showStats && batch.partition_count > 0 &&
                ` (${batch.partition_count.toLocaleString()} proteins)`
              }
              {` [${batch.batch_type}]`}
              {batch.status !== 'completed' && ` - ${batch.status}`}
            </option>
          ))}
        </select>
      </div>

      {/* Show selected batch details */}
      {selectedBatch && showStats && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 ml-20">
          <span>
            Type: <span className="font-medium">{selectedBatch.batch_type}</span>
          </span>
          <span>
            Status: <span className={`font-medium ${getStatusColor(selectedBatch.status)}`}>
              {selectedBatch.status}
            </span>
          </span>
          <span>
            Version: <span className="font-medium">{selectedBatch.ref_version}</span>
          </span>
          {selectedBatch.total_items > 0 && (
            <span>
              Progress: <span className="font-medium">
                {((selectedBatch.completed_items / selectedBatch.total_items) * 100).toFixed(1)}%
              </span>
            </span>
          )}
        </div>
      )}

      {/* Show batch type explanation */}
      {batches.length > 0 && (
        <div className="text-xs text-gray-500 ml-20">
          💡 <strong>pdb_hhsearch</strong>: Main domain analysis | <strong>alt_rep</strong>: Alternative representatives
        </div>
      )}
    </div>
  )
}
