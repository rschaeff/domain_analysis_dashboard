"use client"

import React, { useRef, useEffect, useState } from 'react';
import { createPlugin } from 'molstar/lib/mol-plugin';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { Domain } from './types/domain';
import { ColorNames } from 'molstar/lib/mol-util/color/names';
import { MolScriptBuilder } from 'molstar/lib/mol-script/language/builder';
import { StateObjectSelector } from 'molstar/lib/mol-state';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';

interface VanillaMolstarViewerProps {
  pdbId: string;
  domains?: Domain[];
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  onStructureLoaded?: (structure: StateObjectSelector<PluginStateObject.Molecule.Structure>) => void;
}

export const VanillaMolstarViewer: React.FC<VanillaMolstarViewerProps> = ({
  pdbId,
  domains = [],
  width = '100%',
  height = '400px',
  className = '',
  style = {},
  onStructureLoaded
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plugin, setPlugin] = useState<PluginContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [structure, setStructure] = useState<StateObjectSelector<PluginStateObject.Molecule.Structure> | null>(null);

  // Initialize Molstar
  useEffect(() => {
    if (!containerRef.current) return;
    
    const initMolstar = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Create vanilla Molstar plugin (no UI components)
        const plugin = createPlugin(containerRef.current, {
          ...DefaultPluginUISpec(),
          layout: {
            initial: {
              isExpanded: false,
              showControls: false,
              controlsDisplay: 'reactive'
            }
          },
          config: [
            [PluginConfig.Viewport.ShowExpand, false],
            [PluginConfig.Viewport.ShowControls, false],
            [PluginConfig.Viewport.ShowSettings, false],
            [PluginConfig.Viewport.ShowSelectionMode, false],
            [PluginConfig.Viewport.ShowAnimation, false]
          ]
        });
        
        // Mount in the container
        plugin.initContainer(containerRef.current);
        
        // Store plugin instance
        setPlugin(plugin);
        
        // Load structure
        const structure = await loadStructure(plugin, pdbId);
        setStructure(structure);
        
        if (onStructureLoaded) {
          onStructureLoaded(structure);
        }
        
        // Highlight domains
        if (domains.length > 0) {
          await highlightDomains(plugin, structure, domains);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing Molstar:', err);
        setError(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };
    
    initMolstar();
    
    return () => {
      // Cleanup
      if (plugin) {
        plugin.dispose();
      }
    };
  }, [pdbId]);
  
  // Update domain visualization when domains change
  useEffect(() => {
    const updateDomains = async () => {
      if (!plugin || !structure || isLoading) return;
      
      try {
        await highlightDomains(plugin, structure, domains);
      } catch (err) {
        console.error('Error highlighting domains:', err);
      }
    };
    
    updateDomains();
  }, [plugin, structure, domains, isLoading]);
  
  return (
    <div 
      ref={containerRef}
      className={`vanilla-molstar-viewer ${className}`}
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
async function loadStructure(plugin: PluginContext, pdbId: string) {
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
  
  return structure;
}

// Helper function to highlight domains
async function highlightDomains(
  plugin: PluginContext, 
  structure: StateObjectSelector<PluginStateObject.Molecule.Structure>, 
  domains: Domain[]
) {
  if (!plugin || !structure) return;
  
  // First, clear existing domain components
  await clearDomainHighlights(plugin, structure);
  
  // Create domain components
  for (const domain of domains) {
    try {
      // Create domain expression
      const expression = MolScriptBuilder.struct.generator.atomGroups({
        'chain-test': MolScriptBuilder.core.rel.eq([
          MolScriptBuilder.struct.atomProperty.core.auth_asym_id(),
          domain.chainId
        ]),
        'residue-test': MolScriptBuilder.core.rel.inRange([
          MolScriptBuilder.struct.atomProperty.core.auth_seq_id(),
          domain.start,
          domain.end
        ])
      });
      
      // Create component for this domain
      const component = await plugin.builders.structure.tryCreateComponentFromExpression(
        structure,
        expression,
        `domain-${domain.id}`,
        { label: domain.label || `Domain ${domain.start}-${domain.end}` }
      );
      
      if (component) {
        // Apply visual representation
        await plugin.builders.structure.representation.addRepresentation(
          component,
          { 
            type: 'cartoon', 
            color: 'uniform', 
            colorParams: { value: ColorNames.parse(domain.color) }
          }
        );
      }
    } catch (err) {
      console.error(`Error highlighting domain ${domain.id}:`, err);
    }
  }
}

// Helper function to clear domain highlights
async function clearDomainHighlights(
  plugin: PluginContext, 
  structure: StateObjectSelector<PluginStateObject.Molecule.Structure>
) {
  if (!plugin || !structure) return;
  
  // Find and remove all domain components
  const state = plugin.state.data;
  const tree = state.tree;
  
  const toRemove = [];
  for (const ref of tree.children.get(structure.transform.ref)) {
    const obj = state.select(ref);
    if (obj?.transform.transformer.id.indexOf('structure-component') >= 0 && 
        obj?.transform.params?.key?.startsWith('domain-')) {
      toRemove.push(obj?.transform.ref);
    }
  }
  
  if (toRemove.length) {
    const update = state.build();
    for (const ref of toRemove) {
      update.delete(ref);
    }
    await update.commit();
  }
}
