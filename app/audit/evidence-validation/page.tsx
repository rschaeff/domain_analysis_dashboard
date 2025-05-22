'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { HitLevelEvidenceValidator } from '@/components/analysis/HitLevelEvidenceValidator'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ArrowLeft, Search, Info } from 'lucide-react'
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
            <div className="font-medium mb-1">This tool provides four levels of evidence analysis:</div>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li><strong>Pipeline Domains:</strong> Shows the final domain predictions made by the pipeline</li>
              <li><strong>Hit Validation:</strong> Validates coordinates and boundary usability of individual evidence hits</li>
              <li><strong>Coverage Analysis:</strong> Analyzes biological meaningfulness and domain size criteria</li>
              <li><strong>Evidence Traceability:</strong> Traces which evidence contributed to each final domain prediction</li>
            </ul>
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
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-2">
            <ArrowLeft className="w-5 h-5 text-red-600 mt-0.5 rotate-180" />
            <div>
              <h4 className="font-medium text-red-800">Error Loading Protein</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => selectedProtein && fetchProteinData(selectedProtein)}
                className="mt-2"
              >
                Retry
              </Button>
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
          <p className="text-sm text-gray-500 mt-2">
            Fetching domain predictions, evidence files, and validation data
          </p>
        </Card>
      )}

      {/* No Selection State */}
      {!selectedProtein && !loading && (
        <Card className="p-8 text-center">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ready for Analysis</h3>
          <p className="text-gray-600 mb-4">
            Enter a protein ID above to begin evidence validation and traceability analysis.
          </p>
          <div className="text-sm text-gray-500">
            <p>Example proteins to try:</p>
            <div className="flex justify-center gap-4 mt-2">
              {['5c3l_B', '1abc_A', '2xyz_C'].map(example => (
                <button
                  key={example}
                  onClick={() => {
                    setProteinSearch(example)
                    handleProteinSelect()
                  }}
                  className="text-blue-600 hover:text-blue-800 font-mono"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
