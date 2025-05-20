'use client'

import React, { useRef, useEffect, useState } from 'react';

// Import correct Molstar modules for version 10.9.2
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
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

interface CorrectedMolstarViewerProps {
  pdbId: string;
  domains?: Domain[];
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

// Simple render function for React 18
function renderReact18(element: React.ReactElement, target: Element) {
  // Import required packages only on client
  if (typeof window !== 'undefined') {
    const { createRoot } = require('react-dom/client');
    // Check if a root already exists
    if (!(target as any)._reactRoot) {
      (target as any)._reactRoot = createRoot(target);
    }
    (target as any)._reactRoot.render(element);
    return (target as any)._reactRoot;
  }
  return null;
}

export const CorrectedMolstarViewer: React.FC<CorrectedMolstarViewerProps> = ({
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
        
        // Create Molstar plugin using the correct createPluginUI function
        const plugin = await createPluginUI({
          target: containerRef.current,
          render: renderReact18,
          spec: {
            ...DefaultPluginUISpec(),
            layout: {
              initial: {
                isExpanded: false,
                showControls: false,
                controlsDisplay: 'reactive'
              }
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
    <div className={`corrected-molstar-viewer ${className}`} style={{ 
      position: 'relative',
      width, 
      height,
      ...style
    }}>
      {/* Container for Molstar - it will create its own canvas */}
      <div 
        ref={containerRef}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      />
      
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
  try {
    // Clear any existing data
    await plugin.clear();
    
    // Construct URL for fetching structure
    const url = `https://www.ebi.ac.uk/pdbe/static/entry/${pdbId.toLowerCase()}_updated.cif`;
    
    console.log(`Loading structure from ${url}`);
    
    // Use data transaction for atomic operations
    await plugin.dataTransaction(async () => {
      // Download the data
      const data = await plugin.builders.data.download({ 
        url: Asset.Url(url), 
        isBinary: false 
      });
      
      // Parse trajectory
      const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
      
      // Apply preset
      await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', {
        structure: { 
          name: 'model', 
          params: {} 
        },
        showUnitcell: false,
        representationPreset: 'auto'
      });
    });
    
    // Reset camera
    plugin.canvas3d?.resetCamera();
    plugin.canvas3d?.commit();
    
    console.log('Structure loaded successfully');
  } catch (error) {
    console.error('Error loading structure:', error);
    throw error;
  }
}

// Helper function to highlight domains
async function highlightDomains(plugin: any, domains: Domain[]) {
  if (!plugin || domains.length === 0) return;
  
  try {
    console.log(`Highlighting ${domains.length} domains`);
    
    // Clear existing visual representations but keep the structure
    await plugin.builders.structure.representation.clearAll();
    
    // Get the current structure
    const structure = plugin.managers.structure.hierarchy.current.structures[0];
    if (!structure) {
      console.warn('No structure available to highlight domains on');
      return;
    }
    
    // Highlight each domain
    for (const domain of domains) {
      // Create selection query for the domain residues
      const query = {
        residueTest: (residue: any) => {
          const seqNumber = residue.seqNumber.value;
          return seqNumber >= domain.start && seqNumber <= domain.end;
        }
      };
      
      // If chain is specified, add it to the query
      if (domain.chainId) {
        Object.assign(query, {
          chainTest: (chain: any) => {
            return chain.authAsymId === domain.chainId;
          }
        });
      }
      
      // Add cartoon representation for the domain
      await plugin.builders.structure.representation.addRepresentation(structure, {
        type: 'cartoon',
        color: 'uniform',
        colorParams: { value: hexToRgb(domain.color) },
        size: 'uniform',
        sizeParams: { value: 0.6 }
      }, { 
        selector: plugin.helpers.structureSelectionBuilder.withPredicate(structure, query) 
      });
    }
    
    // Make sure changes are applied
    plugin.canvas3d?.commit();
    
    console.log('Domains highlighted successfully');
  } catch (error) {
    console.error('Error highlighting domains:', error);
    throw error;
  }
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string) {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex values to RGB (0-1 range for Molstar)
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  return { r, g, b };
}
