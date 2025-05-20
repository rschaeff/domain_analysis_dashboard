'use client'

import React, { useEffect, useRef, useState } from 'react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface SimpleMolstarViewerProps {
  pdbId: string;
  chainId?: string; 
  height?: string | number;
  width?: string | number;
  onReady?: (plugin: any) => void;
  onError?: (error: string) => void;
}

export function FixedSimpleMolstarViewer({
  pdbId,
  chainId,
  height = '400px',
  width = '100%',
  onReady,
  onError
}: SimpleMolstarViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Cleanup previous instance
    if (pluginRef.current) {
      try {
        pluginRef.current.dispose();
      } catch (e) {
        console.error('Error disposing plugin:', e);
      }
      pluginRef.current = null;
    }

    // Add minimal inline CSS for Molstar
    const addInlineCSS = () => {
      const cssId = 'molstar-inline-css';
      if (!document.getElementById(cssId)) {
        const style = document.createElement('style');
        style.id = cssId;
        style.textContent = `
          .msp-plugin {
            position: relative;
            width: 100%;
            height: 100%;
          }
          .msp-canvas3d {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }
          .msp-viewport-controls {
            position: absolute;
            right: 10px;
            top: 10px;
          }
          .msp-layout-expanded, .msp-layout-standard {
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
          }
        `;
        document.head.appendChild(style);
      }
    };
    
    addInlineCSS();

    // Initialize Molstar
    const initMolstar = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Import Molstar libraries
        const { DefaultPluginSpec } = await import('molstar/lib/mol-plugin/spec');
        const { PluginContext } = await import('molstar/lib/mol-plugin/context');
        
        // Create plugin instance
        const plugin = new PluginContext(DefaultPluginSpec());
        await plugin.init();
        
        // Store reference
        pluginRef.current = plugin;
        
        // Initialize viewer
        const viewerInitialized = plugin.initViewer(canvasRef.current, containerRef.current);
        
        if (!viewerInitialized) {
          throw new Error('Failed to initialize Molstar viewer');
        }
        
        // Set background color
        plugin.canvas3d?.setProps({
          backgroundColor: { color: 0xFFFFFF }
        });
        
        // Try to load the structure - first try mmCIF format
        try {
          // Load structure using mmCIF format (more reliable)
          const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
          const data = await plugin.builders.data.download({ url });
          const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
          const structure = await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
            id: 'preset-structure-representation-cartoon',
            params: {}
          });
          
          // Focus on chain if specified
          if (chainId && structure) {
            try {
              // Create a selection for the chain
              const components = plugin.managers.structure.hierarchy.current.structures[0].components;
              const selection = components.filter(c => 
                c.cell.obj.data.models.some(m => 
                  m.chains.some(ch => ch.authAsymId === chainId || ch.asymId === chainId)
                )
              );
              
              if (selection.length > 0) {
                // Focus camera on selection
                plugin.managers.camera.focusLoci(selection.map(c => c.cell), { durationMs: 250 });
              }
            } catch (chainErr) {
              console.warn('Error focusing on chain, showing whole structure:', chainErr);
              plugin.canvas3d?.resetCamera();
            }
          } else {
            plugin.canvas3d?.resetCamera();
          }
        } catch (mmcifErr) {
          console.warn('mmCIF format failed, trying PDB format:', mmcifErr);
          
          // Fall back to PDB format
          const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.pdb`;
          const data = await plugin.builders.data.download({ url });
          const trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb');
          const structure = await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
            id: 'preset-structure-representation-cartoon',
            params: {}
          });
          
          // Reset camera to show structure
          plugin.canvas3d?.resetCamera();
        }
        
        setIsLoading(false);
        if (onReady) onReady(plugin);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Error initializing Molstar:', errorMessage);
        setError(errorMessage);
        setIsLoading(false);
        if (onError) onError(errorMessage);
      }
    };
    
    initMolstar();
    
    // Cleanup
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
        } catch (e) {
          console.error('Error disposing plugin:', e);
        }
        pluginRef.current = null;
      }
    };
  }, [pdbId, chainId, onReady, onError]);

  return (
    <div className="relative" style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <LoadingSpinner />
          <span className="ml-2">Loading structure...</span>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-red-500 bg-white p-4 rounded shadow">
            <p className="font-bold mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ position: 'relative' }}
      >
        <canvas 
          ref={canvasRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
      </div>
    </div>
  );
}
