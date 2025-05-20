'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DomainSummary, DomainEvidence, DomainComparison } from '@/lib/types'
import { SequenceViewer } from '@/components/visualization/SequenceViewer'
import { StructureViewer } from '@/components/visualization/StructureViewer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ArrowLeft, Edit, Download, Share } from 'lucide-react'

export default function DomainDetailPage() {
  const params = useParams()
  const router = useRouter()
  const domainId = params.id as string

  const [domain, setDomain] = useState<DomainSummary | null>(null)
  const [evidence, setEvidence] = useState<DomainEvidence[]>([])
  const [comparisons, setComparisons] = useState<DomainComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch domain details
  useEffect(() => {
    const fetchDomainDetails = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch domain data
        const domainResponse = await fetch(`/api/domains/${domainId}`)
        if (!domainResponse.ok) {
          throw new Error('Failed to fetch domain details')
        }
        const domainData = await domainResponse.json()
        setDomain(domainData)

        // Fetch evidence
        const evidenceResponse = await fetch(`/api/domains/${domainId}/evidence`)
        if (evidenceResponse.ok) {
          const evidenceData = await evidenceResponse.json()
          setEvidence(evidenceData)
        }

        // Fetch comparisons
        const comparisonsResponse = await fetch(`/api/domains/${domainId}/comparisons`)
        if (comparisonsResponse.ok) {
          const comparisonsData = await comparisonsResponse.json()
          setComparisons(comparisonsData)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (domainId) {
      fetchDomainDetails()
    }
  }, [domainId])

  const handleBack = () => {
    router.back()
  }

  const handleEdit = () => {
    // Placeholder for edit functionality
    console.log('Edit domain:', domainId)
  }

  const handleDownload = () => {
    // Placeholder for download functionality
    console.log('Download domain data:', domainId)
  }

  const handleShare = () => {
    // Placeholder for share functionality
    navigator.clipboard.writeText(window.location.href)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading domain details...</p>
        </div>
      </div>
    )
  }

  if (error || !domain) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Error Loading Domain</h2>
          <p className="text-gray-600 mb-4">{error || 'Domain not found'}</p>
          <Button onClick={handleBack}>Go Back</Button>
        </Card>
      </div>
    )
  }

  // Mock sequence data (would come from API)
  const mockSequence = 'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFDEHVKLVNELTEFAKTCVADESHAGCEKSLHTLFGDELCKVASLRETYGDMADCCEKQEPERNECFLSHKDDSPDLPKLKPDPNTLCDEFKADEKKFWGKYLYEIARRHPYFYAPELLYYANKYNGVFQECCQAEDKGACLLPKIETMREKVLASSARQRLRCASIQKFGERALKAWSVARLSQKFPKAEFVEVTKLVTDLTKVHKECCHGDLLECADDRADLAKYICDNQDTISSKLKECCDKPLLEKSHCIAEVEKDAIPENLPPLTADFAEDKDVCKNYQEAKDAFLGSFLYEYSRRHPEYAVSVLLRLAKEYEATLEECCAKDDPHACYSTVFDKLKHLVDEPQNLIKQNCDQFEKLGEYGFQNALIVRYTRKVPQVSTPTLVEVSRSLGKVGTRCCTKPESERMPCTEDYLSLILNRLCVLHEKTPVSEKVTKCCTESLVNRRPCFSALTPDETYVPKAFDEKLFTFHADICTLPDTEKQIKKQTALVELLKHKPKATEEQLKTVMENFVAFVDKCCAADDKEACFAVEGPKLVVSTQTALA'

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              Domain: {domain.domain_id || `${domain.pdb_id}_${domain.chain_id}_d${domain.domain_number}`}
            </h1>
            <p className="text-gray-600 mt-1">
              Range: {domain.range || `${domain.start_pos}-${domain.end_pos}`} | Classification: {domain.t_group || 'None'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Domain Overview */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Domain Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Basic Information</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">ID:</span> {domain.domain_id || 'N/A'}</div>
              <div><span className="font-medium">Range:</span> {domain.range || `${domain.start_pos}-${domain.end_pos}`}</div>
              <div><span className="font-medium">Length:</span> {domain.end_pos - domain.start_pos + 1} residues</div>
              <div><span className="font-medium">Source:</span> {domain.source || 'N/A'}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Classification</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">T-Group:</span> {domain.t_group || 'Not assigned'}</div>
              <div><span className="font-medium">H-Group:</span> {domain.h_group || 'Not assigned'}</div>
              <div><span className="font-medium">X-Group:</span> {domain.x_group || 'Not assigned'}</div>
              <div><span className="font-medium">A-Group:</span> {domain.a_group || 'Not assigned'}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Quality Metrics</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Confidence:</span>{' '}
                <span className={`${
                  domain.confidence && domain.confidence >= 0.8 ? 'text-green-600' :
                  domain.confidence && domain.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {domain.confidence ? domain.confidence.toFixed(3) : 'N/A'}
                </span>
              </div>
              <div><span className="font-medium">Evidence Count:</span> {domain.evidence_count}</div>
              <div><span className="font-medium">Evidence Types:</span> {domain.evidence_types}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Processing Info</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Batch:</span> {domain.batch_id || 'N/A'}</div>
              <div><span className="font-medium">Reference:</span> {domain.reference_version || 'N/A'}</div>
              <div><span className="font-medium">Timestamp:</span> {new Date(domain.timestamp).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Evidence Details */}
      {evidence.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Supporting Evidence</h2>
          <div className="space-y-4">
            {evidence.map((ev, index) => (
              <div key={ev.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{ev.evidence_type.toUpperCase()} Evidence</h3>
                    <p className="text-sm text-gray-600">Source: {ev.source_id || 'N/A'}</p>
                  </div>
                  <div className="text-right text-sm">
                    {ev.evalue && <div>E-value: {ev.evalue}</div>}
                    {ev.probability && <div>Probability: {ev.probability.toFixed(3)}</div>}
                    {ev.score && <div>Score: {ev.score}</div>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div><span className="font-medium">Hit ID:</span> {ev.hit_id || ev.source_id || 'N/A'}</div>
                    <div><span className="font-medium">Query Range:</span> {ev.query_range || 'N/A'}</div>
                    <div><span className="font-medium">Hit Range:</span> {ev.hit_range || 'N/A'}</div>
                  </div>
                  <div>
                    <div><span className="font-medium">Classification:</span> {ev.t_group || 'N/A'}</div>
                    <div><span className="font-medium">PDB:</span> {
                      ev.pdb_id && ev.chain_id ? `${ev.pdb_id}_${ev.chain_id}` :
                      ev.source_id || ev.hit_id || 'N/A'
                    }</div>
                    <div><span className="font-medium">HSP Count:</span> {ev.hsp_count || 'N/A'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Comparison with References */}
      {comparisons.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Reference Comparisons</h2>
          <div className="space-y-4">
            {comparisons.map((comp, index) => (
              <div key={comp.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{comp.reference_type} Reference</h3>
                    <p className="text-sm text-gray-600">
                      Domain: {comp.reference_domain_id} | Range: {comp.reference_domain_range}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {comp.t_group_match && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">T-Match</span>}
                    {comp.h_group_match && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">H-Match</span>}
                    {comp.x_group_match && <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">X-Match</span>}
                    {comp.a_group_match && <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">A-Match</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Jaccard Similarity</div>
                    <div>{comp.jaccard_similarity ? comp.jaccard_similarity.toFixed(3) : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="font-medium">Precision</div>
                    <div>{comp.precision ? comp.precision.toFixed(3) : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="font-medium">Recall</div>
                    <div>{comp.recall ? comp.recall.toFixed(3) : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="font-medium">F1 Score</div>
                    <div>{comp.f1_score ? comp.f1_score.toFixed(3) : 'N/A'}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <div>
                    <span className="font-medium">Overlap:</span> {comp.overlap_residues} residues |{' '}
                    <span className="font-medium">Union:</span> {comp.union_residues} residues
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Visualization Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SequenceViewer
          protein_id={`${domain.pdb_id}_${domain.chain_id}`}
          sequence={mockSequence}
          domains={[{
            start: domain.start_pos,
            end: domain.end_pos,
            label: `Domain ${domain.domain_number}`,
            color: '#3b82f6'
          }]}
          features={[]}
        />

        <StructureViewer
          pdb_id={domain.pdb_id}
          chain_id={domain.chain_id}
          domains={[{
            start: domain.start_pos,
            end: domain.end_pos,
            label: `Domain ${domain.domain_number}`,
            color: '#3b82f6'
          }]}
          onDomainClick={(domain) => console.log('Domain clicked:', domain)}
        />
      </div>
    </div>
  )
}
