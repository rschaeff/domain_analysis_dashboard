'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DomainSummary, ProteinOverview } from '@/lib/types'
import { BoundaryVisualization } from '@/components/visualization/BoundaryVisualization'
import { MultiTrackDomainVisualization } from '@/components/visualization/MultiTrackDomainVisualization'
import { SequenceViewer } from '@/components/visualization/SequenceViewer'
import { EnhancedStructureViewer } from '@/components/visualization/EnhancedStructureViewer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ArrowLeft, BarChart3, Eye, Download, Edit } from 'lucide-react'

// Domain colors with high contrast for visualization
const DOMAIN_COLORS = [
  '#FF0000', '#0066FF', '#00CC00', '#FF6600', '#9900CC', '#00CCCC',
  '#CC6600', '#FF99CC', '#666666', '#336699'
]

export default function ProteinDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proteinId = params.id as string

  const [protein, setProtein] = useState<ProteinOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'sequence' | 'structure'>('structure')

  // Helper function to create domain for viewer
  const createDomainForViewer = (domain: any, index: number) => {
    // Extract range information robustly
    let start, end, pdbRange, pdbStart, pdbEnd;

    // Try multiple field name patterns for sequence coordinates
    start = domain.start_pos || domain.start || domain.startPos;
    end = domain.end_pos || domain.end || domain.endPos;

    // Try to parse from range string if start/end not available
    if ((!start || !end) && domain.range) {
      const rangeParts = domain.range.split('-');
      if (rangeParts.length === 2) {
        start = parseInt(rangeParts[0]);
        end = parseInt(rangeParts[1]);
      }
    }

    // PDB-specific coordinates
    pdbRange = domain.pdb_range || domain.pdbRange;
    pdbStart = domain.pdb_start || domain.pdbStart;
    pdbEnd = domain.pdb_end || domain.pdbEnd;

    // Parse PDB range if available
    if (pdbRange && !pdbStart && !pdbEnd) {
      const pdbParts = pdbRange.split('-');
      if (pdbParts.length === 2) {
        pdbStart = pdbParts[0];
        pdbEnd = pdbParts[1];
      }
    }

    return {
      id: domain.id?.toString() || `putative_${index}`,
      chainId: protein?.chain_id || 'A',
      domain_type: 'putative',
      start: start || 0,
      end: end || 0,
      pdb_range: pdbRange,
      pdb_start: pdbStart,
      pdb_end: pdbEnd,
      label: `Domain ${domain.domain_number || (index + 1)}`,
      color: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
      source: domain.source,
      confidence: domain.confidence,
      t_group: domain.t_group,
      h_group: domain.h_group,
      x_group: domain.x_group,
      a_group: domain.a_group,
      domain_number: domain.domain_number,
      domain_id: domain.domain_id,
      range: domain.range
    };
  };

  // Fetch protein details
  useEffect(() => {
    const fetchProteinDetails = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch protein overview
        const proteinResponse = await fetch(`/api/proteins/${proteinId}`)
        if (!proteinResponse.ok) {
          throw new Error('Failed to fetch protein details')
        }
        const proteinData = await proteinResponse.json()

        console.log('[FRONTEND PROTEIN] Full response:', proteinData)
        setProtein(proteinData)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (proteinId) {
      fetchProteinDetails()
    }
  }, [proteinId])

  const handleBack = () => {
    router.back()
  }

  const handleDomainClick = (domain: any) => {
    // Navigate to domain detail page if domain has an ID
    if (domain.id) {
      router.push(`/domains/${domain.id}`)
    }
  }

  const handleDownload = () => {
    // Placeholder for download functionality
    console.log('Download protein data:', proteinId)
  }

  const handleEdit = () => {
    // Placeholder for edit functionality
    console.log('Edit protein:', proteinId)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading protein details...</p>
        </div>
      </div>
    )
  }

  if (error || !protein) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Error Loading Protein</h2>
          <p className="text-gray-600 mb-4">{error || 'Protein not found'}</p>
          <Button onClick={handleBack}>Go Back</Button>
        </Card>
      </div>
    )
  }

  // Mock sequence data (would come from API)
  const mockSequence = 'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFDEHVKLVNELTEFAKTCVADESHAGCEKSLHTLFGDELCKVASLRETYGDMADCCEKQEPERNECFLSHKDDSPDLPKLKPDPNTLCDEFKADEKKFWGKYLYEIARRHPYFYAPELLYYANKYNGVFQECCQAEDKGACLLPKIETMREKVLASSARQRLRCASIQKFGERALKAWSVARLSQKFPKAEFVEVTKLVTDLTKVHKECCHGDLLECADDRADLAKYICDNQDTISSKLKECCDKPLLEKSHCIAEVEKDAIPENLPPLTADFAEDKDVCKNYQEAKDAFLGSFLYEYSRRHPEYAVSVLLRLAKEYEATLEECCAKDDPHACYSTVFDKLKHLVDEPQNLIKQNCDQFEKLGEYGFQNALIVRYTRKVPQVSTPTLVEVSRSLGKVGTRCCTKPESERMPCTEDYLSLILNRLCVLHEKTPVSEKVTKCCTESLVNRRPCFSALTPDETYVPKAFDEKLFTFHADICTLPDTEKQIKKQTALVELLKHKPKATEEQLKTVMENFVAFVDKCCAADDKEACFAVEGPKLVVSTQTALA'

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'structure', label: 'Structure & Domains', icon: Eye },
    { id: 'sequence', label: 'Sequence', icon: Eye }
  ]

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
              Protein: {protein.pdb_id}_{protein.chain_id}
            </h1>
            <p className="text-gray-600 mt-1">
              {protein.domain_count} domains | {protein.sequence_length} residues |
              {protein.is_classified ? ' Classified' : ' Unclassified'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-2xl font-bold text-blue-600">{protein.domain_count}</div>
          <div className="text-sm text-gray-600">Total Domains</div>
        </Card>
        <Card className="p-6">
          <div className="text-2xl font-bold text-green-600">{protein.fully_classified_domains}</div>
          <div className="text-sm text-gray-600">Fully Classified</div>
        </Card>
        <Card className="p-6">
          <div className="text-2xl font-bold text-purple-600">{Math.round(protein.coverage * 100)}%</div>
          <div className="text-sm text-gray-600">Sequence Coverage</div>
        </Card>
        <Card className="p-6">
          <div className="text-2xl font-bold text-orange-600">{protein.domains_with_evidence}</div>
          <div className="text-sm text-gray-600">With Evidence</div>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="p-0 overflow-hidden">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Protein Overview */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Protein Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Basic Properties</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">PDB ID:</span> {protein.pdb_id}</div>
                      <div><span className="font-medium">Chain ID:</span> {protein.chain_id}</div>
                      <div><span className="font-medium">Length:</span> {protein.sequence_length} residues</div>
                      <div><span className="font-medium">Batch:</span> {protein.batch_id || 'N/A'}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Domain Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Total Domains:</span> {protein.domain_count}</div>
                      <div><span className="font-medium">Classified:</span> {protein.fully_classified_domains}</div>
                      <div><span className="font-medium">With Evidence:</span> {protein.domains_with_evidence}</div>
                      <div><span className="font-medium">Coverage:</span> {Math.round(protein.coverage * 100)}%</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Processing Info</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Reference:</span> {protein.reference_version || 'N/A'}</div>
                      <div><span className="font-medium">Status:</span> {protein.is_classified ? 'Classified' : 'Unclassified'}</div>
                      <div><span className="font-medium">Residues Assigned:</span> {protein.residues_assigned}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Track Domain Visualization */}
              <MultiTrackDomainVisualization
                protein={{
                  id: protein.id,
                  pdb_id: protein.pdb_id,
                  chain_id: protein.chain_id,
                  sequence_length: protein.sequence_length
                }}
                putativeDomains={protein.putative_domains || []}
                referenceDomains={protein.reference_domains || []}
                onDomainClick={handleDomainClick}
              />
            </div>
          )}

          {activeTab === 'structure' && (
            <EnhancedStructureViewer
              pdb_id={protein.pdb_id}
              chain_id={protein.chain_id}
              domains={
                // Only use putative domains for structure visualization
                (protein.putative_domains || []).map((domain, index) =>
                  createDomainForViewer(domain, index)
                )
              }
              onDomainClick={handleDomainClick}
            />
          )}

          {activeTab === 'sequence' && (
            <SequenceViewer
              protein_id={`${protein.pdb_id}_${protein.chain_id}`}
              sequence={mockSequence}
              domains={(protein.putative_domains || []).map((domain, index) => ({
                start: domain.start_pos,
                end: domain.end_pos,
                label: `Domain ${domain.domain_number}`,
                color: `hsl(${index * 137.5 % 360}, 70%, 50%)`
              }))}
              features={[]}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
