// components/visualization/DomainStructureViewer.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CanvasMolstarViewer, Domain } from './CanvasMolstarViewer'
import { PluginContext } from 'molstar/lib/mol-plugin/context'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface DomainData {
  id: string;
  pdb_id: string;
  chain_id: string;
  range: string;
  start: number;
  end: number;
  t_group?: string;
  h_group?: string;
  x_group?: string;
  a_group?: string;
  is_manual_rep?: boolean;
  confidence?: number;
}

interface DomainStructureViewerProps {
  pdbId: string;
  chainId: string;
  domainData?: DomainData[];
  height?: string | number;
  width?: string | number;
  onReady?: () => void;
  autoHighlightDomains?: boolean;
  colorByClassification?: boolean;
  showLabels?: boolean;
  className?: string;
}

// Mapping of t_groups to colors for consistent coloring
const T_GROUP_COLORS: Record<string, string> = {
  // Alpha proteins
  '1.10.8': '#FF5733', // Alpha-horseshoe
  '1.20.5': '#FFC300', // Alpha-solenoid
  '1.10.10': '#DAF7A6', // Orthogonal Bundle
  '1.20.120': '#C70039', // Up-down Bundle
  
  // Beta proteins
  '2.40.50': '#900C3F', // Beta-barrel
  '2.60.40': '#581845', // Beta-sandwich
  '2.30.30': '#2471A3', // Beta-trefoil
  
  // Alpha/Beta proteins
  '3.40.50': '#1ABC9C', // Rossmann fold
  '3.30.70': '#2E86C1', // TIM barrel
  '3.90.1580': '#8E44AD', // ATP-binding domain
  
  // Other groups
  '4.10.220': '#7D3C98', // Immunoglobulin-like
  '4.10.520': '#138D75', // SH3-like
  
  // Default colors for other groups
  'default': '#3498DB' // Default blue
};

// Get domain color based on classification
const getDomainColor = (domain: DomainData, colorByClassification: boolean): string => {
  if (!colorByClassification || !domain.t_group) {
    // Generate a deterministic color based on domain ID if no classification
    const hash = domain.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }
  
  return T_GROUP_COLORS[domain.t_group] || T_GROUP_COLORS.default;
};

export function DomainStructureViewer({
  pdbId,
  chainId,
  domainData = [],
  height = '400px',
  width = '100%',
  onReady,
  autoHighlightDomains = true,
  colorByClassification = true,
  showLabels = true,
  className = ''
}: DomainStructureViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [viewerReady, setViewerReady] = useState(false);
  const pluginRef = useRef<PluginContext | null>(null);

  // Process domain data into viewer format
  useEffect(() => {
    if (!domainData || domainData.length === 0) {
      setDomains([]);
      return;
    }

    try {
      const formattedDomains = domainData.map((domain) => {
        // If a string range is provided (e.g., "10-156"), parse it
        let start = domain.start;
        let end = domain.end;
        
        if (!start || !end) {
          const rangeParts = domain.range?.split('-');
          if (rangeParts && rangeParts.length === 2) {
            start = parseInt(rangeParts[0], 10);
            end = parseInt(rangeParts[1], 10);
          }
        }
        
        // Get color based on classification if enabled
        const color = getDomainColor(domain, colorByClassification);
        
        // Create label based on available information
        let label = domain.id;
        if (showLabels) {
          if (domain.t_group) {
            label = `${domain.t_group}`;
            if (domain.h_group) {
              label = `${domain.h_group} (${start}-${end})`;
            }
          } else {
            label = `${domain.id} (${start}-${end})`;
          }
        }
        
        return {
          id: domain.id,
          start,
          end,
          color,
          label: showLabels ? label : undefined
        };
      });
      
      setDomains(formattedDomains);
    } catch (err) {
      console.error('Error processing domain data:', err);
      setError(`Error processing domain data: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [domainData, colorByClassification, showLabels]);

  // Handle viewer ready
  const handleViewerReady = (plugin: PluginContext) => {
    pluginRef.current = plugin;
    setViewerReady(true);
    setIsLoading(false);
    
    if (onReady) {
      onReady();
    }
  };

  // Handle viewer error
  const handleViewerError = (errorMsg: string) => {
    setError(errorMsg);
    setIsLoading(false);
  };

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <LoadingSpinner />
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-red-500 bg-white p-4 rounded shadow">
            {error}
          </div>
        </div>
      )}
      
      <CanvasMolstarViewer
        pdbId={pdbId}
        chainId={chainId}
        height="100%"
        width="100%"
        onReady={handleViewerReady}
        onError={handleViewerError}
        useLocalRepository={true}
        domains={autoHighlightDomains ? domains : []}
        initialRepresentation="cartoon"
      />
      
      {viewerReady && domains.length > 0 && (
        <div className="absolute top-2 right-2 bg-white/80 rounded shadow p-2 text-xs max-w-xs max-h-[50%] overflow-y-auto">
          <div className="font-medium mb-1">Domains</div>
          <div className="space-y-1">
            {domains.map((domain) => (
              <div key={domain.id} className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: domain.color }}></div>
                <div className="truncate">{domain.label || domain.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
