// Enhanced StructureViewer component with PDB validation
'use client'

import React, { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/common/DataTable'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  RotateCcw,
  Download,
  Eye,
  Info,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react'

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

interface PdbValidation {
  exists: boolean
  accessible: boolean
  error?: string
  checkedAt: Date
}

interface StructureViewerProps {
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
}: StructureViewerProps) {
  // Existing state
  const [isViewerReady, setIsViewerReady] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<number | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [showDomainDetails, setShowDomainDetails] = useState(true)
  const [domainEvidence, setDomainEvidence] = useState<any[]>([])
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [filesystemEvidence, setFilesystemEvidence] = useState<any>(null)
  const [loadingFilesystem, setLoadingFilesystem] = useState(false)
  const viewerRef = useRef<any>(null)

  // NEW: PDB validation state
  const [validation, setValidation] = useState<PdbValidation | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showValidationDetails, setShowValidationDetails] = useState(false)

  // NEW: Validate PDB structure exists
  const validatePdbStructure = async (pdbId: string): Promise<PdbValidation> => {
    try {
      console.log(`🔍 Validating PDB structure: ${pdbId}`)

      // Check RCSB API first
      const apiUrl = `https://data.rcsb.org/rest/v1/core/entry/${pdbId.toLowerCase()}`
      const apiResponse = await fetch(apiUrl, {
        method: 'HEAD',
        mode: 'cors'
      })

      if (apiResponse.ok) {
        console.log(`✅ PDB ${pdbId} exists in RCSB`)

        // Check if the actual PDB file is accessible
        const pdbUrl = `https://files.rcsb.org/view/${pdbId.toLowerCase()}.pdb`
        const pdbResponse = await fetch(pdbUrl, {
          method: 'HEAD',
          mode: 'cors'
        })

        return {
          exists: true,
          accessible: pdbResponse.ok,
          error: pdbResponse.ok ? undefined : `PDB file not accessible (HTTP ${pdbResponse.status})`,
          checkedAt: new Date()
        }
      } else {
        console.log(`❌ PDB ${pdbId} not found (HTTP ${apiResponse.status})`)
        return {
          exists: false,
          accessible: false,
          error: `PDB ${pdbId} not found in RCSB database (HTTP ${apiResponse.status})`,
          checkedAt: new Date()
        }
      }
    } catch (error) {
      console.error(`💥 Validation error for PDB ${pdbId}:`, error)
      return {
        exists: false,
        accessible: false,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        checkedAt: new Date()
      }
    }
  }

  // NEW: Validate structure on mount
  useEffect(() => {
    const validate = async () => {
      console.log(`🧬 Validating structure: ${pdb_id}`)
      setValidationError(null)

      const result = await validatePdbStructure(pdb_id)
      setValidation(result)

      if (!result.exists || !result.accessible) {
        const errorMsg = `Structure ${pdb_id}: ${result.error}`
        setValidationError(errorMsg)
        setViewerError(errorMsg)
      }
    }

    if (pdb_id) {
      validate()
    }
  }, [pdb_id])

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

  // Fetch filesystem evidence on component mount
  useEffect(() => {
    const fetchFilesystemEvidence = async () => {
      setLoadingFilesystem(true)
      try {
        const response = await fetch(`/api/proteins/${pdb_id}_${chain_id}/filesystem`)
        if (response.ok) {
          const data = await response.json()
          setFilesystemEvidence(data)
        }
      } catch (error) {
        console.error('Error fetching filesystem evidence:', error)
      } finally {
        setLoadingFilesystem(false)
      }
    }

    fetchFilesystemEvidence()
  }, [pdb_id, chain_id])

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

  // NEW: Handle structure loading with validation
  const handleStructureLoaded = () => {
    console.log(`✅ Structure ${pdb_id}_${chain_id} loaded successfully`)
    setIsViewerReady(true)
    setViewerError(null)
  }

  const handleStructureError = (error: string) => {
    console.log(`❌ Structure ${pdb_id}_${chain_id} error:`, error)
    setViewerError(error)
    setIsViewerReady(false)
  }

  // NEW: Refresh validation
  const handleRefreshValidation = async () => {
    await validatePdbStructure(pdb_id).then(setValidation)
  }

  // NEW: Get validation status components
  const getValidationStatusIcon = () => {
    if (!validation) return <LoadingSpinner size="sm" />
    if (!validation.exists || !validation.accessible) return <XCircle className="w-4 h-4 text-red-500" />
    if (isViewerReady) return <CheckCircle className="w-4 h-4 text-green-500" />
    return <LoadingSpinner size="sm" />
  }

  const getValidationBadge = () => {
    if (!validation) return <Badge variant="secondary">Checking...</Badge>
    if (validation.exists && validation.accessible) return <Badge variant="default">Valid</Badge>
    return <Badge variant="destructive">Invalid</Badge>
  }

  const canLoadViewer = validation?.exists && validation?.accessible

  // Domain table columns (keeping existing columns)
  const domainColumns = [
    {
      key: 'domain_id',
      label: 'Domain ID',
      sortable: true,
      render: (value: string, domain: any, index: number) => (
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
          {value || `Domain ${domain.domain_number}`}
        </button>
      )
    },
    {
      key: 'range',
      label: 'PDB Range',
      render: (value: string, domain: any) => (
        <div className="font-mono text-sm">
          <div className="font-medium">
            {domain.pdb_range || value || 'N/A'}
          </div>
          {domain.pdb_range && value && domain.pdb_range !== value && (
            <div className="text-xs text-gray-500">Seq: {value}</div>
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
            {domain.t_group_name || value || 'Unclassified'}
          </span>
          {domain.t_group && domain.t_group_name && (
            <div className="text-xs text-gray-500 font-mono">{domain.t_group}</div>
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

  // Keep existing evidence columns and filesystem columns...
  const evidenceColumns = [
    // ... (keep existing evidence column definitions)
  ]

  const filesystemColumns = [
    // ... (keep existing filesystem column definitions)
  ]

  return (
    <div className="space-y-6">
      {/* NEW: Validation Status Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getValidationStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold">Structure: {pdb_id}_{chain_id}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>{mappedDomains.length} domain{mappedDomains.length !== 1 ? 's' : ''}</span>
                {getValidationBadge()}
                {validation && (
                  <span className="text-xs text-gray-500">
                    Checked: {validation.checkedAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowValidationDetails(!showValidationDetails)}>
              <Info className="w-4 h-4 mr-1" />
              {showValidationDetails ? 'Hide' : 'Show'} Status
            </Button>
            <Button size="sm" variant="outline" onClick={handleRefreshValidation}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* NEW: Validation Details */}
        {showValidationDetails && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong>Validation Status:</strong>
                <div className="mt-1 space-y-1">
                  <div>Exists: {validation?.exists ? '✅ Yes' : '❌ No'}</div>
                  <div>Accessible: {validation?.accessible ? '✅ Yes' : '❌ No'}</div>
                  {validation?.error && (
                    <div className="text-red-600">Error: {validation.error}</div>
                  )}
                </div>
              </div>
              <div>
                <strong>External Links:</strong>
                <div className="mt-1 space-y-1">
                  <a
                    href={`https://www.rcsb.org/structure/${pdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    RCSB PDB Entry <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://files.rcsb.org/view/${pdb_id.toLowerCase()}.pdb`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    Direct PDB File <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* NEW: Enhanced Error Display */}
      {(validationError || viewerError) && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-800 mb-2">Structure Issues</h4>
              {validationError && (
                <div className="text-red-700 text-sm mb-2">Validation: {validationError}</div>
              )}
              {viewerError && (
                <div className="text-red-700 text-sm mb-2">Viewer: {viewerError}</div>
              )}
              <div className="mt-3">
                <a
                  href={`https://www.rcsb.org/structure/${pdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                >
                  Check PDB in RCSB Database <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 3D Structure Viewer - Only show if validation passes */}
      {canLoadViewer ? (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                3D Structure Viewer
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
                onStructureLoaded={handleStructureLoaded}
                onError={handleStructureError}
                showControls={true}
                showLoading={false}
                className="rounded-lg overflow-hidden border border-gray-200"
              />

              {/* Loading/Error overlays remain the same... */}
            </div>

            {/* Quick Domain Selector - Keep existing implementation */}
            {/* ... */}
          </div>
        </Card>
      ) : (
        /* NEW: Cannot load structure placeholder */
        <Card className="p-6">
          <div className="h-[500px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <XCircle className="w-12 h-12 mx-auto mb-3" />
              <div className="font-medium">Cannot Load Structure</div>
              <div className="text-sm mt-1">
                {validation?.error || 'Structure validation in progress...'}
              </div>
              {validation && !validation.exists && (
                <div className="mt-3">
                  <a
                    href={`https://www.rcsb.org/search?request=%7B%22query%22%3A%7B%22type%22%3A%22terminal%22%2C%22service%22%3A%22text%22%2C%22parameters%22%3A%7B%22value%22%3A%22${pdb_id}%22%7D%7D%7D`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Search for similar PDB structures
                  </a>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Domain Details Table - Keep existing implementation */}
      {mappedDomains.length > 0 && (
        <Card className="p-6">
          {/* ... keep existing domain table implementation ... */}
        </Card>
      )}

      {/* No domains message - Keep existing */}
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
