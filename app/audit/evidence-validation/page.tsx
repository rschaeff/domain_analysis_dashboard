'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { HitLevelEvidenceValidator } from '@/components/analysis/HitLevelEvidenceValidator'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ArrowLeft, Search, Info, AlertTriangle, CheckCircle, FileText, Activity } from 'lucide-react'
import { Input } from '@/components/ui/Input'

export default function EvidenceValidationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedProtein, setSelectedProtein] = useState<string | null>(null)
  const [proteinSearch, setProteinSearch] = useState('')
  const [proteinData, setProteinData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get protein from URL params if provided
  useEffect(() => {
    const proteinId = searchParams.get('protein_id')
    if (proteinId) {
      setSelectedProtein(proteinId)
      setProteinSearch(proteinId)
      fetchProteinData(proteinId)
    }
  }, [searchParams])

  const fetchProteinData = async (proteinId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/proteins/${proteinId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched protein data:', data)
        setProteinData(data)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setError(`Failed to fetch protein: ${response.status} - ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Error fetching protein:', error)
      setError('Network error - check your connection and try again')
    } finally {
      setLoading(false)
    }
  }

  const handleProteinSelect = () => {
    if (proteinSearch.trim()) {
      setSelectedProtein(proteinSearch.trim())
      fetchProteinData(proteinSearch.trim())

      // Update URL
      const url = new URL(window.location.href)
      url.searchParams.set('protein_id', proteinSearch.trim())
      window.history.pushState({}, '', url.toString())
    }
  }

  const handleClearSelection = () => {
    setSelectedProtein(null)
    setProteinData(null)
    setProteinSearch('')
    setError(null)

    // Clear URL params
    const url = new URL(window.location.href)
    url.searchParams.delete('protein_id')
    window.history.pushState({}, '', url.toString())
  }

  // Example proteins for testing
  const exampleProteins = [
    { id: '5c3l_A', description: '5c3l chain A - single domain protein' },
    { id: '5c3l_B', description: '5c3l chain B - short domain' },
    { id: '1abc_A', description: '1abc chain A - multi-domain example' }
  ]

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Evidence Validation & Traceability</h1>
            <p className="text-gray-600 mt-1">
              Comprehensive analysis of domain evidence quality, coordinate validation, and pipeline traceability
            </p>
          </div>
        </div>
      </div>

      {/* Information Panel */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <div className="font-medium mb-1">This tool provides comprehensive evidence analysis in three steps:</div>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 ml-4">
              <li><strong>Pipeline Domains:</strong> Review current domain predictions with 3D visualization</li>
              <li><strong>Evidence Analysis:</strong> Parse evidence files to assess quality and pipeline usage</li>
              <li><strong>Domain Traceability:</strong> Track which evidence contributed to each domain prediction</li>
            </ol>
            <div className="mt-3 p-3 bg-blue-100 rounded text-blue-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="font-medium">💡 Workflow: Start by parsing evidence files to unlock full analysis capabilities</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Protein Selection */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select Protein for Analysis</h3>
            {selectedProtein && (
              <Button variant="outline" size="sm" onClick={handleClearSelection}>
                Clear Selection
              </Button>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter protein ID (e.g., 5c3l_B)"
                value={proteinSearch}
                onChange={(e) => setProteinSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleProteinSelect()}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleProteinSelect}
              disabled={!proteinSearch.trim() || loading}
            >
              {loading ? <LoadingSpinner size="sm" className="mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Analyze
            </Button>
          </div>

          {/* Selection Status */}
          {selectedProtein && (
            <div className="flex items-center gap-2 text-sm">
              {proteinData ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-700">
                    Successfully loaded {selectedProtein} - {proteinData.sequence_length} residues, {proteinData.domain_count} domains
                  </span>
                </>
              ) : loading ? (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-yellow-700">Loading {selectedProtein}...</span>
                </>
              ) : error ? (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-700">Failed to load {selectedProtein}</span>
                </>
              ) : null}
            </div>
          )}

          {/* Example Proteins */}
          <div className="border-t pt-4">
            <div className="text-sm text-gray-600 mb-2">Example proteins to try:</div>
            <div className="flex flex-wrap gap-2">
              {exampleProteins.map(example => (
                <button
                  key={example.id}
                  onClick={() => {
                    setProteinSearch(example.id)
                    setSelectedProtein(example.id)
                    fetchProteinData(example.id)
                  }}
                  className="text-blue-600 hover:text-blue-800 font-mono text-sm bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors"
                  title={example.description}
                >
                  {example.id}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800">Error Loading Protein</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <div className="mt-3 space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedProtein && fetchProteinData(selectedProtein)}
                >
                  Retry
                </Button>
                <div className="text-xs text-red-600">
                  <div className="font-medium mb-1">Common issues:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Protein ID not found in database (try format like "5c3l_A")</li>
                    <li>Network connectivity problems</li>
                    <li>Server temporarily unavailable</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Protein Status Cards */}
      {proteinData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Protein Info Card */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h4 className="font-medium">Protein Loaded</h4>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>ID: {selectedProtein}</div>
              <div>Length: {proteinData.sequence_length} residues</div>
              <div>Domains: {proteinData.domain_count}</div>
              {proteinData.batch_id && (
                <div>Batch: {proteinData.batch_id}</div>
              )}
            </div>
          </Card>

          {/* Domain Status Card */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {proteinData.domain_count > 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              )}
              <h4 className="font-medium">Pipeline Domains</h4>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {proteinData.domain_count > 0 ? (
                <>
                  <div>{proteinData.domain_count} domain(s) predicted</div>
                  <div>Coverage: {Math.round((proteinData.coverage || 0) * 100)}%</div>
                  <div>Classified: {proteinData.fully_classified_domains || 0}</div>
                </>
              ) : (
                <>
                  <div>No domains predicted</div>
                  <div>Can still analyze evidence files</div>
                </>
              )}
            </div>
          </Card>

          {/* Analysis Status Card */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium">Analysis Ready</h4>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>✓ Structure visualization available</div>
              <div>⏳ Evidence files require parsing</div>
              <div>⏳ Traceability requires parsing</div>
            </div>
          </Card>
        </div>
      )}

      {/* Special case: No domains warning */}
      {proteinData && proteinData.domain_count === 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">No Pipeline Domains Found</h4>
              <p className="text-yellow-700 text-sm mt-1">
                This protein has no domain predictions in the pipeline. You can still analyze
                raw evidence files to understand why no domains were predicted - this is often
                the most valuable analysis for troubleshooting pipeline behavior.
              </p>
              <div className="mt-2 text-xs text-yellow-600">
                Common reasons: protein too short, poor evidence quality, or classification failure
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Analysis Component */}
      {selectedProtein && proteinData && !loading && (
        <div className="space-y-6">
          <HitLevelEvidenceValidator
            proteinId={selectedProtein}
            pipelineDomains={proteinData.putative_domains || []}
            sequenceLength={proteinData.sequence_length}
            sequence={proteinData.sequence} // Add if available
          />
        </div>
      )}

      {/* Loading State */}
      {loading && selectedProtein && (
        <Card className="p-8 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading protein data for {selectedProtein}...</p>
          <div className="text-sm text-gray-500 mt-2 space-y-1">
            <p>• Fetching domain predictions</p>
            <p>• Checking evidence file availability</p>
            <p>• Preparing analysis interface</p>
          </div>
        </Card>
      )}

      {/* No Selection State */}
      {!selectedProtein && !loading && (
        <Card className="p-8 text-center">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for Evidence Analysis</h3>
          <p className="text-gray-600 mb-4">
            Enter a protein ID above to begin comprehensive evidence validation and traceability analysis.
          </p>
          <div className="text-sm text-gray-500">
            <p className="mb-2">This tool helps you:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
              <div className="p-3 bg-gray-50 rounded">
                <div className="font-medium text-gray-700 mb-1">🔍 Validate Evidence</div>
                <div className="text-xs">Check coordinate quality and usability</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="font-medium text-gray-700 mb-1">📊 Analyze Usage</div>
                <div className="text-xs">See which evidence was used vs missed</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="font-medium text-gray-700 mb-1">🔗 Trace Decisions</div>
                <div className="text-xs">Map evidence to final domain boundaries</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
