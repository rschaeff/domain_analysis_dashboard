'use client'

import React, { useEffect, useState } from 'react';
import { MolstarCanvas } from './molstar/components/MolstarCanvas';
import { DomainProvider } from './molstar/context/DomainContext';
import { useDomainContext } from './molstar/context/DomainContext';
import { useDomainVisualization } from './molstar/hooks/useDomainVisualization';
import { SequenceViewWithDomains } from './molstar/components/SequenceViewWithDomains';
import { DomainControls } from './molstar/components/DomainControls';
import { Domain } from './molstar/types/domain';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';

interface DomainVisualizerProps {
  pdbId: string;
  initialDomains?: Domain[];
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

// Internal component that uses the domain context
const DomainVisualizerContent: React.FC<Omit<DomainVisualizerProps, 'initialDomains'>> = ({ 
  pdbId, 
  width = '100%',
  height = '500px',
  className = '',
  style = {}
}) => {
  const { plugin, setPlugin, domains } = useDomainContext();
  const { highlightAllDomains } = useDomainVisualization();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize plugin and load structure
  useEffect(() => {
    const containerRef = document.createElement('div');
    
    const initPlugin = async () => {
      try {
        setIsLoading(true);
        
        // Create Molstar plugin
        const plugin = await createPluginUI({
          target: containerRef,
          render: renderReact18,
          spec: {
            // Configure for domain visualization
            layout: {
              initial: {
                isExpanded: false,
                showControls: true,
                controlsDisplay: 'reactive'
              }
            }
          }
        });
        
        // Initialize plugin
        await plugin.init();
        
        // Set plugin in context
        setPlugin(plugin);
        
        // Load structure
        await loadStructure(plugin, pdbId);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing Molstar:', err);
        setError(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };
    
    initPlugin();
    
    return () => {
      // Cleanup
      if (plugin) {
        plugin.dispose();
        setPlugin(null);
      }
    };
  }, [pdbId, setPlugin]);
  
  // Highlight domains when they change
  useEffect(() => {
    if (plugin && domains.length > 0 && !isLoading) {
      highlightAllDomains();
    }
  }, [plugin, domains, isLoading, highlightAllDomains]);
  
  // Handle range selection to create domains
  const handleRangeSelect = (chainId: string, start: number, end: number) => {
    // This is handled by the createDomainFromSelection function
    console.log(`Range selected: Chain ${chainId}, ${start}-${end}`);
  };
  
  return (
    <div 
      className={`domain-visualizer ${className}`}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width, 
        height,
        ...style 
      }}
    >
      <div className="structure-view" style={{ flex: '1 1 auto', position: 'relative' }}>
        {isLoading && (
          <div className="loading-overlay">
            Loading structure...
          </div>
        )}
        {error && (
          <div className="error-overlay">
            {error}
          </div>
        )}
        <MolstarCanvas />
      </div>
      
      <div className="sequence-and-controls" style={{ display: 'flex', flexDirection: 'row', height: '200px' }}>
        <div className="sequence-container" style={{ flex: '2 1 0', overflowY: 'auto' }}>
          <SequenceViewWithDomains onRangeSelect={handleRangeSelect} />
        </div>
        <div className="controls-container" style={{ flex: '1 1 0', overflowY: 'auto' }}>
          <DomainControls />
        </div>
      </div>
    </div>
  );
};

// Helper function to load structure
async function loadStructure(plugin: any, pdbId: string) {
  // Clear any existing data
  await plugin.clear();
  
  // Construct URL for fetching structure
  const url = `https://www.ebi.ac.uk/pdbe/static/entry/${pdbId.toLowerCase()}_updated.cif`;
  
  // Load the structure
  const data = await plugin.builders.data.download({ url, isBinary: false });
  const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
  
  const model = await plugin.builders.structure.createModel(trajectory);
  const structure = await plugin.builders.structure.createStructure(model);
  
  // Apply default representation
  await plugin.builders.structure.representation.addRepresentation(structure, {
    type: 'cartoon',
    color: 'chain-id'
  });
  
  // Focus camera on structure
  await plugin.canvas3d?.resetCamera();
  plugin.canvas3d?.requestResize();
}

// Main component with provider
export const DomainVisualizer: React.FC<DomainVisualizerProps> = ({ initialDomains = [], ...props }) => {
  return (
    <DomainProvider>
      <DomainVisualizerContent {...props} />
    </DomainProvider>
  );
};
