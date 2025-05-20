'use client'

import React, { useRef, useEffect, useState } from 'react';

// Import correct Molstar modules for version 10.9.2
import { createPlugin } from 'molstar/lib/mol-plugin-ui/plugin';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { ColorNames } from 'molstar/lib/mol-util/color/names';
import { Asset } from 'molstar/lib/mol-util/assets';

// Domain type definition
export interface Domain {
  id: string;
  chainId: string;
  start: number;
  end: number;
  color: string;
  label?: string;
}

interface SimplifiedMolstarViewerProps {
  pdbId: string;
  domains?: Domain[];
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const SimplifiedMolstarViewer: React.FC<SimplifiedMolstarViewerProps> = ({
  pdbId,
  domains = [],
  width = '100%',
  height = '400px',
  className = '',
  style = {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pluginRef = useRef<any>(null);

  // Initialize Molstar and load structure
  useEffect(() => {
    if (!containerRef.current) return;
    
    const initMolstar = async () => {
      try {
        setIsLoading(true);
        console.log('Initializing Molstar...');
        
        // Create Molstar plugin
        const plugin = await createPlugin(containerRef.current, {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: false,
              controlsDisplay: 'reactive'
            }
          }
        });
        
        pluginRef.current = plugin;
        
        // Load structure
        await loadStructure(plugin, pdbId);
        
        // Highlight domains if provided
        if (domains.length > 0) {
          await highlightDomains(plugin, domains);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing Molstar:', err);
        setError(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };
    
    initMolstar();
    
    // Cleanup function
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
          pluginRef.current = null;
        } catch (err) {
          console.error('Error disposing Molstar plugin:', err);
        }
      }
    };
  }, [pdbId]);
  
  // Update domain visualization when domains change
  useEffect(() => {
    if (!pluginRef.current || isLoading) return;
    
    const updateDomains = async () => {
      try {
        await highlightDomains(pluginRef.current, domains);
      } catch (err) {
        console.error('Error highlighting domains:', err);
      }
    };
    
    updateDomains();
  }, [domains, isLoading]);
  
  return (
    <div 
      ref={containerRef}
      className={`simplified-molstar-viewer ${className}`}
      style={{ 
        position: 'relative',
        width, 
        height,
        ...style
      }}
    >
      {isLoading && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          zIndex: 10
        }}>
          <div>Loading structure...</div>
        </div>
      )}
      
      {error && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          color: 'red',
          zIndex: 10
        }}>
          <div>{error}</div>
        </div>
      )}
    </div>
  );
};

// Helper function to load structure
async function loadStructure(plugin: any, pdbId: string) {
  // Clear any existing data
  await plugin.clear();
  
  // Construct URL for fetching structure
  const url = `https://www.ebi.ac.uk/pdbe/static/entry/${pdbId.toLowerCase()}_updated.cif`;
  
  try {
    // Load the structure using Molstar's data builders
    const data = await plugin.builders.data.download({ 
      url: Asset.Url(url), 
      isBinary: false 
    });
    
    const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
    
    const structure = await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', {
      structure: { 
        name: 'model', 
        params: {} 
      },
      showUnitcell: false,
      representationPreset: 'auto'
    });
    
    // Focus camera on structure
    plugin.canvas3d?.resetCamera();
    plugin.canvas3d?.commit();
    
    return structure;
  } catch (error) {
    console.error('Error loading structure:', error);
    throw error;
  }
}

// Helper function to highlight domains
async function highlightDomains(plugin: any, domains: Domain[]) {
  if (!plugin || domains.length === 0) return;
  
  try {
    // First, clear existing representations
    await plugin.clear();
    
    // Load the structure again
    const pdbId = domains[0].chainId.split('_')[0] || '';
    const url = `https://www.ebi.ac.uk/pdbe/static/entry/${pdbId.toLowerCase()}_updated.cif`;
    
    const data = await plugin.builders.data.download({ 
      url: Asset.Url(url), 
      isBinary: false 
    });
    
    const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
    const model = await plugin.builders.structure.createModel(trajectory);
    const structure = await plugin.builders.structure.createStructure(model);
    
    // Highlight each domain
    for (const domain of domains) {
      // Build a selection expression for the domain
      const expression = {
        chainTest: (chain: any) => {
          return chain.authAsymId === domain.chainId;
        },
        residueTest: (residue: any) => {
          const seqNumber = residue.seqNumber.value;
          return seqNumber >= domain.start && seqNumber <= domain.end;
        }
      };
      
      // Convert color string to RGB (assuming color is a hex string like '#FF0000')
      const hexToRgb = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return { r, g, b };
      };
      
      const color = domain.color ? hexToRgb(domain.color) : ColorNames.get('skyblue');
      
      // Add representation for the domain
      await plugin.builders.structure.representation.addRepresentation(structure, {
        type: 'cartoon',
        color: 'uniform',
        colorParams: { value: color },
        size: 'uniform',
        sizeParams: { value: 0.6 }
      }, {
        selector: plugin.helpers.structureSelectionBuilder.withPredicate(
          structure, 
          expression
        )
      });
    }
    
    // Focus on structure
    plugin.canvas3d?.resetCamera();
    plugin.canvas3d?.commit();
  } catch (error) {
    console.error('Error highlighting domains:', error);
    throw error;
  }
}
