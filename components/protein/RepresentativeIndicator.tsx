// components/protein/RepresentativeIndicator.tsx
'use client'

import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  Database, 
  TrendingUp, 
  HelpCircle, 
  ExternalLink,
  ArrowRight,
  Users
} from 'lucide-react'

interface RepresentativeIndicatorProps {
  protein: {
    process_version?: string
    sequence_md5?: string
    propagated_count?: number
    is_representative?: boolean
    is_propagated?: boolean
    pdb_id: string
    chain_id: string
    source_id: string
  }
  onViewPropagated?: () => void
  onViewRepresentative?: () => void
  className?: string
}

export function RepresentativeIndicator({
  protein,
  onViewPropagated,
  onViewRepresentative,
  className = ''
}: RepresentativeIndicatorProps) {
  
  // Determine the protein type based on process_version and flags
  const getProteinType = () => {
    if (protein.is_representative || protein.process_version === 'mini_pyecod_1.0') {
      return 'representative'
    } else if (protein.is_propagated || protein.process_version === 'mini_pyecod_propagated_1.0') {
      return 'propagated'
    } else if (protein.process_version === '1.0') {
      return 'legacy'
    } else {
      return 'unknown'
    }
  }

  const proteinType = getProteinType()

  // Get appropriate styling and content based on type
  const getTypeInfo = () => {
    switch (proteinType) {
      case 'representative':
        return {
          badge: (
            <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-300">
              <Database className="w-3 h-3 mr-1" />
              Representative
            </Badge>
          ),
          description: 'This is a representative sequence from which domain assignments were computed and then propagated to identical sequences.',
          algorithmVersion: protein.process_version || 'mini_pyecod_1.0'
        }
      
      case 'propagated':
        return {
          badge: (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-300">
              <TrendingUp className="w-3 h-3 mr-1" />
              Propagated
            </Badge>
          ),
          description: 'This sequence received its domain assignments by propagation from a representative sequence with identical sequence (100% identity).',
          algorithmVersion: protein.process_version || 'mini_pyecod_propagated_1.0'
        }
      
      case 'legacy':
        return {
          badge: (
            <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-300">
              <Database className="w-3 h-3 mr-1" />
              Legacy (v1.0)
            </Badge>
          ),
          description: 'This protein was processed with an older algorithm version (1.0) and may have lower quality domain assignments.',
          algorithmVersion: '1.0'
        }
      
      default:
        return {
          badge: (
            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">
              <HelpCircle className="w-3 h-3 mr-1" />
              Unknown
            </Badge>
          ),
          description: 'The processing status of this protein is unclear.',
          algorithmVersion: protein.process_version || 'unknown'
        }
    }
  }

  const typeInfo = getTypeInfo()

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Type Badge with Tooltip */}
      <Tooltip content={typeInfo.description}>
        {typeInfo.badge}
      </Tooltip>

      {/* Algorithm Version */}
      <div className="text-xs text-gray-500">
        <span className="font-medium">Algorithm:</span> {typeInfo.algorithmVersion}
      </div>

      {/* Sequence MD5 (truncated) */}
      {protein.sequence_md5 && (
        <Tooltip content={`Full MD5: ${protein.sequence_md5}`}>
          <div className="text-xs text-gray-500 font-mono">
            <span className="font-medium">MD5:</span> {protein.sequence_md5.substring(0, 8)}...
          </div>
        </Tooltip>
      )}

      {/* Representative Actions */}
      {proteinType === 'representative' && (
        <div className="flex items-center gap-2">
          {protein.propagated_count !== undefined && protein.propagated_count > 0 ? (
            <>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                <Users className="w-3 h-3 mr-1" />
                {protein.propagated_count} propagated
              </Badge>
              {onViewPropagated && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onViewPropagated}
                  className="text-xs h-6 px-2"
                >
                  View Propagated
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </>
          ) : (
            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
              <Users className="w-3 h-3 mr-1" />
              Unique sequence
            </Badge>
          )}
        </div>
      )}

      {/* Propagated Actions */}
      {proteinType === 'propagated' && onViewRepresentative && (
        <Button
          size="sm"
          variant="outline"
          onClick={onViewRepresentative}
          className="text-xs h-6 px-2"
        >
          <Database className="w-3 h-3 mr-1" />
          View Representative
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
      )}

      {/* Legacy Warning */}
      {proteinType === 'legacy' && (
        <div className="text-xs text-amber-600 flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          <span>Consider re-processing with current algorithm</span>
        </div>
      )}
    </div>
  )
}
