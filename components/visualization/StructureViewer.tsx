// Enhanced StructureViewer component with integrated domain details
'use client'

import React, { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { RotateCcw, Download, Eye, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'

// Dynamic import for 3D viewer
const ThreeDMolViewer = dynamic(
  () => import('@/components/visualization/ThreeDMolViewer'),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center">Loading 3D viewer...</div> }
)

// Domain colors
const DOMAIN_COLORS = [
  '#FF0000', '#0000FF', '#00CC00', '#FF00FF', '#FFCC00', '#00FFFF',
  '#FF6600', '#9900CC', '#669900', '#FF99CC', '#666666', '#336699'
]

interface EnhancedStructureViewerProps {
  pdb_id: string
  chain_id: string
  domains?: any[]
  onDomainClick?: (domain: any) => void
}

export function EnhancedStructureViewer({
  pdb_id,
  chain_id,
  domains = [],
  onDomainClick
}: EnhancedStructureViewerProps) {
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [showDomainDetails, setShowDomainDetails] = useState(true)
  const [domainEvidence, setDomainEvidence] = useState<any[]>([])
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const viewerRef = useRef<any>(null)

  // Filter to only putative domains for structure visualization
  const putativeDomains = domains.filter(d =>
    d.domain_type === 'putative' || !d.domain_type
  )

  // Map domains for 3D viewer
  const mapDomainsFor3D = (domainsToMap: any[]) => {
    return domainsToMap.map((domain, index) => ({
      id: String(domain.id || index),
      chainId: domain.chainId || chain_id,
      start: domain.start || domain.start_pos || parseInt(domain.range?.split('-')[0]) || 0,
      end: domain.end || domain.end_pos || parseInt(domain.range?.split('-')[1]) || 0,
      pdb_range: domain.pdb_range,
      pdb_start: domain.pdb_start,
      pdb_end: domain.pdb_end,
      color: domain.color || DOMAIN_COLORS[index % DOMAIN_COLORS.length],
      label: domain.label || domain.domain_id || `Domain ${domain.domain_number || index + 1}`,
      classification: {
        t_group: domain.t_group,
        h_group: domain.h_group,
        x_group: domain.x_group,
        a_group: domain.a_group
      }
    }))
  }

  const mappedDomains = mapDomainsFor3D(putativeDomains)

  // Fetch domain evidence when needed
  const fetchDomainEvidence = async (domainId: number) => {
    setLoadingEvidence(true)
    try {
      const response = await fetch(`/api/domains/${domainId}/evidence`)
      if (response.ok) {
        const evidence = await response.json()
        setDomainEvidence(evidence)
      }
    } catch (error) {
      console.error('Error fetching domain evidence:', error)
    } finally {
      setLoadingEvidence(false)
    }
  }

  // Handle domain interactions
  const handleDomainHighlight = (domain: any, index: number) => {
    setSelectedDomain(index)

    // Highlight in 3D viewer
    if (viewerRef.current?.current) {
      try {
        viewerRef.current.current.highlightDomain(index)
      } catch (error) {
        console.error('Error highlighting domain:', error)
      }
    }

    // Fetch evidence for this domain
    if (domain.id) {
      fetchDomainEvidence(domain.id)
    }
  }

  const handleDomainClick = (domain: any) => {
    if (onDomainClick) {
      onDomainClick(domain)
    }
  }

  const handleReset = () => {
    setSelectedDomain(null)
    setDomainEvidence([])
    if (viewerRef.current?.current) {
      try {
        viewerRef.current.current.reset()
      } catch (error) {
        console.error('Error resetting view:', error)
      }
    }
  }

  const handleExport = () => {
    if (viewerRef.current?.current) {
      try {
        const dataUrl = viewerRef.current.current.exportImage()
        if (dataUrl) {
          const link = document.createElement('a')
          link.href = dataUrl
          link.download = `${pdb_id}_${chain_id}${selectedDomain !== null ? `_domain${selectedDomain+1}` : ''}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      } catch (error) {
        console.error('Error exporting image:', error)
      }
    }
  }

  // Domain table columns
  const domainColumns = [
    {
      key: 'domain_number',
      label: 'Domain',
      sortable: true,
      render: (value: number, domain: any, index: number) => (
        <button
          onClick={() => handleDomainHighlight(domain, index)}
          className={`font-mono px-2 py-1 rounded text-sm ${
            selectedDomain === index
              ? 'bg-blue-100 text-blue-800 border border-blue-300'
              : 'hover:bg-gray-100'
          }`}
          style={{
            borderLeftColor: domain.color || DOMAIN_COLORS[index % DOMAIN_COLORS.length],
            borderLeftWidth: '4px',
            borderLeftStyle: 'solid'
          }}
        >
          {value}
        </button>
      )
    },
    {
      key: 'range',
      label: 'Sequence Range',
      render: (value: string, domain: any) => (
        <div className="font-mono text-sm">
          <div>{value}</div>
          {domain.pdb_range && domain.pdb_range !== value && (
            <div className="text-xs text-gray-500">PDB: {domain.pdb_range}</div>
          )}
        </div>
      )
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
      render: (value: string | null, domain: any) => (
        <div className="space-y-1">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            value ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
          }`}>
            {value || 'Unclassified'}
          </span>
          {domain.h_group && (
            <div className="text-xs text-gray-600">H: {domain.h_group}</div>
          )}
        </div>
      )
    },
    {
      key: 'source',
      label: 'Source',
      render: (value: string, domain: any) => (
        <div className="text-sm">
          <div className="font-medium">{value}</div>
          {domain.source_id && (
            <div className="text-xs text-gray-500 font-mono">{domain.source_id}</div>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, domain: any, index: number) => (
        <div className="flex gap-1">
          <Tooltip content="Highlight in 3D">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDomainHighlight(domain, index)}
              disabled={selectedDomain === index}
            >
              <Eye className="w-3 h-3" />
            </Button>
          </Tooltip>
          <Tooltip content="View details">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDomainClick(domain)}
            >
              <Info className="w-3 h-3" />
            </Button>
          </Tooltip>
        </div>
      )
    }
  ]

  // Evidence table columns
  const evidenceColumns = [
    {
      key: 'evidence_type',
      label: 'Type',
      render: (value: string) => (
        <Badge variant={value === 'hhsearch' ? 'default' : 'secondary'}>
          {value.toUpperCase()}
        </Badge>
      )
    },
    {
      key: 'source_id',
      label: 'Source',
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      )
    },
    {
      key: 'confidence',
      label: 'Confidence',
      render: (value: number) => {
        const color = value >= 0.8 ? 'text-green-600' : value >= 0.5 ? 'text-yellow-600' : 'text-red-600'
        return <span className={`font-medium ${color}`}>{value?.toFixed(3) || 'N/A'}</span>
      }
    },
    {
      key: 'query_range',
      label: 'Query Range',
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      )
    },
    {
      key: 'hit_range',
      label: 'Hit Range',
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* 3D Structure Viewer */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Structure: {pdb_id}_{chain_id}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!isViewerReady}
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!isViewerReady}
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Information about domain visualization */}
          <div className="bg-blue-50 p-3 rounded-lg text-sm">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 text-blue-600" />
              <div>
                <strong>Domain Visualization:</strong> Click domain buttons below or table rows to highlight domains in the 3D structure.
                {selectedDomain !== null && (
                  <span className="text-blue-600 font-medium">
                    {' '}Currently highlighting Domain {putativeDomains[selectedDomain]?.domain_number}.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3D Viewer */}
          <div className="relative">
            <ThreeDMolViewer
              ref={viewerRef}
              pdbId={pdb_id}
              chainId={chain_id}
              domains={mappedDomains}
              height="500px"
              onStructureLoaded={() => setIsViewerReady(true)}
              onError={setViewerError}
              showControls={true}
              showLoading={false}
              className="rounded-lg overflow-hidden border border-gray-200"
            />

            {viewerError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg">
                <div className="text-red-600 text-center p-4">
                  <p className="font-semibold">Error loading structure</p>
                  <p className="text-sm mt-1">{viewerError}</p>
                </div>
              </div>
            )}

            {!isViewerReady && !viewerError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg">
                <LoadingSpinner />
                <p className="ml-2">Loading structure...</p>
              </div>
            )}
          </div>

          {/* Quick Domain Selector */}
          {mappedDomains.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Quick Domain Selection ({mappedDomains.length} domains)</h4>
              <div className="flex flex-wrap gap-2">
                {mappedDomains.map((domain, index) => {
                  const originalDomain = putativeDomains[index]
                  return (
                    <Tooltip key={domain.id} content={
                      <div className="text-xs">
                        <div>{domain.label}</div>
                        <div>Range: {domain.start}-{domain.end}</div>
                        {domain.pdb_range && <div>PDB: {domain.pdb_range}</div>}
                        {originalDomain.confidence && <div>Confidence: {originalDomain.confidence.toFixed(2)}</div>}
                      </div>
                    }>
                      <button
                        onClick={() => handleDomainHighlight(originalDomain, index)}
                        className={`px-3 py-1 text-sm border rounded-full transition-colors ${
                          selectedDomain === index
                            ? 'bg-gray-100 border-gray-400'
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                        style={{ borderColor: domain.color }}
                      >
                        <span className="flex items-center gap-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: domain.color }}
                          />
                          Domain {originalDomain.domain_number}
                          {originalDomain.t_group && (
                            <Badge variant="outline" className="text-xs ml-1">
                              {originalDomain.t_group}
                            </Badge>
                          )}
                        </span>
                      </button>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Domain Details Table */}
      {mappedDomains.length > 0 && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Domain Details</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDomainDetails(!showDomainDetails)}
              >
                {showDomainDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showDomainDetails ? 'Hide' : 'Show'} Details
              </Button>
            </div>

            {showDomainDetails && (
              <div className="space-y-4">
                <DataTable
                  data={putativeDomains}
                  columns={domainColumns}
                  onRowClick={(domain, index) => handleDomainHighlight(domain, index)}
                />

                {/* Selected Domain Evidence */}
                {selectedDomain !== null && (
                  <div className="border-t pt-4">
                    <h4 className="text-md font-medium mb-3">
                      Evidence for Domain {putativeDomains[selectedDomain]?.domain_number}
                    </h4>

                    {loadingEvidence ? (
                      <div className="flex items-center gap-2 text-gray-600">
                        <LoadingSpinner size="sm" />
                        Loading evidence...
                      </div>
                    ) : domainEvidence.length > 0 ? (
                      <DataTable
                        data={domainEvidence}
                        columns={evidenceColumns}
                        showPagination={false}
                      />
                    ) : (
                      <p className="text-gray-500 text-sm">No evidence data available for this domain.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* No domains message */}
      {mappedDomains.length === 0 && (
        <Card className="p-6">
          <div className="text-center py-6 text-gray-500">
            <p>No predicted domains found for this protein</p>
            <p className="text-sm mt-1">The structure is shown without domain annotations</p>
          </div>
        </Card>
      )}
    </div>
  )
}
