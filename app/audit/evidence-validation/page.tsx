'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { HitLevelEvidenceValidator } from '@/components/analysis/HitLevelEvidenceValidator'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ArrowLeft, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'

export default function EvidenceValidationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedProtein, setSelectedProtein] = useState<string | null>(null)
  const [proteinSearch, setProteinSearch] = useState('')
  const [proteinData, setProteinData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

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
    try {
      const response = await fetch(`/api/proteins/${proteinId}`)
      if (response.ok) {
        const data = await response.json()
        setProteinData(data)
      }
    } catch (error) {
      console.error('Error fetching protein:', error)
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
            <h1 className="text-3xl font-bold">Hit-Level Evidence Validation</h1>
            <p className="text-gray-600 mt-1">
              Analyze filesystem evidence quality and coordinate validation
            </p>
          </div>
        </div>
      </div>

      {/* Protein Selection */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Select Protein for Analysis</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter protein ID (e.g., 5c3l_B)"
                value={proteinSearch}
                onChange={(e) => setProteinSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleProteinSelect()}
              />
            </div>
            <Button onClick={handleProteinSelect} disabled={!proteinSearch.trim()}>
              <Search className="w-4 h-4 mr-2" />
              Analyze
            </Button>
          </div>
        </div>
      </Card>

      {/* Validation Component */}
      {selectedProtein && proteinData && (
        <HitLevelEvidenceValidator
          proteinId={selectedProtein}
          pipelineDomains={proteinData.putative_domains || []}
          sequenceLength={proteinData.sequence_length}
          sequence={undefined} // Add if you have sequence data
        />
      )}

      {loading && (
        <Card className="p-8 text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Loading protein data...</p>
        </Card>
      )}
    </div>
  )
}
