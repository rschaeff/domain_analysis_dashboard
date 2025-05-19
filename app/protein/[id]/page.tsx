'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DomainSummary, ProteinOverview } from '@/lib/types'
import { BoundaryVisualization } from '@/components/visualization/BoundaryVisualization'
import { DataTable } from '@/components/common/DataTable'
import { SequenceViewer } from '@/app/domains/[id]/components/SequenceViewer'
import { StructureViewer } from '@/app/domains/[id]/components/StructureViewer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ArrowLeft, Eye, BarChart3, Download, Edit } from 'lucide-react'

export default function ProteinDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proteinId = params.id as string

  const [protein, setProtein] = useState<ProteinOverview | null>(null)
  const [domains, setDomains] = useState<DomainSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'sequence' | 'structure'>('overview')

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
        setProtein(proteinData)

        // Fetch domains for this protein
        const domainsResponse = await fetch(`/api/proteins/${proteinId}/domains`)
        if (domainsResponse.ok) {
          const domainsData = await domainsResponse.json()
          setDomains(domainsData)
        }
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

  const handleDomainClick = (domain: DomainSummary) => {
    router.push(`/domains/${domain.id}`)
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

  // Table columns for domains
  const domainColumns = [
    {
      key: 'domain_number',
      label: 'Domain',
      sortable: true,
      render: (value: number) => <span className="font-mono">{value}</span>
    },
    {
      key: 'range',
      label: 'Range',
      render: (value: string) => <span className="font-mono text-sm">{value}</span>
    },
    {
      key: 'confidence',
      label: 'Confidence',
      sortable: true,
      render: (value: number | null) => {
        if (!value) return <span className="text-gray-400">N/A</span>
        const color = value >= 0.8 ? 'text-green-600' : value >= 0.5 ? 'text-yellow-600' : 'text-red-600'
        return <span className={`font-medium ${color}`}>{value.toFixed(3)}</span>
      }
    },
    {
      key: 't_group',
      label: 'Classification',
      render: (value: string | null) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
        }`}>
          {value || 'Unclassified'}
        </span>
      )
    },
    {
      key: 'evidence_count',
      label: 'Evidence',
      sortable: true,
      render: (value: number, domain: DomainSummary) => (
        <div className="text-center">
          <span className="font-medium">{value}</span>
          <div className="text-xs text-gray-500">{domain.evidence_types}</div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, domain: DomainSummary) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDomainClick(domain)}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ]

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'domains', label: 'Domains', icon: Eye },
    { id: 'sequence', label: 'Sequence', icon: Eye },
    { id: 'structure', label: 'Structure', icon: Eye }
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

              {/* Domain Visualization */}
              <BoundaryVisualization
                protein={{
                  id: protein.id,
                  pdb_id: protein.pdb_id,
                  chain_id: protein.chain_id,
                  sequence_length: protein.sequence_length
                }}
                domains={domains}
                onDomainClick={handleDomainClick}
              />
            </div>
          )}

          {activeTab === 'domains' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Domain Details</h3>
                <span className="text-sm text-gray-500">{domains.length} domains</span>
              </div>
              <DataTable
                data={domains}
                columns={domainColumns}
                onRowClick={handleDomainClick}
              />
            </div>
          )}

          {activeTab === 'sequence' && (
            <SequenceViewer
              protein_id={`${protein.pdb_id}_${protein.chain_id}`}
              sequence={mockSequence}
              domains={domains.map((domain, index) => ({
                start: domain.start_pos,
                end: domain.end_pos,
                label: `Domain ${domain.domain_number}`,
                color: `hsl(${index * 137.5 % 360}, 70%, 50%)`
              }))}
              features={[]}
            />
          )}

          {activeTab === 'structure' && (
            <StructureViewer
              pdb_id={protein.pdb_id}
              chain_id={protein.chain_id}
              domains={domains.map((domain, index) => ({
                start: domain.start_pos,
                end: domain.end_pos,
                label: `Domain ${domain.domain_number}`,
                color: `hsl(${index * 137.5 % 360}, 70%, 50%)`
              }))}
              onDomainClick={handleDomainClick}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
