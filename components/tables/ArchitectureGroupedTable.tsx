'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  BarChart3,
  ArrowRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Layers
} from 'lucide-react'
import { DomainSummary } from '@/lib/types'

interface ArchitectureGroup {
  architecture_id: string
  pattern_name: string
  domain_count: number
  t_groups: string[]
  frequency: number
  avg_confidence: number
  classification_completeness: number
  proteins: ProteinWithDomains[]
  pagination?: {
    page: number
    size: number
    total: number
  }
}

interface ProteinWithDomains {
  protein_id: string
  pdb_id: string
  chain_id: string
  sequence_length: number
  processing_date: string
  best_confidence: number
  avg_confidence: number
  classification_completeness: number
  domains: DomainSummary[]
}

interface ArchitectureGroupedTableProps {
  architectureGroups: ArchitectureGroup[]
  onProteinClick: (domain: DomainSummary) => void
  onDomainClick: (domain: DomainSummary) => void
  onArchitecturePageChange?: (architectureId: string, page: number) => void
  renderClassificationBadge: (
    value: string | null,
    filterKey: 'h_group' | 'x_group' | 'a_group' | 't_group',
    label: string
  ) => React.ReactNode
  loading?: boolean
}

// Domain Architecture Pattern Component
function DomainArchitecturePattern({ 
  domains, 
  onDomainClick,
  renderClassificationBadge 
}: { 
  domains: DomainSummary[]
  onDomainClick: (domain: DomainSummary) => void
  renderClassificationBadge: (
    value: string | null,
    filterKey: 'h_group' | 'x_group' | 'a_group' | 't_group',
    label: string
  ) => React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1">
      {domains.map((domain, index) => (
        <React.Fragment key={domain.id}>
          {index > 0 && (
            <ArrowRight className="w-3 h-3 text-gray-400 mx-1" />
          )}
          <button
            onClick={() => onDomainClick(domain)}
            className="transition-all hover:scale-105"
            title={`Domain ${domain.domain_number}: ${domain.range}${domain.t_group ? ` (${domain.t_group})` : ''}\nConfidence: ${domain.confidence?.toFixed(3) || 'N/A'}`}
          >
            {renderClassificationBadge(domain.t_group, 't_group', 'T-group (Topology)')}
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

// Individual Architecture Group Component  
function ArchitectureGroupCard({
  group,
  isExpanded,
  onToggleExpand,
  onProteinClick,
  onDomainClick,
  onPageChange,
  renderClassificationBadge
}: {
  group: ArchitectureGroup
  isExpanded: boolean
  onToggleExpand: () => void
  onProteinClick: (domain: DomainSummary) => void
  onDomainClick: (domain: DomainSummary) => void
  onPageChange?: (page: number) => void
  renderClassificationBadge: (
    value: string | null,
    filterKey: 'h_group' | 'x_group' | 'a_group' | 't_group',
    label: string
  ) => React.ReactNode
}) {
  // Get representative domains for pattern display
  const representativeDomains = group.proteins[0]?.domains || []

  // Pagination for this group
  const pagination = group.pagination
  const currentPage = pagination?.page || 1
  const pageSize = pagination?.size || 10
  const totalItems = pagination?.total || group.proteins.length
  const totalPages = Math.ceil(totalItems / pageSize)

  return (
    <Card className="overflow-hidden">
      {/* Architecture Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onToggleExpand}
                className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
                {group.pattern_name}
              </button>
              
              <Badge variant="secondary" className="px-2 py-1">
                {group.architecture_id}
              </Badge>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="text-center">
                <div className="font-semibold text-gray-900">{totalItems}</div>
                <div>proteins</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">{group.domain_count}</div>
                <div>domains each</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">{(group.avg_confidence * 100).toFixed(0)}%</div>
                <div>avg conf.</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">{(group.classification_completeness * 100).toFixed(0)}%</div>
                <div>classified</div>
              </div>
            </div>
          </div>
          
          {/* Architecture Pattern Display */}
          <div className="mt-3 flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">Pattern:</span>
            <DomainArchitecturePattern 
              domains={representativeDomains}
              onDomainClick={onDomainClick}
              renderClassificationBadge={renderClassificationBadge}
            />
            <span className="text-xs text-gray-500 ml-2">N→C</span>
            <div className="ml-auto text-sm text-gray-500">
              Found in {group.frequency} total proteins across database
            </div>
          </div>
        </div>
      </div>

      {/* Protein List */}
      {isExpanded && (
        <>
          <div className="divide-y divide-gray-100">
            {group.proteins.map((protein) => (
              <div key={protein.protein_id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    {/* Protein Info */}
                    <div className="min-w-0">
                      <button
                        onClick={() => onProteinClick(protein.domains[0])}
                        className="text-lg font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {protein.pdb_id}_{protein.chain_id}
                      </button>
                      <div className="text-sm text-gray-500">
                        {protein.sequence_length} residues • 
                        {new Date(protein.processing_date).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Domain Architecture with Individual Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-2">
                        <DomainArchitecturePattern 
                          domains={protein.domains}
                          onDomainClick={onDomainClick}
                          renderClassificationBadge={renderClassificationBadge}
                        />
                      </div>
                      
                      {/* Domain Details Row */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {protein.domains.map((domain, index) => (
                          <React.Fragment key={domain.id}>
                            {index > 0 && <span>•</span>}
                            <span>
                              D{domain.domain_number}: {domain.range}
                              {domain.confidence && (
                                <span className={`ml-1 font-medium ${
                                  domain.confidence >= 0.8 ? 'text-green-600' :
                                  domain.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  ({domain.confidence.toFixed(2)})
                                </span>
                              )}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quality Metrics & Actions */}
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className={`text-sm font-semibold ${
                        protein.avg_confidence >= 0.8 ? 'text-green-600' :
                        protein.avg_confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {(protein.avg_confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">avg conf</div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-sm font-semibold ${
                        protein.classification_completeness >= 0.8 ? 'text-green-600' :
                        protein.classification_completeness >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {(protein.classification_completeness * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">classified</div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onProteinClick(protein.domains[0])}
                        title="View protein details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDomainClick(protein.domains[0])}
                        title="View domain details"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination for this group */}
          {pagination && totalPages > 1 && (
            <div className="px-6 py-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} proteins
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange?.(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange?.(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// Main Architecture Grouped Table
export function ArchitectureGroupedTable({
  architectureGroups,
  onProteinClick,
  onDomainClick,
  onArchitecturePageChange,
  renderClassificationBadge,
  loading = false
}: ArchitectureGroupedTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    // Auto-expand top 3 most common architectures
    new Set(
      architectureGroups
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3)
        .map(group => group.architecture_id)
    )
  )

  const handleToggleGroup = (architectureId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(architectureId)) {
      newExpanded.delete(architectureId)
    } else {
      newExpanded.add(architectureId)
    }
    setExpandedGroups(newExpanded)
  }

  const handleGroupPageChange = (architectureId: string, page: number) => {
    onArchitecturePageChange?.(architectureId, page)
  }

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading architecture data...</p>
      </Card>
    )
  }

  if (architectureGroups.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Layers className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <div className="text-gray-500 mb-4">No domain architectures found</div>
        <p className="text-sm text-gray-400">
          Try adjusting your filters to see different architecture patterns.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Domain Architecture Patterns
        </h3>
        <div className="flex gap-6 text-sm text-gray-600">
          <span>{architectureGroups.length} unique architectures</span>
          <span>•</span>
          <span>
            {architectureGroups.reduce((sum, group) => sum + (group.pagination?.total || group.proteins.length), 0)} total proteins
          </span>
          <span>•</span>
          <span>Grouped by N→C domain arrangement</span>
        </div>
      </div>

      {/* Architecture Groups */}
      <div className="space-y-4">
        {architectureGroups
          .sort((a, b) => {
            // Sort by frequency (most common first), then by domain count
            if (b.frequency !== a.frequency) return b.frequency - a.frequency
            return a.domain_count - b.domain_count
          })
          .map((group) => (
            <ArchitectureGroupCard
              key={group.architecture_id}
              group={group}
              isExpanded={expandedGroups.has(group.architecture_id)}
              onToggleExpand={() => handleToggleGroup(group.architecture_id)}
              onProteinClick={onProteinClick}
              onDomainClick={onDomainClick}
              onPageChange={(page) => handleGroupPageChange(group.architecture_id, page)}
              renderClassificationBadge={renderClassificationBadge}
            />
          ))}
      </div>
    </div>
  )
}
